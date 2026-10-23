import type { BabyEvent } from './events.js'
import { sleepSessions } from './summary.js'

/** Sleep between 7 pm and 7 am counts as night sleep. */
export const NIGHT_START_HOUR = 19
export const NIGHT_END_HOUR = 7

export interface DayStats {
  day: number // local midnight, epoch ms
  nightMin: number
  dayMin: number
  naps: number
  feeds: number
  nursing: number
  bottles: number
  bottleMl: number
  wet: number
  dirty: number
}

function at(day: number, hour: number): number {
  const d = new Date(day)
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}

export function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function addDays(day: number, n: number): number {
  const d = new Date(day)
  d.setDate(d.getDate() + n)
  return startOfDay(d.getTime())
}

function overlap(a: number, b: number, from: number, to: number): number {
  return Math.max(0, Math.min(b, to) - Math.max(a, from))
}

export function dailyStats(events: BabyEvent[], days: number, now: number): DayStats[] {
  const sessions = sleepSessions(events).map((s) => ({ start: s.start, end: s.end ?? now }))
  const today = startOfDay(now)
  const out: DayStats[] = []
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i)
    const next = addDays(day, 1)
    const morning = at(day, NIGHT_END_HOUR)
    const evening = at(day, NIGHT_START_HOUR)
    const s: DayStats = { day, nightMin: 0, dayMin: 0, naps: 0, feeds: 0, nursing: 0, bottles: 0, bottleMl: 0, wet: 0, dirty: 0 }
    for (const { start, end } of sessions) {
      const night = overlap(start, end, day, morning) + overlap(start, end, evening, next)
      const daytime = overlap(start, end, morning, evening)
      s.nightMin += night / 60_000
      s.dayMin += daytime / 60_000
      if (start >= morning && start < evening) s.naps++
    }
    for (const e of events) {
      if (e.at < day || e.at >= next) continue
      if (e.kind === 'feed') {
        s.feeds++
        if (e.method === 'breast') s.nursing++
        if (e.method === 'bottle') {
          s.bottles++
          s.bottleMl += e.amountMl ?? 0
        }
      } else if (e.kind === 'diaper') {
        if (e.contents !== 'dirty') s.wet++
        if (e.contents !== 'wet') s.dirty++
      }
    }
    s.nightMin = Math.round(s.nightMin)
    s.dayMin = Math.round(s.dayMin)
    out.push(s)
  }
  return out
}

export interface NapForecast {
  wakeWindowMin: number
  awakeSince?: number
  nextNapAt?: number
}

const MIN_WINDOWS = 3

/** Next nap from this baby's own recent wake windows; undefined until there are enough to average. */
export function napForecast(events: BabyEvent[], now: number): NapForecast | undefined {
  const sessions = sleepSessions(events)
  const since = now - 3 * 24 * 3_600_000
  const gaps: number[] = []
  for (let i = 1; i < sessions.length; i++) {
    const prevEnd = sessions[i - 1].end
    const start = sessions[i].start
    if (prevEnd === undefined || prevEnd < since) continue
    const gap = start - prevEnd
    // Ignore missed logs (very long gaps) and brief stirrings.
    if (gap >= 15 * 60_000 && gap <= 6 * 3_600_000) gaps.push(gap)
  }
  if (gaps.length < MIN_WINDOWS) return undefined
  const wakeWindowMin = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length / 60_000)
  const last = sessions.at(-1)
  if (!last || last.end === undefined) return { wakeWindowMin }
  return { wakeWindowMin, awakeSince: last.end, nextNapAt: last.end + wakeWindowMin * 60_000 }
}
