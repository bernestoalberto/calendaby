# Pediatric knowledge

A small, curated set of pediatric guidance the agent and the app answer from, so advice comes from cited public sources instead of the model's memory. It runs on the phone and in the agent; no network and no vector database.

## Design

- Lookup by topic and age in weeks. Each fact has an age band and one source. `guide(topic, ageWeeks)` returns the matching facts with numbered citations, or a note when there is no vetted guidance.
- Topics: sleep, safe-sleep, feeding, solids, diapers, milestones, checkups, red-flags, medicine. Wake windows and leaps return a note saying no agency publishes them.
- `screen(text, ageWeeks)` is a keyword safety net for red flags and dosing questions in a parent's message. The agent leads with the matching advice.
- Checkups are per region (`us` for now). Add a region to `CHECKUPS` to swap the schedule.
- Sources: CDC, NIH Safe to Sleep, WHO, MedlinePlus. AAP is linked, never quoted. `GUIDE_RULES` tells the agent to cite, never diagnose or dose, and say when it does not know.

## Updating

Edit the text in `guidance.ts`, `red-flags.ts` or `checkups.ts`, keep the source id accurate, and update the review date in `sources.ts`. US vaccine recommendations changed several times in 2025 and 2026; recheck `checkups.ts` before each release.
