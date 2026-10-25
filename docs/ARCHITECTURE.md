# Architecture

## Pieces

| Part | What it is |
| --- | --- |
| App (`src/`) | React 19 PWA, TypeScript strict, Vite. Capacitor wraps the same build for iOS and Android. |
| Domain (`src/domain/`) | Zod event schemas, duplicate guard, summaries, analytics. Shared by the app, backend and agent. |
| Rules parser (`src/agents/capture.ts`) | Turns "fed 120 ml at 3" into events on the phone, offline. Leftover clauses are sent to the agent. |
| Local database (`src/db/`) | SQLite on the device. Web: SQLite WASM on the origin private file system in a worker, coordinated with a Web Lock so open tabs share it. Native: the Capacitor SQLite plugin. |
| Backend (`backend/`) | Hono routes on SQLite (`node:sqlite`). One POST route per operationId: `recordEvents`, `listEvents`. Every input is required and strict, every operation has a one-line description. |
| Agent (`agent/agent.ts`) | `capture` and `chat` modes using the AI SDK tool loop. Capture tools: `record_events`, `ask_parent`. Chat tools: `listEvents` (backend), `getPredictions`, `getOutlook` (expected next nap, wake, feed and bedtime as ranges, with their basis), `pediatric_guide`, and the Google tools. |
| Knowledge (`src/knowledge/`) | Vetted pediatric guidance (CDC, NIH, WHO, MedlinePlus) with citations, filtered by the baby age from `birth`. `screen()` flags red-flag and dosing questions so the prompt leads with the safe advice. The agent never gives doses or diagnoses. |
| Functions (`api/`) | `/api/agent` validates the request, runs the agent and validates the reply. `/api/backend/*` serves the backend routes. |

## Data flow

- **Log:** text goes through the rules parser. If everything parsed, the events are stored locally and nothing leaves the phone. Unparsed clauses go to `/api/agent` in `capture` mode, which returns draft events or a question. The app stores drafts through the duplicate guard.
- **Sync:** each `/api/agent` call includes the app's latest 500 events. The agent inserts them into the backend (by id, so repeats are ignored) before it runs. The app does not write to the backend directly yet.
- **Ask:** the Agent screen sends the question in `chat` mode. The agent reads the backend log for questions about the day and answers general baby-care questions from its own knowledge. It points to the pediatrician for anything worrying. Event times reach the model in the parent's local time.

## Shared household

Each caregiver signs in with their own Google account through Clerk. A **household** links the accounts to one set of data. Plan and phases: [PLAN_SHARING.md](PLAN_SHARING.md).

```text
 Mom's phone                      Vercel                      Dad's phone
┌───────────────┐         ┌──────────────────┐         ┌───────────────┐
│ UI            │         │ /api/backend/*   │         │ UI            │
│ SQLite (local)│─ push ─▶│ verify Clerk     │◀─ push ─│ SQLite (local)│
│ outbox        │         │ token -> user    │         │ outbox        │
│ lastSeq       │◀─ pull ─│ user -> household│─ pull ─▶│ lastSeq       │
└───────────────┘         │ scoped query     │         └───────────────┘
                          └────────┬─────────┘
                                   ▼
                  Turso (libSQL): household(id, seq)  member(user_id, role)
                  invite(code_hash, expiry)  event(household_id, id, body, seq, deleted_at)
```

- Each phone reads and writes only its own SQLite and works offline. Changes wait in an outbox until they can be sent.
- The server numbers every change for the household (`seq`). A phone remembers the last number it saw and asks for everything after it.
- The household always comes from the verified sign-in, never from the request, so one family cannot see another's data.
- Event ids are unique, so an entry arriving twice is stored once. Deletes are tombstones. Concurrent edits to one entry: the later save wins.
- Phones check after each local change, on app open, every 30 seconds while open, and when the network returns. There is no WebSocket or push.
- Joining: the owner creates a 6-character code (hashed, single use, 48 hours, guess lockout). The second parent signs in, sees whose household it is, accepts, and pulls the history. The owner can remove a member; logs stay.
- Shared: events, baby name, birth date and tummy goal. Per phone: theme, feature switches, units, reminders, display name.
- The assistant reads the household's events from the database, so every caregiver gets answers from the same history.

## Seeds (starting data)

Starting data is not scattered through the code. `src/domain/seeds.ts` holds a list of seeds (features, activity types, age norms, the quick-pick lists, default settings). On open, each phone plants the seeds it has not had yet and records them in `seed_applied`.

- Every seed statement is `INSERT OR IGNORE`: a stored choice is never overwritten, and an item a parent removed does not come back.
- **To add or change a default for everyone,** add a new seed with a new id containing only the new rows. Do not edit a seed that has shipped. Schema changes stay in `MIGRATIONS`; data does not.
- A phone that already ran the old migrations that used to plant a seed has it marked done (`since`), so nothing is planted twice.
- Code reads these through the database (`store.setting()`, `store.options()`, `listFeatures()`), never from the constants.

## Models

OpenRouter only. `MODEL_NAME` picks the model (default `openai/gpt-6-luna`, low reasoning effort). The key comes from the `OPEN_ROUTER_API` environment variable or `.env.local`. Without the key `/api/agent` returns 503 and the app shows the assistant as offline; logging still works.

## Run

Needs Node 22.13 or newer.

```bash
npm install
npx vite --host     # http://localhost:5173; the same server serves /api/agent and /api/backend
```

Settings are in `.env.example`. Environment variables set at user level are read directly; restart the terminal after changing them.

Limits: OPFS and Web Locks need a secure context, so use `localhost` or https. A phone on plain `http://<lan-ip>` may not get durable storage. A SQLite file on Vercel does not persist, so a hosted backend needs Turso or Postgres.

## Test

- `npm run check`: lint, build, and Vitest (unit tests, plus a smoke test that starts the dev server and calls the backend). Husky runs it before every commit. No test calls a model.
- `npx playwright test`: opens every screen in Chrome and asks the agent a question through the real model. Needs the dev server key; not part of the hook.

## Deploy on Vercel

Import the repo, set `OPEN_ROUTER_API`, optionally `MODEL_NAME`, and `AGENT_ALLOWED_ORIGIN` to the production URL. `api/agent.ts` and `api/backend/[...path].ts` become functions. The backend needs hosted storage first (see limits). There is no sign-in yet, so keep the deployment private.

## Decisions

- TypeScript for app, backend and agent, so schemas and logic exist once and also run offline on the phone. The Python agent is dropped.
- OpenRouter only: no AWS, Bedrock or AgentCore, and no Ollama.
- Backend operations are the agent's tools, so the API and the tools cannot drift apart.
- Rules first, model second: most entries cost nothing and work offline.
- Parent text is data, never instructions; the agent is not a doctor.
- Sync: the household is the sync unit. Device SQLite stays the thing the app reads; a hosted libSQL (Turso) database holds changes per household, numbered so each phone can ask for what it has not seen. Chosen over Postgres because the schema and tests match the device and backend SQLite; chosen over WebSockets and push for simplicity; each caregiver keeps their own login.

## Changelog

- Scaffolded the PWA with rules parser, duplicate guard, handoff brief and Capacitor config.
- Replaced the Python agent on AWS with a TypeScript agent in a Vercel function.
- Replaced local storage with SQLite on the device.
- Added the backend and made `listEvents` an agent tool; moved the agent to OpenRouter.
- Added the Agent screen, general baby questions, Husky pre-commit and Playwright tests.
- Fixed the Agent screen crash (scroll effect) and the two-tab database clash.
- Added shared household storage (`backend/household.ts`): households, members, invite codes, scoped, numbered, tombstoned events. Not wired to the app yet.
- Added the seeding mechanism (`seeds.ts`, `seed_applied`, schema v9): starting data is planted once per phone and new defaults reach existing phones as new seeds.
