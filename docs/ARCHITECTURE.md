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

## Changelog

- Scaffolded the PWA with rules parser, duplicate guard, handoff brief and Capacitor config.
- Replaced the Python agent on AWS with a TypeScript agent in a Vercel function.
- Replaced local storage with SQLite on the device.
- Added the backend and made `listEvents` an agent tool; moved the agent to OpenRouter.
- Added the Agent screen, general baby questions, Husky pre-commit and Playwright tests.
- Fixed the Agent screen crash (scroll effect) and the two-tab database clash.
