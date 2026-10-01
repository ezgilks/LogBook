# Logbook

A science-based lifting log for iOS. Log weight × reps × RIR and see which muscles
are **growing right now**, how much of your week each one spends growing, where your
volume goes by muscle region and joint action, and a shareable recap after every
workout.

Logbook is a **guide, not a coach**: it shows what your training looks like and
explains why, and you decide what to do about it. Every rule is adjustable.

```
mobile/   Expo (React Native) + TypeScript iOS app — offline-first, SQLite
server/   Go sync service — last-write-wins replication to Postgres (Supabase)
```

---

## The model

**Growth windows.** A session that trains a muscle region opens a growth window of
roughly **36–48 hours** (longer for bigger doses: 36 h at 1 hard set → 48 h at 4+).
Outside a window the region is drifting toward atrophy. So frequency is the main
lever: 1 set × 3 days keeps a muscle growing far longer than 3 sets × 1 day.

**Hard sets.** Sets at 0–3 RIR count as 1 hard set, 4–5 RIR as half, warm-ups and
easier sets as 0. Secondary movers get fractional credit (0.5), and a muscle counts
once per set (bench = 1 chest set, not 3).

**Weekly volume.** A soft range of 6–10 hard sets per muscle (up to ~12 for priority
muscles), shown as a band, not a target.

**Regions and joint actions.** Each exercise is defined by the joint actions it
trains, its credit to 27 regions (upper/mid/lower chest, three delt heads, triceps
long head, rectus femoris vs vasti, …), where it's hardest (lengthened / mid /
shortened), and an A/B/C evidence grade with the study behind it.

**Outside activities** (basketball, running, …) are logged as duration × difficulty
(session-RPE) and count as **fatigue only** — never growth or volume.

Sources are listed in-app (Settings → The science) and in
[`mobile/src/domain/references.ts`](mobile/src/domain/references.ts).

---

## Features

- **Today**: front/back body map glowing by growth-window status, live countdowns,
  insight cards with a "Why?" on every one, recovery context.
- **Logger**: sets pre-filled from last session, one-tap logging, RIR picker, rest
  timer, regions lighting up live as you train.
- **Recap**: 9:16 share card (body map, PRs, lifts vs last time), session insights,
  weekly volume after the session.
- **Body**: per-muscle 7-day window timelines, % of week growing, frequency, weekly
  sets vs range; joint-action and length-bias breakdowns.
- **Exercise detail**: regions, joint actions, evidence, e1RM trend, best weight by reps.
- **Settings**: units, priority muscles, every rule threshold, mutable insight types,
  sample data.
- **Optional account + backup**: Sign in with Apple → Supabase auth → Go sync service.

---

## Architecture

```
iPhone (Expo)                                 Cloud (optional)
┌─────────────────────────────┐   sync    ┌───────────────────┐
│ Screens (Expo Router)       │ ◄──────►  │ Go sync API       │
│ insights/  rules → Insight  │  records  │  (Fly.io)         │
│ metrics/   pure functions   │  + cursor └─────────┬─────────┘
│ domain/    exercises, rules │                     │
│ SQLite + Drizzle            │           ┌─────────▼─────────┐
│ Sentry · PostHog            │           │ Supabase Postgres │
└─────────────────────────────┘           │ + Auth (Apple)    │
                                          └───────────────────┘
```

- **Framework-free core.** `domain/`, `metrics/`, `insights/` and `sync/` import no
  React Native and are covered by Vitest.
- **Local-first.** The whole log lives in memory (Zustand) and writes through to
  SQLite. Every row has `updated_at` and a `deleted_at` tombstone.
- **Sync protocol.** The client pushes rows changed since its last push; the server
  keeps the newer `updatedAt` (`ON CONFLICT … WHERE records.updated_at <
  EXCLUDED.updated_at`) and returns everything after the client's cursor, a
  server-assigned sequence number, so pulls never depend on device clocks. Batched
  pushes and paginated pulls.
- **Auth.** Supabase access tokens verified in Go via JWKS (ES256/RS256) or the legacy
  HS256 secret, with audience, issuer and expiry checks.

---

## Development

```bash
cd mobile
npm install
npm run web          # browser preview (localStorage instead of SQLite, no sync)
npm test             # Vitest: metrics, insights, sync client
npm run typecheck
npx expo run:ios     # dev build on the iOS simulator (needs Xcode)
maestro test .maestro  # end-to-end flows against a simulator build

cd server
go test ./...                            # set TEST_DATABASE_URL to also test Postgres
SUPABASE_JWT_SECRET=dev go run ./cmd/logbook-sync   # in-memory store on :8080
```

Schema changes: edit `mobile/src/db/schema.ts`, then `npm run db:generate`.

## Services

All optional; copy `mobile/.env.example` to `mobile/.env`. With nothing set the app
is fully local.

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_SENTRY_DSN` | Crash reporting |
| `EXPO_PUBLIC_POSTHOG_KEY` | Product analytics (funnels, retention) |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SYNC_URL` | Accounts + backup |

Server (`fly secrets set`): `DATABASE_URL`, `SUPABASE_URL` (or `SUPABASE_JWT_SECRET`).
