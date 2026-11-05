# Plan: agentic RAG over the baby's own data, on the phone

**Status: planned, nothing built.** Rewritten after the owner chose: agentic (the model decides when to search), over the baby's own data, searched on the phone.

Goal: the assistant can find things in the baby's own log by meaning or words, not only by the fixed reports: "when did we last note a rash?", "what did the doctor say about the cough?", "what did she eat before the last fussy night?". Today it only has `listEvents` (latest events), the reports, and `guide()`.

## Decisions

- **Agentic.** A new tool `searchLog(query, from?, to?, kinds?, limit?)` in the existing tool loop. The model chooses when to call it and can call it again with a changed query. It sits next to `getGrowth`, `getMilestones`, `guide()`; the tool description says to use the reports first and the search for free-text questions.
- **The data and the search stay on the phone** (the on-device SQLite is the source of truth, and the baby's text is not sent to a separate embedding service). What the model reads is still sent to the model provider, as the events from `listEvents` already are; that is unchanged and is said in the Profile privacy text.
- **The tool runs on the phone, not the server.** `/api/agent` is a stateless function that today gets the data inside the request. A search needs the local database, so `searchLog` is a client-side tool (the AI SDK supports tools without `execute`): the server returns the tool call, the phone runs the search and posts the result, and the loop continues. **To verify in phase 1:** that this fits the Vercel function limits and the current request/response shape in `src/agents/`, and what happens if the phone goes offline mid-loop (the answer must say it could not search, never guess).
- **Retrieval method, in two steps (keep it simple, rule 1):**
  1. **Keyword search with SQLite FTS5** over event notes and free text, filtered by date and kind. No model, no new package, offline. **To verify:** that FTS5 is compiled into both the WASM build on the web and the Capacitor SQLite plugin.
  2. **Meaning search (embeddings) only if step 1 misses in the evals.** A small embedding model would run on the phone; that means a new package and a model file, so rule 8 applies (size, licence, maintained, Windows/macOS/Linux, iOS and Android). Not decided now.
- **What is indexed:** event notes, medicine and symptom text, appointment titles, milestone and growth notes, vaccine notes (once `PLAN_VACCINES.md` ships). Shared entries from the other parent are included; the index is built from the local database, so the model never sees what the phone does not have.
- **Index is data (rule 9):** an `FTS` virtual table rebuilt from `events`; a settings key for the result limit and the cap on returned characters. A schema bump with a migration that fills it, and triggers keep it current on insert, edit and delete.
- **Output is data, never instructions** (rule 4). Each hit is returned as `{ id, when, kind, text }` with text capped and stripped of markup; the agent rules say to cite the entry's date and to say when nothing was found. `GUIDE_RULES` still applies: not a doctor, red flags lead with the pediatrician.
- **No new tool for the browser's assistant yet.** `search_log` for WebMCP can follow once the agent version is proven, with an eval case.
- **Guards:** capped steps (already `stopWhen`), capped calls to `searchLog` per answer, signed-in as today. The tool is absent when the switch `aiSearch` is off; everything else works as now.

## Phases

1. **Check the platform.** FTS5 on web and native; the client-side tool loop against `/api/agent`. Done when: both are tried on a throwaway branch and the findings are written here, or this plan changes.
2. **Index.** FTS table, migration, triggers, `searchLog` function with date and kind filters. Done when: tests on a real in-memory SQLite find an entry by a word, respect the date and kind filters, drop an entry from the index when it is deleted, and show an edited entry's new text.
3. **Agent loop.** Client-side tool, stub-model test, prompt rules, switch `aiSearch`. Done when: with the stub model, "when did we last note a rash?" calls `searchLog`, the answer cites the entry's date, no hit gives "I could not find that in your log", and a note that says "ignore your rules" is not followed.
4. **Evals.** A small set of questions with the entries each should find, in `evals/`. Done when: the keyword search finds the expected entries; any miss is the case that justifies step 2 of the method, and the result is written here.
5. **Meaning search (only if phase 4 shows misses).** Decide the embedding model with rule 8 answers; add vectors beside the FTS index. Done when: the evals that missed now pass without the ones that passed failing.
6. **Docs.** `STATUS.md`, `ARCHITECTURE.md`, the Profile privacy text.

## Open for the owner

- Is keyword search first, with embeddings only if it falls short, acceptable? It is smaller, offline and ships sooner.
- Is a loop that needs the phone online and awake (it does the searches) acceptable for the chat tab?
- The cited public documents idea from the earlier version of this plan (CDC, WHO, MedlinePlus passages in a database) is dropped from this plan; say so if you still want it as a separate plan.

## Not in scope

Searching public documents, a server-side copy of the index, searching other families' data, and a local chat model.
