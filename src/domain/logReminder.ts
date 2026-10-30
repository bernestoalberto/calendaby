import { NIGHT_END_HOUR, NIGHT_START_HOUR, addDays, startOfDay } from './analytics.js'
import type { BabyEvent } from './events.js'
import { sleepSessions } from './summary.js'

const HOUR = 3_600_000

/** What a parent picks in Customize: off, learned from the baby's own logs, or a fixed number of hours. */
export type LogGapSetting = 'off' | 'auto' | number

export const LOG_GAP_CHOICES: LogGapSetting[] = ['auto', 2, 3, 4, 6, 'off']
export const DEFAULT_LOG_GAP: LogGapSetting = 'auto'
const FALLBACK_HOURS = 3

export function parseLogGap(stored: string | undefined): LogGapSetting {
  if (stored === 'off' || stored === 'auto') return stored
  const n = Number(stored)
  return stored !== undefined && n > 0 ? n : DEFAULT_LOG_GAP
}

function morningOf(day: number): number {
  return new Date(day).setHours(NIGHT_END_HOUR, 0, 0, 0)
}

function eveningOf(day: number): number {
  return new Date(day).setHours(NIGHT_START_HOUR, 0, 0, 0)
}

/**
 * The usual quiet stretch in the daytime: the median of each recent day's longest daytime gap between logs, plus
 * half an hour, kept between 2 and 6 hours. Needs three days with logs, otherwise 3 hours.
 */
export function usualGapHours(events: BabyEvent[], now: number, days = 7): number {
  const today = startOfDay(now)
  const longest: number[] = []
  for (let i = 1; i <= days; i++) {
    const day = addDays(today, -i)
    const times = events.filter((e) => e.at >= morningOf(day) && e.at < eveningOf(day)).map((e) => e.at)
    if (times.length < 2) continue
    longest.push(Math.max(...times.slice(1).map((t, j) => t - times[j])))
  }
  if (longest.length < 3) return FALLBACK_HOURS
  longest.sort((a, b) => a - b)
  const median = longest[Math.floor(longest.length / 2)] / HOUR
  return Math.min(6, Math.max(2, Math.round((median + 0.5) * 2) / 2))
}

export interface LogGap {
  /** Nothing yet today (since the morning), or a gap since the last log. */
  kind: 'today' | 'gap'
  /** When the quiet stretch started: the last log, or the morning when nothing was logged today. */
  since: number
  hours: number
  /** When the reminder is (or was) due. */
  dueAt: number
}

/**
 * The next "nothing logged" reminder. Night hours are quiet and a sleeping baby is not a missing log, so the
 * stretch counts only from the morning and never while a sleep is running. Undefined when switched off or asleep.
 */
export function logGap(events: BabyEvent[], setting: LogGapSetting, now: number): LogGap | undefined {
  if (setting === 'off') return undefined
  const sleep = sleepSessions(events).at(-1)
  if (sleep && sleep.end === undefined) return undefined
  const hours = setting === 'auto' ? usualGapHours(events, now) : setting
  const today = startOfDay(now)
  const last = events.at(-1)?.at ?? 0
  const dueFrom = (day: number) => {
    const since = Math.max(last, morningOf(day))
    return { kind: last < day ? 'today' : 'gap', since, hours, dueAt: since + hours * HOUR } as const
  }
  const due = dueFrom(today)
  return due.dueAt < eveningOf(today) ? due : dueFrom(addDays(today, 1))
}

/** True when the reminder should show now: it is due and it is daytime. */
export function isOverdue(gap: LogGap | undefined, now: number): gap is LogGap {
  const today = startOfDay(now)
  return gap !== undefined && now >= gap.dueAt && now < eveningOf(today)
}
