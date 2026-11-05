import type { BabyEvent } from './events.js'
import { vaccineView } from './vaccineRecord.js'
import { DEFAULT_VACCINE_TYPES } from './vaccines.js'

type Vaccine = Extract<BabyEvent, { kind: 'vaccine' }>

/** A vaccine entry without where it was given, the lot number and the note; other entries are unchanged. Used before anything goes to the assistant. */
export function vaccineWithoutDetails(e: Vaccine): Vaccine {
  const { place: _place, lot: _lot, note: _note, ...rest } = e
  return rest
}

export const withoutVaccineDetails = (e: BabyEvent): BabyEvent => (e.kind === 'vaccine' ? vaccineWithoutDetails(e) : e)

const RULES =
  "State only the doses and the CDC schedule lines in this result. Never say a vaccine is due, overdue, late, missed or that the baby is up to date or behind, and never advise giving, skipping or delaying one: what is due is the pediatrician's decision. Say the schedule changed in 2025 and 2026 and to confirm with the pediatrician."

/**
 * What the assistant may know about the vaccination record: each dose's vaccine, dose number and date, and the CDC schedule
 * lines for the baby's age with how many doses are recorded. Place, lot number and notes are not included.
 */
export function vaccineReport(vaccines: Vaccine[], ageWeeks: number | undefined, dateOf: (ms: number) => string) {
  const view = vaccineView(vaccines, DEFAULT_VACCINE_TYPES, ageWeeks)
  return {
    recorded: view.recorded.map((r) => ({ vaccine: r.label, ...(r.dose ? { dose: r.dose } : {}), date: dateOf(r.at) })),
    listedForAge: view.rows.map((row) => ({
      visit: row.label,
      items: row.items.map((i) => ({
        text: i.text,
        recorded: i.matches.map((m) => (m.doses === 0 ? `${m.label}: not recorded yet` : `${m.label}: ${m.doses} ${m.doses === 1 ? 'dose' : 'doses'} recorded`)),
      })),
    })),
    ...(ageWeeks === undefined ? { ageNote: "The birth date is not set, so the schedule for the baby's age is not shown. Ask the parent to add the birth date in Profile." } : {}),
    scheduleNote: view.note,
    sources: view.sources,
    rules: RULES,
  }
}
