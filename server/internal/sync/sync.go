// Package sync implements last-write-wins replication of the lifting log.
//
// The phone is the source of truth and works offline. Each row carries an
// updatedAt timestamp (and deletedAt tombstone). On sync the client pushes rows
// changed since its last push, the server keeps whichever version has the newer
// updatedAt, and the client pulls everything after its cursor. The cursor is a
// server-assigned sequence number, so pulls never depend on device clocks.
package sync

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// Kinds of records that can be synced.
var Kinds = map[string]bool{"workout": true, "set": true, "activity": true, "setting": true}

const (
	MaxBatch    = 500
	MaxDataSize = 16 << 10
	maxIDLen    = 128
	maxSkew     = 24 * time.Hour
)

type Record struct {
	Kind      string          `json:"kind"`
	ID        string          `json:"id"`
	Data      json.RawMessage `json:"data"`
	UpdatedAt int64           `json:"updatedAt"`
	DeletedAt *int64          `json:"deletedAt,omitempty"`
	Seq       int64           `json:"-"`
}

type Request struct {
	Cursor  int64    `json:"cursor"`
	Changes []Record `json:"changes"`
}

type Response struct {
	Cursor  int64    `json:"cursor"`
	Changes []Record `json:"changes"`
	More    bool     `json:"more"`
	Applied int      `json:"applied"`
}

// Store persists records per user.
type Store interface {
	// Apply upserts records, keeping the version with the newer UpdatedAt. It
	// returns how many records were written.
	Apply(ctx context.Context, userID string, recs []Record) (int, error)
	// Since returns up to limit records with Seq > cursor, ordered by Seq.
	Since(ctx context.Context, userID string, cursor int64, limit int) ([]Record, error)
}

var ErrInvalid = errors.New("invalid record")

// Validate rejects malformed records and timestamps too far in the future
// (which would otherwise win every future conflict).
func Validate(r Record, now time.Time) error {
	switch {
	case !Kinds[r.Kind]:
		return fmt.Errorf("%w: unknown kind %q", ErrInvalid, r.Kind)
	case r.ID == "" || len(r.ID) > maxIDLen:
		return fmt.Errorf("%w: bad id", ErrInvalid)
	case len(r.Data) == 0 || len(r.Data) > MaxDataSize || !json.Valid(r.Data):
		return fmt.Errorf("%w: bad data for %s/%s", ErrInvalid, r.Kind, r.ID)
	case r.UpdatedAt <= 0 || r.UpdatedAt > now.Add(maxSkew).UnixMilli():
		return fmt.Errorf("%w: bad updatedAt for %s/%s", ErrInvalid, r.Kind, r.ID)
	}
	return nil
}

// Sync runs one push+pull round.
func Sync(ctx context.Context, s Store, userID string, req Request, now time.Time) (Response, error) {
	if len(req.Changes) > MaxBatch {
		return Response{}, fmt.Errorf("%w: at most %d changes per request", ErrInvalid, MaxBatch)
	}
	for _, r := range req.Changes {
		if err := Validate(r, now); err != nil {
			return Response{}, err
		}
	}
	applied, err := s.Apply(ctx, userID, req.Changes)
	if err != nil {
		return Response{}, err
	}
	recs, err := s.Since(ctx, userID, req.Cursor, MaxBatch+1)
	if err != nil {
		return Response{}, err
	}
	resp := Response{Cursor: req.Cursor, Applied: applied, Changes: recs}
	if len(recs) > MaxBatch {
		resp.Changes, resp.More = recs[:MaxBatch], true
	}
	if n := len(resp.Changes); n > 0 {
		resp.Cursor = resp.Changes[n-1].Seq
	}
	if resp.Changes == nil {
		resp.Changes = []Record{}
	}
	return resp, nil
}
