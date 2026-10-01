// Package api exposes the sync service over HTTP.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/ezgilks/logbook/server/internal/auth"
	"github.com/ezgilks/logbook/server/internal/sync"
)

const maxBody = 4 << 20

type Pinger interface{ Ping(context.Context) error }

type Server struct {
	Store    sync.Store
	Verifier auth.Verifier
	Log      *slog.Logger
	Now      func() time.Time
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.health)
	mux.HandleFunc("POST /v1/sync", s.withUser(s.sync))
	return s.logRequests(mux)
}

type ctxKey struct{}

func (s *Server) withUser(next func(http.ResponseWriter, *http.Request, string)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || token == "" {
			writeErr(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		user, err := s.Verifier.Verify(token)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "invalid token")
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, user)), user)
	}
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	if p, ok := s.Store.(Pinger); ok {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := p.Ping(ctx); err != nil {
			writeErr(w, http.StatusServiceUnavailable, "database unavailable")
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) sync(w http.ResponseWriter, r *http.Request, user string) {
	var req sync.Request
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBody))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	resp, err := sync.Sync(r.Context(), s.Store, user, req, s.Now())
	if errors.Is(err, sync.ErrInvalid) {
		writeErr(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	if err != nil {
		s.Log.Error("sync failed", "user", user, "err", err)
		writeErr(w, http.StatusInternalServerError, "sync failed")
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (s *Server) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		s.Log.Info("request", "method", r.Method, "path", r.URL.Path, "status", rec.status, "ms", time.Since(start).Milliseconds())
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
