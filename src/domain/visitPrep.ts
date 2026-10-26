import { CHECKUPS } from '../knowledge/checkups.js'
import { weeksOld } from '../knowledge/index.js'
import { RED_FLAGS } from '../knowledge/red-flags.js'
import { SOURCES, type Source } from '../knowledge/sources.js'
import type { Appointment } from './appointments.js'
import { LEAVE_LEAD_MS } from './appointmentAlerts.js'
import type { BabyEvent } from './events.js'
import { feedForecast } from './predictions.js'
import { formatMinutes } from './summary.js'

export interface PrepLine {
  text: string
  source: Source
}

export interface VisitPrep {
  /** Cited facts about the visit, from the curated pediatric knowledge. Empty when it is not a checkup. */
  expect: PrepLine[]
  /** Practical steps built from the baby's own log. */
  plan: string[]
}

const CHECKUP_TITLE = /check-?up|well[- ]?(baby|child|visit)|pediatric|vaccin|immuni[sz]|\bshots?\b|\b\d+[- ]?(week|month|year)s?\b/i
// A scheduled visit within this many weeks of the baby's age on the day is that visit.
const SAME_VISIT_WEEKS = 3

function clockText(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function expectations(ageWeeks: number): PrepLine[] {
  const schedule = CHECKUPS.us
  const nearest = schedule.visits.reduce((best, v) => (Math.abs(v.at - ageWeeks) < Math.abs(best.at - ageWeeks) ? v : best))
  if (Math.abs(nearest.at - ageWeeks) > SAME_VISIT_WEEKS) return []

  const lines: PrepLine[] = [
    { text: `This looks like the ${nearest.label} checkup. The doctor usually checks growth, feeding, sleep and development.`, source: SOURCES.medlineWellChild },
  ]
  if (nearest.vaccines.length > 0) {
    lines.push({ text: `Vaccines usually offered: ${nearest.vaccines.join('; ')}. ${schedule.note}`, source: SOURCES.cdcVaccines })
    const fever = RED_FLAGS.find((f) => f.id.startsWith('fever') && ageWeeks >= f.from && ageWeeks < f.to)
    if (fever) lines.push({ text: `If there is a fever after the visit: ${fever.say}`, source: SOURCES[fever.source] })
  }
  return lines
}

/**
 * What to expect at an appointment and how to fit it around the baby's day. Facts come from the cited knowledge in
 * `src/knowledge/`, never from a model's memory; the plan comes from the baby's own log.
 */
export function visitPrep(a: Appointment, baby: string, birth: string | undefined, events: BabyEvent[], now: number): VisitPrep {
  const start = a.startsAt
  if (start === undefined) return { expect: [], plan: [] }

  const plan = [`Leave by ${clockText(start - LEAVE_LEAD_MS)}.`]
  const feed = feedForecast(events, now)
  if (feed) {
    plan.push(`${baby} usually feeds about every ${formatMinutes(feed.intervalMin)}. Plan a feed 30 to 45 minutes before the visit.`)
  }
  plan.push('Pack diapers, a change of clothes and something for a feed.')

  if (!CHECKUP_TITLE.test(a.title)) return { expect: [], plan }

  const age = weeksOld(birth, start)
  if (age === undefined) {
    plan.push('Add the birth date in Profile to see what is usually covered at this visit.')
    return { expect: [], plan }
  }
  return { expect: expectations(age), plan }
}
