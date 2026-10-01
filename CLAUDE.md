# CLAUDE.md

Logbook: science-based lifting log. `mobile/` is the Expo iOS app, `server/` the Go
sync service. Read `README.md` for the model and architecture, and `HANDOFF.md` for
current status and next steps.

## Commands

```bash
cd mobile && npm test && npm run typecheck   # run before calling anything done
cd mobile && npx expo start --web            # browser preview
cd server && go vet ./... && go test ./...   # Go is at /opt/homebrew/bin/go
```

The repo-root `.claude/launch.json` has a `logbook-web` preview config (port 8081).

## Rules of the codebase

- **Tone:** the app guides and never scolds. Insights are observations ("grew less
  than a third of the week"), never commands. No red for training status. Every
  insight has a `why`. Tests assert no "must"/"should" in titles.
- **The user's training model is authoritative:** growth window 36–48 h after a
  session, atrophy outside it, frequency over volume, 6–10 weekly sets (~12 priority),
  priority muscles first, outside activities = fatigue only. Defaults live in
  `mobile/src/domain/settings.ts`; every threshold is user-adjustable.
- `src/domain`, `src/metrics`, `src/insights`, `src/sync` stay free of React Native
  imports so Vitest can run them. Put logic there, not in screens.
- Weights are stored in kg and converted for display.
- Platform splits use Metro extensions: `db/client.ts` (SQLite) vs `client.web.ts`
  (localStorage), plus `lib/services.web.ts` and `sync/account.web.ts` stubs.
- Expo SDK 57: React Navigation is bundled into expo-router (import `DarkTheme`,
  `ThemeProvider`, `Stack` from `expo-router`; tabs from `expo-router/js-tabs`). Use
  `npx expo install` for packages. See `mobile/AGENTS.md`.
- New exercises go in `src/domain/exercises.ts` with joint actions, region weights
  (1 / 0.5 / 0.25), length bias and an evidence grade + note.
- Rows keep `updated_at` / `deleted_at` for sync; deletes are tombstones on native.

## Gotchas

- `xcode-select` points at CommandLineTools; use
  `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`. The Xcode license must
  be accepted (`sudo xcodebuild -license`) before simulator builds work.
- Vitest needs `@rolldown/binding-darwin-arm64` (npm optional-deps bug); it's in devDeps.
- On web, react-native-svg logs harmless "Unknown event handler property" warnings.
