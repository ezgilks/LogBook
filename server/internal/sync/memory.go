package sync

import (
	"context"
	"sort"
	gosync "sync"
)

// MemoryStore is an in-process Store used by tests and local development.
type MemoryStore struct {
	mu    gosync.Mutex
	seq   int64
	users map[string]map[string]*Record
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{users: map[string]map[string]*Record{}}
}

func (m *MemoryStore) Apply(_ context.Context, userID string, recs []Record) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rows := m.users[userID]
	if rows == nil {
		rows = map[string]*Record{}
		m.users[userID] = rows
	}
	applied := 0
	for _, r := range recs {
		key := r.Kind + "/" + r.ID
		if cur, ok := rows[key]; ok && cur.UpdatedAt >= r.UpdatedAt {
			continue
		}
		m.seq++
		r.Seq = m.seq
		rec := r
		rows[key] = &rec
		applied++
	}
	return applied, nil
}

func (m *MemoryStore) Since(_ context.Context, userID string, cursor int64, limit int) ([]Record, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []Record
	for _, r := range m.users[userID] {
		if r.Seq > cursor {
			out = append(out, *r)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Seq < out[j].Seq })
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}
