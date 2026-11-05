# Plan: vaccination record

**Status (2026-11-05): phases 1 to 4 built and tested (see `docs/STATUS.md`); phase 5 is the docs, kept current as each phase lands.** Change from the plan: the date uses the Logger's existing "When" control, so a dose is stamped with the time it is logged unless the parent adjusts it. Phase 2: a line that names more than one vaccine shows each one's dose count instead of one number, and the screen is opened from a Vaccines card on Today. Phase 3: place, lot and notes never go to the assistant (stripped on the phone), and visit prep's line is part of the plan, not the cited "what to expect" list, because it comes from the baby's own record.

Goal: the parent keeps the baby's vaccination record in the app, sees what the CDC schedule lists for the baby's age next to what is recorded, and both parents share it. It does not depend on `PLAN_RAG.md`.

## Decisions

- **A vaccination is an event.** New kind `vaccine` with `vaccineId` (a row of the vaccine catalog), optional `dose` (1 to 5), the date given, and optional `place`, `lot` and `notes` (capped length). It rides the existing log, so sync, the household, the Timeline edit sheet and duplicate-free ids work without a second pipeline, as `measure` and `milestone` do.
- **The catalog is data (rule 9).** Table `vaccine_type` (id, label, short name, sort order, doses in the series) planted by a versioned seed from the vaccines already named in `src/knowledge/checkups.ts`. A parent can add a custom entry (for travel vaccines); seeds never overwrite.
- **Due is shown, not decided.** The Vaccines screen lists the CDC schedule row for the baby's age (from `checkups.ts`, cited) next to what is recorded. Wording: "listed for this age, not recorded yet"; never "overdue", "behind" or "missed". The existing note stays: recommendations changed in 2025 and 2026, confirm with the pediatrician.
- **Visit prep reuses the record.** `visitPrep.ts` marks the listed vaccines that are already recorded.
- **Assistant tool `getVaccines`.** Returns the recorded doses and the schedule row for the age, with sources, sent in the request like `measures` and `marks`. `GUIDE_RULES` gains: never say a vaccine is overdue, never advise skipping or delaying one, point to the pediatrician.
- **WebMCP:** a read-only `get_vaccines`. No write tool: recording a dose is the parent's tap, as with milestones.
- **Health data stays in the household.** It syncs only to the family, like the log. Nothing new goes to analytics. A photo of a paper card is out of scope.
- **Switch:** `vaccines` in the `features` table, like `growth`.

## Phases

1. **Record.** `vaccine` event, `vaccine_type` seed (schema bump), Zod rules (known id, a date not in the future, dose range), Log > Vaccines form, Timeline entry and edit. Done when: a record survives a reload; two phones see the same record after one sync; a future date or unknown vaccine is refused; signed-out use works.
2. **Screen.** Vaccines screen: recorded doses by date, the schedule row for the age, the switch. Done when: the screen shows both lists with their sources; turning the switch off hides the tab and the screen.
3. **Visit prep and assistant.** Recorded marks in visit prep, `getVaccines`, prompt rules. Done when: a stubbed-model test shows the tool returns only stored doses; a test over the wording finds no "overdue" or "behind"; "is she up to date?" answers with the schedule and "confirm with your pediatrician".
4. **WebMCP and evals.** `get_vaccines`, cases in `evals/webmcp/evals.json`, `schema.json` regenerated. Done when: `npm test` shows `schema.json` identical to the registered tools and every case passes.
5. **Docs.** `STATUS.md`, `ARCHITECTURE.md`, `src/knowledge/README.md`.

## Open for the owner

- On by default, or off until a parent turns it on?
- The schedule is US (CDC). Another country means another `CHECKUPS` entry.

## Not in scope

Photo or PDF of a vaccine card, reminders for the next dose, a catch-up calculator, and sending the record to a school or clinic.
