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

- The app still writes to its own SQLite; the backend only receives events when the agent is called. Full sync and sign-in are next.
- A SQLite file on Vercel does not persist; hosted storage needs Turso or Postgres.
- `/api/agent` is open unless `CLERK_SECRET_KEY` is set; set it on Vercel before going public.
- The rules parser misses some phrasings it doesn't flag as unclear ("about 60" without ml).
