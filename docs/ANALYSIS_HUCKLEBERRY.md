# Huckleberry analysis

Why: Mom's point is that Huckleberry's paid tier ("Gold") holds the features parents value, so it is the best map of what to build. The screenshots (2026-10-23) show its Reports > List view: sleep, bottle, and **tummy time** entries, with sleep rows carrying place, mood and timer icons.

Source: the screenshots plus general knowledge of the app. Not checked live against the current Huckleberry release; confirm pricing and the free/paid split before relying on them.

## What the screenshots show

| Seen in Huckleberry | Calendaby today |
| --- | --- |
| Tummy time as its own tracked activity, with start/end and duration ("3m, 2:31-2:34 PM") | Not tracked. Only feed, sleep, diaper, medicine, note (`src/domain/events.ts`). |
| Sleep rows with place (crib, stroller), mood (fell asleep how) and timer-vs-manual icons | Sleep is start/end only. |
| Bottle row says "4oz of Formula" | Same data (amount + milk type); matches. |
| Reports tabs: Day, Week, List, Summary, by week | Today, Timeline, Analytics. No week grid view. |
| Berry (AI assistant), Sleep Plans, Insights | Ask box, predictions and advice, rhythm insights. Similar ground. |

## Gap list, ranked by value to a dad mid-shift

1. **Activities: tummy time first, then bath, outdoor play, indoor play.** Small, same shape as sleep (start/end or minutes). Daycare reports and pediatricians ask about tummy time daily. Easy to fit the one-sentence logging ("tummy time 5 min") and the handoff ("tummy time today: 14m").
2. **Sleep detail:** where (crib, stroller, car, arms) and how (nursed, bottle, self-settled, rocked). Feeds the predictions and answers "what works for naps".
3. **Growth:** weight, height, head size with dates, plus a percentile chart. Common doctor-visit need and pairs with the Calendar tab.
4. **Pumping and breast-milk stash**, if the household pumps. Skip otherwise.
5. **Temperature and symptoms.** Fits next to medicine; the medicine card should be able to show "last dose + next allowed time".
6. **Week and day timeline grids** (sleep as blocks across the week). Strong for spotting a pattern at a glance; our Analytics has trends but no grid.
7. **Milestones, photos, daily summary share** (a text or image to send to grandparents, as Mom just did with a screenshot). A "copy today's summary" button covers most of it cheaply.
8. **Sleep plans / coaching by age.** Content-heavy; the predictions and advice already cover the core. Defer.
9. **Reminders and shared caregivers.** Reminders are built; sync between both parents is the "Next" item in the spec and the real moat versus a single-phone app.

## What Calendaby already does that Huckleberry does not

- One typed or spoken sentence logs several things, with anything not understood shown back, never guessed.
- Duplicate guard across two caregivers.
- 30-second handoff brief aimed at the incoming caregiver.
- Works offline; the assistant is optional.
- Gmail appointment import and a calendar that flags clashes with predicted naps.

Keep these in front: do not copy Huckleberry's tap-heavy forms.

## Decisions (2026-10-23)

The owner chose to build activities (tummy time first) now, and pumping applies to this household. Both are built; see `docs/STATUS.md`. Sleep detail and growth are next.

## Recommended first build (done)

**Tummy time as an activity event.** Concretely:

- New `activity` event: `{ kind: 'activity', type: 'tummy' | 'bath' | 'outdoor' | 'indoor', durationMin? }`, validated in `events.ts` and the draft schema.
- Activity types live in a SQLite table, not a constant (working rule 9), so more can be added without code.
- Rules parser: "tummy time 5 min", "bath". Anything ambiguous goes to the agent.
- Timeline row and edit sheet; Today total ("Tummy time 14m"); handoff line; analytics 7-day trend; feature switch in the `features` table.
- Tests first for parser, summary and store (rule 5).

Estimate: one focused change, touching `events.ts`, `capture.ts`, `summary.ts`, `store.ts` (schema v3), `kinds.tsx`, `EditSheet.tsx`, `Today.tsx`, `features.ts`.

