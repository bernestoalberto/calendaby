import type { BabyEvent } from './events.js'

export interface DaySummary {
  feeds: number
  feedMl: number
  sleepMinutes: number
  naps: number
  wet: number
  dirty: number
  changes: number
}

/** Totals since local midnight. Sleep that started before midnight counts from midnight. */
export function summarizeDay(events: BabyEvent[], now: Date): DaySummary {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const from = start.getTime()
  const to = now.getTime()
  const s: DaySummary = { feeds: 0, feedMl: 0, sleepMinutes: 0, naps: 0, wet: 0, dirty: 0, changes: 0 }

  let asleepSince: number | undefined
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    if (e.at > to) break
    if (e.kind === 'sleep') {
      if (e.phase === 'start') asleepSince = e.at
      else if (asleepSince !== undefined) {
        const mins = (e.at - Math.max(asleepSince, from)) / 60_000
        if (mins > 0) {
          s.sleepMinutes += mins
          s.naps++
        }
        asleepSince = undefined
      }
      continue
    }
    if (e.at < from) continue
    if (e.kind === 'feed') {
      s.feeds++
      s.feedMl += e.amountMl ?? 0
    } else if (e.kind === 'diaper') {
      s.changes++
      if (e.contents !== 'dirty') s.wet++
      if (e.contents !== 'wet') s.dirty++
    }
  }
  if (asleepSince !== undefined) s.sleepMinutes += Math.max(0, (to - Math.max(asleepSince, from)) / 60_000)
  s.sleepMinutes = Math.round(s.sleepMinutes)
  return s
}

export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

export interface SleepSession {
  start: number
  end?: number
}

/** Pairs sleep starts with the next end. An end with no start before it is ignored. */
export function sleepSessions(events: BabyEvent[]): SleepSession[] {
  const out: SleepSession[] = []
  let open: SleepSession | undefined
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    if (e.kind !== 'sleep') continue
    if (e.phase === 'start') {
      open = { start: e.at }
      out.push(open)
    } else if (open) {
      open.end = e.at
      open = undefined
    }
  }
  return out
}
