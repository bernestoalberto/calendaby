# Status

## Built

- PWA with conversational logging, duplicate guard, handoff brief, Ask box, voice input.
- Capacitor Android project generated (`android/`, synced with `npm run cap:sync`); CI builds `calendaby-debug-apk`.
- Hybrid capture: the rules parser handles what it can on the phone; leftovers go to the agent.
- `backend/`: Hono routes on SQLite (`node:sqlite`), one POST route per operationId (`recordEvents`, `listEvents`).
- `agent/agent.ts`: capture and chat modes. `listEvents` is a backend operation used as a tool. Each agent call first syncs the app's events into the backend.
- Model from `MODEL_NAME`: OpenRouter, default `openai/gpt-6-luna`.
- Husky pre-commit runs `npm run check` (lint, build, tests including a dev-server smoke test).
- `agent/*.py`, `agent/tests` and `agent/uv.lock` are the old Python agent and can be deleted.

## Run locally

Needs Node 22.13+. Copy `.env.example` to `.env.local`; set `OPEN_ROUTER_API` if it is not already an environment variable.

```bash
npm install
npx vite --host        # http://localhost:5173, API at /api/backend and /api/agent
npm run check          # lint, build, tests
```

In PowerShell, `npm run dev -- --host` fails; use `npx vite --host`.

## Known gaps

- The app still writes to its own SQLite; the backend only receives events when the agent is called. Full sync and sign-in are next.
- A SQLite file on Vercel does not persist; hosted storage needs Turso or Postgres.
- `/api/agent` has no sign-in, so keep it off the public internet.
- The rules parser misses some phrasings it doesn't flag as unclear ("about 60" without ml).
