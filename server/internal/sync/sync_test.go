package sync

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"testing"
	"time"
)

var now = time.UnixMilli(1_790_000_000_000)

func rec(kind, id string, updated int64, data string) Record {
	return Record{Kind: kind, ID: id, UpdatedAt: updated, Data: json.RawMessage(data)}
}

// storeConformance runs against every Store implementation.
func storeConformance(t *testing.T, newStore func(t *testing.T) Store) {
	ctx := context.Background()
	const alice = "00000000-0000-0000-0000-00000000000a"
	const bob = "00000000-0000-0000-0000-00000000000b"

	t.Run("last write wins", func(t *testing.T) {
		s := newStore(t)
		if n, _ := s.Apply(ctx, alice, []Record{rec("set", "s1", 100, `{"reps":8}`)}); n != 1 {
			t.Fatalf("applied %d, want 1", n)
		}
		if n, _ := s.Apply(ctx, alice, []Record{rec("set", "s1", 50, `{"reps":5}`)}); n != 0 {
			t.Fatalf("older write applied")
		}
		if n, _ := s.Apply(ctx, alice, []Record{rec("set", "s1", 200, `{"reps":10}`)}); n != 1 {
			t.Fatalf("newer write not applied")
		}
		got, _ := s.Since(ctx, alice, 0, 10)
		if len(got) != 1 || string(got[0].Data) != `{"reps": 10}` && string(got[0].Data) != `{"reps":10}` {
			t.Fatalf("got %+v", got)
		}
	})

	t.Run("cursor only returns newer changes", func(t *testing.T) {
		s := newStore(t)
		s.Apply(ctx, alice, []Record{rec("workout", "w1", 1, `{}`), rec("workout", "w2", 1, `{}`)})
		first, _ := s.Since(ctx, alice, 0, 10)
		if len(first) != 2 {
			t.Fatalf("got %d", len(first))
		}
		cursor := first[1].Seq
		s.Apply(ctx, alice, []Record{rec("workout", "w1", 2, `{"notes":"x"}`)})
		next, _ := s.Since(ctx, alice, cursor, 10)
		if len(next) != 1 || next[0].ID != "w1" {
			t.Fatalf("got %+v", next)
		}
	})

	t.Run("tombstones replicate", func(t *testing.T) {
		s := newStore(t)
		s.Apply(ctx, alice, []Record{rec("activity", "a1", 1, `{}`)})
		del := rec("activity", "a1", 2, `{}`)
		ts := int64(2)
		del.DeletedAt = &ts
		s.Apply(ctx, alice, []Record{del})
		got, _ := s.Since(ctx, alice, 0, 10)
		if len(got) != 1 || got[0].DeletedAt == nil {
			t.Fatalf("tombstone lost: %+v", got)
		}
	})

	t.Run("users are isolated", func(t *testing.T) {
		s := newStore(t)
		s.Apply(ctx, alice, []Record{rec("set", "s1", 1, `{}`)})
		got, _ := s.Since(ctx, bob, 0, 10)
		if len(got) != 0 {
			t.Fatalf("bob sees alice's data")
		}
	})
}

func TestMemoryStore(t *testing.T) {
	storeConformance(t, func(*testing.T) Store { return NewMemoryStore() })
}

func TestPostgresStore(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	storeConformance(t, func(t *testing.T) Store {
		s, err := NewPostgresStore(context.Background(), url)
		if err != nil {
			t.Fatal(err)
		}
		s.pool.Exec(context.Background(), "TRUNCATE records")
		t.Cleanup(s.Close)
		return s
	})
}

func TestValidate(t *testing.T) {
	ok := rec("set", "s1", now.UnixMilli(), `{}`)
	if err := Validate(ok, now); err != nil {
		t.Fatal(err)
	}
	bad := []Record{
		rec("nope", "s1", 1, `{}`),
		rec("set", "", 1, `{}`),
		rec("set", "s1", 1, `not json`),
		rec("set", "s1", 0, `{}`),
		rec("set", "s1", now.Add(48*time.Hour).UnixMilli(), `{}`),
	}
	for _, r := range bad {
		if err := Validate(r, now); !errors.Is(err, ErrInvalid) {
			t.Errorf("%+v: want ErrInvalid, got %v", r, err)
		}
	}
}

func TestSyncRoundTrip(t *testing.T) {
	ctx := context.Background()
	s := NewMemoryStore()
	user := "u"

	// Phone A pushes two sets.
	a, err := Sync(ctx, s, user, Request{Changes: []Record{rec("set", "s1", 10, `{}`), rec("set", "s2", 10, `{}`)}}, now)
	if err != nil || a.Applied != 2 || len(a.Changes) != 2 {
		t.Fatalf("a=%+v err=%v", a, err)
	}

	// Phone B (fresh) pulls everything.
	b, _ := Sync(ctx, s, user, Request{}, now)
	if len(b.Changes) != 2 || b.Cursor != a.Cursor {
		t.Fatalf("b=%+v", b)
	}

	// Phone B edits s1; phone A pulls only that change.
	Sync(ctx, s, user, Request{Cursor: b.Cursor, Changes: []Record{rec("set", "s1", 20, `{"reps":9}`)}}, now)
	a2, _ := Sync(ctx, s, user, Request{Cursor: a.Cursor}, now)
	if len(a2.Changes) != 1 || a2.Changes[0].ID != "s1" {
		t.Fatalf("a2=%+v", a2)
	}
}

func TestSyncPaginates(t *testing.T) {
	ctx := context.Background()
	s := NewMemoryStore()
	var batch []Record
	for i := 0; i < MaxBatch; i++ {
		batch = append(batch, rec("set", string(rune('a'+i%26))+time.Duration(i).String(), 1, `{}`))
	}
	Sync(ctx, s, "u", Request{Changes: batch}, now)
	Sync(ctx, s, "u", Request{Changes: []Record{rec("set", "extra", 1, `{}`)}}, now)

	first, _ := Sync(ctx, s, "u", Request{}, now)
	if !first.More || len(first.Changes) != MaxBatch {
		t.Fatalf("first page: more=%v n=%d", first.More, len(first.Changes))
	}
	second, _ := Sync(ctx, s, "u", Request{Cursor: first.Cursor}, now)
	if second.More || len(second.Changes) != 1 {
		t.Fatalf("second page: more=%v n=%d", second.More, len(second.Changes))
	}
}
