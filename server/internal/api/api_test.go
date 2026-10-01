package api

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ezgilks/logbook/server/internal/auth"
	"github.com/ezgilks/logbook/server/internal/sync"
	"github.com/golang-jwt/jwt/v5"
)

const secret = "test-secret"

var now = time.UnixMilli(1_790_000_000_000)

func token(t *testing.T, sub string, exp time.Time) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject: sub, Audience: jwt.ClaimStrings{"authenticated"}, ExpiresAt: jwt.NewNumericDate(exp),
	})
	s, err := tok.SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func newServer() http.Handler {
	s := &Server{
		Store:    sync.NewMemoryStore(),
		Verifier: auth.NewHS256(secret, ""),
		Log:      slog.New(slog.NewTextHandler(io.Discard, nil)),
		Now:      func() time.Time { return now },
	}
	return s.Handler()
}

func post(t *testing.T, h http.Handler, tok string, body any) *httptest.ResponseRecorder {
	t.Helper()
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/v1/sync", bytes.NewReader(b))
	if tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestSyncRequiresAuth(t *testing.T) {
	h := newServer()
	if rec := post(t, h, "", sync.Request{}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("no token: %d", rec.Code)
	}
	if rec := post(t, h, "garbage", sync.Request{}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("bad token: %d", rec.Code)
	}
	if rec := post(t, h, token(t, "u1", time.Now().Add(-time.Minute)), sync.Request{}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("expired token: %d", rec.Code)
	}
}

func TestSyncPushPull(t *testing.T) {
	h := newServer()
	tok := token(t, "11111111-1111-1111-1111-111111111111", time.Now().Add(time.Hour))
	push := sync.Request{Changes: []sync.Record{{Kind: "set", ID: "s1", UpdatedAt: now.UnixMilli(), Data: json.RawMessage(`{"reps":8}`)}}}
	rec := post(t, h, tok, push)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	var resp sync.Response
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp.Applied != 1 || len(resp.Changes) != 1 || resp.Cursor == 0 {
		t.Fatalf("resp %+v", resp)
	}

	// Another user sees nothing.
	other := post(t, h, token(t, "22222222-2222-2222-2222-222222222222", time.Now().Add(time.Hour)), sync.Request{})
	var otherResp sync.Response
	json.Unmarshal(other.Body.Bytes(), &otherResp)
	if len(otherResp.Changes) != 0 {
		t.Fatalf("leak across users: %+v", otherResp)
	}
}

func TestSyncRejectsInvalid(t *testing.T) {
	h := newServer()
	tok := token(t, "u1", time.Now().Add(time.Hour))
	rec := post(t, h, tok, sync.Request{Changes: []sync.Record{{Kind: "bogus", ID: "x", UpdatedAt: 1, Data: json.RawMessage(`{}`)}}})
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestHealth(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
}
