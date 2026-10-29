# Pediatric knowledge

A small, curated set of pediatric guidance the agent and the app answer from, so advice comes from cited public sources instead of the model's memory. It runs on the phone and in the agent; no network and no vector database.

## Design

- Lookup by topic and age in weeks. Each fact has an age band and one source. `guide(topic, ageWeeks)` returns the matching facts with numbered citations, or a note when there is no vetted guidance.
- Topics: sleep, safe-sleep, feeding, solids, diapers, milestones, checkups, red-flags, medicine. Wake windows and leaps return a note saying no agency publishes them.
- `screen(text, ageWeeks)` is a keyword safety net for red flags and dosing questions in a parent's message. The agent leads with the matching advice.
- Checkups are per region (`us` for now). Add a region to `CHECKUPS` to swap the schedule.
- Sources: CDC, NIH Safe to Sleep, WHO, MedlinePlus. AAP is linked, never quoted. `GUIDE_RULES` tells the agent to cite, never diagnose or dose, and say when it does not know.

## Growth, milestones and sleep ranges

- `milestones.ts`: the CDC "Learn the Signs. Act Early." checklists, 2 months to 3 years, reviewed 2026-10-29. Each item has a stable id (`6-movement-1`). They are planted into the `milestone` table; a parent's answers are events.
- `src/domain/growthReference.ts` is generated from the WHO Child Growth Standards (as published by the CDC) by `scripts/make-growth-reference.mjs`. Do not edit it by hand; to refresh, download the six CSVs from https://www.cdc.gov/growthcharts/who-data-files.htm into a folder and run the script with that folder.
- `src/domain/sleepGoal.ts` holds the CDC sleep ranges by age (14 to 17 h, 12 to 16 h, 11 to 14 h, 10 to 13 h), planted into `sleep_need`.

## Updating

Edit the text in `guidance.ts`, `red-flags.ts` or `checkups.ts`, keep the source id accurate, and update the review date in `sources.ts`. US vaccine recommendations changed several times in 2025 and 2026; recheck `checkups.ts` before each release.
