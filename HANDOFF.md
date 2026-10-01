# Handoff

_Last updated: 2026-09-30_

## Status

**Phase 1 (launchable app): built.** All screens work in the web preview: Today,
Body, History, Settings, the logger, exercise picker, recap with share card,
activity logging, and exercise/muscle detail. 31 Vitest tests pass, typecheck is
clean, and `expo-doctor` passes 21/21 checks.

**Phase 2 (accounts + sync): code complete, not deployed.** The Go service passes its
tests (sync core, LWW store conformance, HTTP + auth). The mobile sync client is
tested against a fake server. Sign in with Apple + Supabase is wired in and stays
hidden until env vars are set.

**Not yet run on iOS.** Everything was verified through the web preview. The first
simulator build may surface native-only issues (SQLite migrations, view-shot sharing,
haptics).

## Needs Ezra (outside the codebase)

1. **Accept the Xcode license** so simulator builds work: `sudo xcodebuild -license`
2. **First simulator run:** `cd mobile && npx expo run:ios`
3. **Apple Developer account** ($99/yr), needed for TestFlight, Sign in with Apple, and the App Store
4. **Expo account:** `npx eas-cli@latest login`, then `npx eas-cli@latest init` (writes the project id)
5. **Supabase project:** enable the Apple provider, then copy the URL + anon key into `mobile/.env`
6. **Fly.io:** `cd server && fly launch --no-deploy`, set `fly secrets set DATABASE_URL=… SUPABASE_URL=…`, then `fly deploy`
7. **Sentry + PostHog** projects, with keys in `mobile/.env`
8. **App name / icon:** "Logbook" is a working name; the icon is still Expo's default
9. **GitHub repo:** push, and CI (`.github/workflows/ci.yml`) runs mobile + Go tests, including Postgres

## Next up (code)

- Verify on the simulator and fix any native issues; run the Maestro flows
- App icon + splash screen
- Progression targets in the logger, once Ezra writes down his progression rules
- e1RM stall detection insight
- HealthKit import (workouts → activities, bodyweight)
- Lock-screen rest timer (Live Activity)
- RevenueCat premium tier (later)
