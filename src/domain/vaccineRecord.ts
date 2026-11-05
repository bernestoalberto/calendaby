import { CHECKUPS } from '../knowledge/checkups.js'
import { SOURCES, type Source } from '../knowledge/sources.js'
import type { BabyEvent } from './events.js'
import type { VaccineType } from './vaccines.js'

type Vaccine = Extract<BabyEvent, { kind: 'vaccine' }>

export interface RecordedDose {
  id: string
  at: number
  label: string
  dose?: number
  place?: string
  lot?: string
  note?: string
  loggedBy: string
}

/** A vaccine the schedule line names, and how many doses of it are recorded. 0 means "not recorded yet", nothing more. */
export interface ListedMatch {
  label: string
  doses: number
}

export interface ScheduleRow {
  label: string
  items: { text: string; matches: ListedMatch[] }[]
}

export interface VaccineView {
  recorded: RecordedDose[]
  /** The visit at or before the baby's age and the next one, as the CDC schedule lists them. Empty without an age. */
  rows: ScheduleRow[]
  note: string
  sources: Source[]
}

/** "Polio (IPV)" is named as "Polio" or "IPV"; "Hepatitis B" and "Hepatitis A" must stay apart. */
function names(label: string): string[] {
  const full = label.toLowerCase()
  const abbreviation = /\(([^)]+)\)/.exec(label)?.[1]?.toLowerCase()
  const first = full.split(/[\s(]/)[0]
  return [full, ...(abbreviation ? [abbreviation] : []), ...(first.startsWith('hepatitis') || first === full ? [] : [first])]
}

const mentions = (text: string, type: VaccineType) => names(type.label).some((n) => text.toLowerCase().includes(n))

/** The vaccines a schedule line names, each with how many doses of it are recorded. */
export function matchListed(text: string, types: VaccineType[], events: BabyEvent[]): ListedMatch[] {
  const given = events.filter((e): e is Vaccine => e.kind === 'vaccine')
  return types.filter((t) => mentions(text, t)).map((t) => ({ label: t.label, doses: given.filter((g) => g.vaccineId === t.id).length }))
}

/**
 * The vaccination record beside the CDC schedule for the baby's age. It reports what is recorded and what the schedule
 * lists; it never says a dose is due, late or missed, because that is the pediatrician's call.
 */
export function vaccineView(events: BabyEvent[], types: VaccineType[], ageWeeks: number | undefined, region: keyof typeof CHECKUPS = 'us'): VaccineView {
  const given = events.filter((e): e is Vaccine => e.kind === 'vaccine')
  const recorded = given
    .map<RecordedDose>((e) => ({ id: e.id, at: e.at, label: e.label, dose: e.dose, place: e.place, lot: e.lot, note: e.note, loggedBy: e.loggedBy }))
    .sort((a, b) => b.at - a.at)

  const schedule = CHECKUPS[region]
  const rows: ScheduleRow[] = []
  if (ageWeeks !== undefined) {
    const past = schedule.visits.filter((v) => v.at <= ageWeeks).at(-1)
    const next = schedule.visits.find((v) => v.at > ageWeeks)
    for (const visit of [past, next]) {
      if (!visit) continue
      rows.push({
        label: visit.label,
        items: visit.vaccines.map((text) => ({ text, matches: matchListed(text, types, events) })),
      })
    }
  }
  return { recorded, rows, note: schedule.note, sources: schedule.sources.map((id) => SOURCES[id]) }
}
