# Status

## Built

- PWA with conversational logging, duplicate guard, handoff brief, Ask box, voice input, smart rhythm predictions & advice (`src/domain/predictions.ts`), and on-device smart notifications (nap wind-down, nap sweet-spot, expected wake-up, upcoming feed, and diaper check).
- Capacitor Android and iOS projects generated (`android/` and `ios/`, synced with `npm run cap:sync`); CI builds `calendaby-debug-apk`.
- Hybrid capture: the rules parser handles what it can on the phone; leftovers go to the agent.
- `backend/`: Hono routes on SQLite (`node:sqlite`), one POST route per operationId (`recordEvents`, `listEvents`).
- `agent/agent.ts`: capture and chat modes. `listEvents` and `getPredictions` (deduced sleep, feed, diaper, and 7-day trend insights) are tools available to the chat agent. Each agent call first syncs the app's events into the backend.
- Model from `MODEL_NAME`: OpenRouter, default `openai/gpt-6-luna`.
- Clerk sign-in is required when `VITE_CLERK_PUBLISHABLE_KEY` is set (`src/ui/AuthGate.tsx`); without the key the app runs signed out. The caregiver name defaults to the account's first name, and "Continue without signing in" appears if Clerk can't load (offline). With `CLERK_SECRET_KEY` set, `/api/agent` and `/api/backend/*` require a Clerk session token (401 otherwise); without it the API stays open as before. Logging works signed out. Calendar tab: Sync Gmail, confirm or dismiss proposals, and a two-week agenda (confirmed visits plus Google Calendar) that flags clashes with the predicted nap or feed. Confirmed visits are cached on the device and schedule reminders (day before, 2 hours before, time to leave) when reminders are on. Backend Gmail appointment import is built (`importAppointments`, `listAppointments`, `setAppointmentStatus`; proposals only, the parent confirms). See `docs/PLAN_CLERK.md`.
- Feature switches: the `features` table in the on-device SQLite (schema v2) holds each feature's label, group, order and on/off state; Profile lists them from the database and Today, the tabs and the Ask buttons follow them. A feature the table does not know counts as on. Entries can be edited from the Timeline (time, amounts, type, notes; sleep start and end); edits keep the original id and who logged it.
- Activities and pumping (from `docs/ANALYSIS_HUCKLEBERRY.md`): two event kinds, `activity` (`type` is an id from the on-device `activity_types` table, seeded with tummy, bath, outdoor, indoor; schema v3; custom types can be added from the Tummy & Play tab) and `pump` (amount, side, minutes; never counted as a feed). Typed or spoken ("tummy time 5 min", "pumped 4 oz left"), Logger tabs, Timeline "Activities" filter, edit sheet, Today tiles for tummy minutes and pumped milk (shown once there is data), handoff lines, and the agent's `record_events` tool. Feature switches `activities` and `pumping`.
- Activity tab (`src/ui/Activity.tsx`, behind the `activities` switch): tummy time against a daily goal the parent sets (setting `tummyGoal`, default 30 min, not medical advice), one-tap 3/5/10 minute logging for every activity type, a 7-day active-minutes chart, today's minutes per type and recent sessions with edit. Types now also include crawling, walking and swimming (schema v4 adds them to existing installs). The nav grows to six items when it is on.
- Appearance (Profile > Look & feel, Sections): one validated `theme` setting in the on-device SQLite (`src/domain/theme.ts`, falls back to the shipped look if unreadable). Page-wide: mode (auto/light/night), main colour (swatches or any colour), corners, spacing, size, font, shadows. Per section (top bar, status pill, next nap, quick buttons, say-it box, last cards, totals, advice, handoff, bottom bar): own colour, fill (tint/solid/outline) and corners. Sections opt in with `useSection(id)` (`src/ui/themeContext.ts`); colours derive from one `--accent` in `src/index.css`. Sleep and diaper greens stay fixed because they carry meaning.
- Family sharing (`docs/PLAN_SHARING.md`): signed-in caregivers, each with their own Google account, join one household with an invite code (Profile > Family) and see the same log. Each phone keeps its own SQLite plus an outbox (schema v6, `sync_pending`); `src/domain/sync.ts` pushes unsent changes and pulls new ones by change number, on every local change, on app focus, when back online and every 30 seconds (`src/ui/useSync.ts`). Server: `backend/household.ts` (Turso/libSQL; `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`) and `backend/sharing.ts`. Sign-in is required whenever Clerk is configured; guest mode is removed. Tested through the real routes with two phone databases (`backend/sync.test.ts`); not yet tried on two real phones.
- App icon and splash: sources in `assets/*.svg` (purple gradient, lilac crescent moon, green sparkle, matching the in-app logo); `node scripts/make-icons.mjs` renders every PWA, Android and iOS size through headless Edge or Chrome. `npm run android:install` also opens the app after installing.
- Husky pre-commit runs `npm run check` (lint, build, tests including a dev-server smoke test). A post-commit hook (`.husky/post-commit`) runs `npm run android:install` after every commit: it builds the debug APK and installs it if a phone is connected. It never fails the commit; skip it with `SKIP_ANDROID_INSTALL=1`.
- `agent/*.py`, `agent/tests` and `agent/uv.lock` are the old Python agent and can be deleted.

## Run locally

Needs Node 22.13+. Copy `.env.example` to `.env.local`; set `OPEN_ROUTER_API` if it is not already an environment variable.

```bash
npm install
npx vite --host        # http://localhost:5173, API at /api/backend and /api/agent
npm run check          # lint, build, tests
npm run android:install  # build the debug APK; installs on a connected phone, skips the install if none
```

In PowerShell, `npm run dev -- --host` fails; use `npx vite --host`.

## Known gaps

- Sharing: baby name, birth date and tummy goal are not shared yet (phase 4); the assistant still uses the events the phone sends (phase 5). Preview and Production share one Turso database, and Preview has no `CLERK_SECRET_KEY`.
- The old backend SQLite (appointments, agent events) is a file on Vercel and does not persist; only the household log is in Turso.
- `/api/agent` is open unless `CLERK_SECRET_KEY` is set; set it on Vercel before going public.
- Activities and pumping are not in Analytics trends or the agent's `getPredictions` yet; the parser only knows the keywords for the four seeded activity types (a custom type is logged by tapping it).
- The rules parser misses some phrasings it doesn't flag as unclear ("about 60" without ml).
