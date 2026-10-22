# Calendaby

A baby tracker for dads and co-parents. It logs from one sentence, catches duplicates between caregivers, and writes a handoff summary at each shift change. It runs as a PWA and ships to iOS and Android with [Capacitor](https://capacitorjs.com).

## Run it

```bash
npm install
npm run dev      # PWA at http://localhost:5173
npm test         # vitest
npm run build    # typecheck + production build in dist/ (with service worker)
```

## Native apps

Capacitor wraps the `dist/` build, so the web app and the native apps share one codebase.

```bash
npx cap add android   # once; needs Android Studio
npx cap add ios       # once; needs macOS with Xcode
npm run cap:android   # build, sync and open Android Studio
npm run cap:ios       # build, sync and open Xcode
```

## How it is put together

| Path | What it does |
| --- | --- |
| `src/domain/events.ts` | Zod schemas for every event (feed, sleep, diaper, med, note) |
| `src/domain/store.ts` | Append-only event store; validates and rejects duplicates for every writer; `LocalEventStore` persists offline |
| `src/agents/capture.ts` | Capture agent: turns "fed 120 ml at 3, she's down now" into events and returns what it did not understand |
| `src/agents/handoff.ts` | Handoff agent: the 30-second brief for the incoming caregiver |
| `src/useSpeech.ts` | Voice input through the Web Speech API |

The capture agent is rule-based so it works offline and costs nothing. `CaptureAgent` is an interface, so an LLM-backed agent can replace it without touching the UI.

## Roadmap

1. MVP (this): conversational logging, duplicate guard, handoff brief, PWA and Capacitor shells.
2. Calendar: predicted naps and feeds written to Google Calendar, warnings when work meetings collide.
3. Automation: gap detection for missed logs, routine rules, daycare report ingestion from Gmail.
4. Care loop: pediatrician visit prep, parent wellbeing check, multiple children.
