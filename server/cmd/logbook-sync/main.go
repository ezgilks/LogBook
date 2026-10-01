// Command logbook-sync runs the Logbook sync API.
//
// Environment:
//
//	PORT                 listen port (default 8080)
//	DATABASE_URL         Postgres connection string (Supabase); omit for an in-memory store
//	SUPABASE_URL         project URL, used to verify tokens via JWKS
//	SUPABASE_JWT_SECRET  legacy shared secret (HS256), used instead of JWKS if set
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ezgilks/logbook/server/internal/api"
	"github.com/ezgilks/logbook/server/internal/auth"
	"github.com/ezgilks/logbook/server/internal/sync"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	var store sync.Store
	if url := os.Getenv("DATABASE_URL"); url != "" {
		pg, err := sync.NewPostgresStore(ctx, url)
		if err != nil {
			return err
		}
		defer pg.Close()
		store = pg
	} else {
		log.Warn("DATABASE_URL not set; using in-memory store")
		store = sync.NewMemoryStore()
	}

	var verifier auth.Verifier
	supabaseURL := os.Getenv("SUPABASE_URL")
	switch {
	case os.Getenv("SUPABASE_JWT_SECRET") != "":
		issuer := ""
		if supabaseURL != "" {
			issuer = supabaseURL + "/auth/v1"
		}
		verifier = auth.NewHS256(os.Getenv("SUPABASE_JWT_SECRET"), issuer)
	case supabaseURL != "":
		v, err := auth.NewJWKS(ctx, supabaseURL)
		if err != nil {
			return err
		}
		verifier = v
	default:
		return errors.New("set SUPABASE_URL or SUPABASE_JWT_SECRET")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           (&api.Server{Store: store, Verifier: verifier, Log: log, Now: time.Now}).Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
	}

	errc := make(chan error, 1)
	go func() {
		log.Info("listening", "addr", srv.Addr)
		errc <- srv.ListenAndServe()
	}()
	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
