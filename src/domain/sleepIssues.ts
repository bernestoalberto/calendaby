import { dailyStats } from './analytics.js'
import type { BabyEvent } from './events.js'
import { formatMinutes } from './summary.js'

export type SleepIssueKind = 'double_start' | 'orphan_end' | 'too_long' | 'still_open' | 'day_total'

export interface SleepIssue {
  /** Stable for the same problem, so a notification is sent once. */
  key: string
  kind: SleepIssueKind
  /** The entries to look at; empty for a whole day. */
  eventIds: string[]
  at: number
  message: string
}

/** A single stretch longer than this is more likely a missed wake-up than real sleep. */
export const LONGEST_STRETCH_H = 18
/** Still "asleep" after this long with no wake-up logged. */
export const OPEN_TOO_LONG_H = 14
/** More than this in one calendar day cannot be right: sleep was logged twice or a wake-up was missed. */
export const DAY_TOTAL_H = 20

const HOUR_MS = 3_600_000
const clock = (ms: number) => new Date(ms).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
const dayName = (ms: number) => new Date(ms).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })

/**
 * Entries in the sleep log that cannot all be true, so the parent can fix them. Nothing is changed or guessed: a problem is
 * pointed at, and the totals that depend on it are the parent's to correct.
 */
export function sleepIssues(events: BabyEvent[], now: number): SleepIssue[] {
  const sleeps = events.filter((e): e is Extract<BabyEvent, { kind: 'sleep' }> => e.kind === 'sleep' && e.at <= now).sort((a, b) => a.at - b.at)
  const issues: SleepIssue[] = []
  const add = (kind: SleepIssueKind, eventIds: string[], at: number, message: string) => issues.push({ key: `${kind}:${eventIds.join(',') || at}`, kind, eventIds, at, message })

  let open: (typeof sleeps)[number] | undefined
  for (const e of sleeps) {
    if (e.phase === 'start') {
      if (open) add('double_start', [open.id, e.id], open.at, `Fell asleep at ${clock(open.at)} and again at ${clock(e.at)} with no wake-up between.`)
      open = e
    } else if (!open) {
      add('orphan_end', [e.id], e.at, `Woke up at ${clock(e.at)} with no fell-asleep before it.`)
    } else {
      const hours = (e.at - open.at) / HOUR_MS
      if (hours > LONGEST_STRETCH_H) add('too_long', [open.id, e.id], open.at, `Sleep from ${clock(open.at)} to ${clock(e.at)} is ${formatMinutes(Math.round(hours * 60))}. Check the times.`)
      open = undefined
    }
  }
  if (open && (now - open.at) / HOUR_MS > OPEN_TOO_LONG_H) {
    add('still_open', [open.id], open.at, `Asleep since ${clock(open.at)} (${formatMinutes(Math.round((now - open.at) / 60_000))}). Log the wake-up if they are up.`)
  }

  // A missing wake-up inflates the totals after it, so the root cause is shown first and the totals only when it is clean.
  // Days before today only: today is still being logged.
  if (issues.length > 0) return issues.sort((a, b) => b.at - a.at)
  for (const d of dailyStats(events, 14, now).slice(0, -1)) {
    const hours = (d.nightMin + d.dayMin) / 60
    if (hours > DAY_TOTAL_H) add('day_total', [], d.day, `${dayName(d.day)} shows ${formatMinutes(Math.round(hours * 60))} of sleep. A sleep entry may be doubled or a wake-up missing.`)
  }
  return issues.sort((a, b) => b.at - a.at)
}

/** The entries to mark in the Timeline. */
export const flaggedIds = (issues: SleepIssue[]): Set<string> => new Set(issues.flatMap((i) => i.eventIds))
