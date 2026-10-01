// Package auth verifies Supabase access tokens and extracts the user id.
package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

var ErrUnauthorized = errors.New("unauthorized")

type Verifier interface {
	// Verify validates a bearer token and returns the Supabase user id (sub).
	Verify(token string) (string, error)
}

type jwtVerifier struct {
	keyfunc jwt.Keyfunc
	methods []string
	issuer  string
}

// NewHS256 verifies tokens signed with a project's legacy shared JWT secret.
func NewHS256(secret, issuer string) Verifier {
	return &jwtVerifier{
		keyfunc: func(*jwt.Token) (any, error) { return []byte(secret), nil },
		methods: []string{"HS256"},
		issuer:  issuer,
	}
}

// NewJWKS verifies tokens signed with a project's asymmetric signing keys,
// fetched (and refreshed) from Supabase's JWKS endpoint.
func NewJWKS(ctx context.Context, supabaseURL string) (Verifier, error) {
	base := strings.TrimRight(supabaseURL, "/")
	k, err := keyfunc.NewDefaultCtx(ctx, []string{base + "/auth/v1/.well-known/jwks.json"})
	if err != nil {
		return nil, fmt.Errorf("jwks: %w", err)
	}
	return &jwtVerifier{keyfunc: k.Keyfunc, methods: []string{"ES256", "RS256"}, issuer: base + "/auth/v1"}, nil
}

func (v *jwtVerifier) Verify(token string) (string, error) {
	opts := []jwt.ParserOption{jwt.WithValidMethods(v.methods), jwt.WithAudience("authenticated"), jwt.WithExpirationRequired()}
	if v.issuer != "" {
		opts = append(opts, jwt.WithIssuer(v.issuer))
	}
	claims := jwt.RegisteredClaims{}
	if _, err := jwt.ParseWithClaims(token, &claims, v.keyfunc, opts...); err != nil {
		return "", fmt.Errorf("%w: %v", ErrUnauthorized, err)
	}
	if claims.Subject == "" {
		return "", fmt.Errorf("%w: missing sub", ErrUnauthorized)
	}
	return claims.Subject, nil
}
