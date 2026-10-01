package sync

import (
	"context"
	_ "embed"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var schema string

// PostgresStore keeps all records in one table keyed by (user, kind, id).
type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(ctx context.Context, url string) (*PostgresStore, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	if _, err := pool.Exec(ctx, schema); err != nil {
		pool.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return &PostgresStore{pool: pool}, nil
}

func (p *PostgresStore) Close() { p.pool.Close() }

func (p *PostgresStore) Ping(ctx context.Context) error { return p.pool.Ping(ctx) }

// The WHERE clause on the conflict branch is what makes this last-write-wins:
// an older incoming version is silently ignored.
const upsert = `
INSERT INTO records (user_id, kind, id, data, updated_at, deleted_at, seq)
VALUES ($1, $2, $3, $4, $5, $6, nextval('records_seq'))
ON CONFLICT (user_id, kind, id) DO UPDATE
SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at, seq = nextval('records_seq')
WHERE records.updated_at < EXCLUDED.updated_at`

func (p *PostgresStore) Apply(ctx context.Context, userID string, recs []Record) (int, error) {
	if len(recs) == 0 {
		return 0, nil
	}
	batch := &pgx.Batch{}
	for _, r := range recs {
		batch.Queue(upsert, userID, r.Kind, r.ID, r.Data, r.UpdatedAt, r.DeletedAt)
	}
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	br := tx.SendBatch(ctx, batch)
	applied := 0
	for range recs {
		tag, err := br.Exec()
		if err != nil {
			br.Close()
			return 0, err
		}
		applied += int(tag.RowsAffected())
	}
	if err := br.Close(); err != nil {
		return 0, err
	}
	return applied, tx.Commit(ctx)
}

func (p *PostgresStore) Since(ctx context.Context, userID string, cursor int64, limit int) ([]Record, error) {
	rows, err := p.pool.Query(ctx,
		`SELECT kind, id, data, updated_at, deleted_at, seq FROM records
		 WHERE user_id = $1 AND seq > $2 ORDER BY seq LIMIT $3`, userID, cursor, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Record
	for rows.Next() {
		var r Record
		if err := rows.Scan(&r.Kind, &r.ID, &r.Data, &r.UpdatedAt, &r.DeletedAt, &r.Seq); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
