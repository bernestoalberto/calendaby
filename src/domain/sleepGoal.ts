import type { DayStats } from './analytics.js'

/** One row of the `sleep_need` table: how many hours in 24 the CDC says babies of an age need, naps included. */
export interface SleepNeed {
  fromWeeks: number
  toWeeks: number
  lowHours: number
  highHours: number
}

export const SLEEP_NEED_SOURCE = 'CDC, About Sleep (https://www.cdc.gov/sleep/about/index.html)'

const WEEKS_PER_MONTH = 30.44 / 7

/** Seed for a fresh database: the CDC ranges for babies, infants, toddlers and young children. */
export const DEFAULT_SLEEP_NEEDS: SleepNeed[] = [
  { fromWeeks: 0, toWeeks: Math.round(4 * WEEKS_PER_MONTH), lowHours: 14, highHours: 17 },
  { fromWeeks: Math.round(4 * WEEKS_PER_MONTH), toWeeks: Math.round(12 * WEEKS_PER_MONTH), lowHours: 12, highHours: 16 },
  { fromWeeks: Math.round(12 * WEEKS_PER_MONTH), toWeeks: Math.round(36 * WEEKS_PER_MONTH), lowHours: 11, highHours: 14 },
  { fromWeeks: Math.round(36 * WEEKS_PER_MONTH), toWeeks: Math.round(72 * WEEKS_PER_MONTH), lowHours: 10, highHours: 13 },
]

export function needFor(needs: SleepNeed[], weeks: number | undefined): SleepNeed | undefined {
  return weeks === undefined ? undefined : needs.find((n) => weeks >= n.fromWeeks && weeks < n.toWeeks)
}

export interface SleepGoal {
  hours: number
  /** The range for the baby's age, when known. */
  range?: { low: number; high: number }
  /** Where the number came from. */
  basis: 'set' | 'age' | 'log'
}

/** Days of the baby's own log needed before it moves the goal; fewer days say little. */
export const OWN_LOG_DAYS = 3
/** A day with less than this logged is a day the log was skipped, not a day of little sleep. */
const LOGGED_DAY_MIN = 4 * 60

const halfHour = (h: number) => Math.round(h * 2) / 2

/**
 * The daily sleep goal. Set by hand: that number. Automatic: the middle of the CDC range for the baby's age, moved toward
 * the baby's own recent total when at least three full days were logged, and never outside the range. A newborn's goal
 * can be above 15 hours because the range goes up to 17. `days` are the completed days, today excluded.
 */
export function smartSleepGoal(opts: { auto: boolean; setHours: number; need?: SleepNeed; days: DayStats[] }): SleepGoal {
  const { auto, setHours, need, days } = opts
  const range = need && { low: need.lowHours, high: need.highHours }
  if (!auto || !need) return { hours: setHours, range, basis: 'set' }

  const totals = days.map((d) => d.nightMin + d.dayMin).filter((m) => m >= LOGGED_DAY_MIN)
  if (totals.length < OWN_LOG_DAYS) return { hours: halfHour((need.lowHours + need.highHours) / 2), range, basis: 'age' }
  const own = totals.reduce((a, b) => a + b, 0) / totals.length / 60
  return { hours: Math.min(need.highHours, Math.max(need.lowHours, halfHour(own))), range, basis: 'log' }
}

/** "typical 14 to 17 h for your baby's age", for under the goal. */
export function goalNote(goal: SleepGoal): string | undefined {
  if (!goal.range) return undefined
  const typical = `typical ${goal.range.low} to ${goal.range.high} h for this age`
  return goal.basis === 'log' ? `Based on recent days, ${typical}` : goal.basis === 'age' ? `Set by age, ${typical}` : `${typical[0].toUpperCase()}${typical.slice(1)}`
}
