import { addDays, startOfDay } from './analytics.js'
import type { BabyEvent } from './events.js'

export interface ActivityDay {
  day: number // local midnight, epoch ms
  /** Minutes per activity type id; a type logged without a duration shows 0. */
  byType: Record<string, number>
  totalMin: number
  sessions: number
}

/** Activity minutes for each of the last `days` days, oldest first. Pumping is not an activity. */
export function activityDays(events: BabyEvent[], days: number, now: number): ActivityDay[] {
  const today = startOfDay(now)
  const out: ActivityDay[] = []
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i)
    const next = addDays(day, 1)
    const entry: ActivityDay = { day, byType: {}, totalMin: 0, sessions: 0 }
    for (const e of events) {
      if (e.kind !== 'activity' || e.at < day || e.at >= next) continue
      entry.byType[e.type] = (entry.byType[e.type] ?? 0) + (e.durationMin ?? 0)
      entry.totalMin += e.durationMin ?? 0
      entry.sessions++
    }
    out.push(entry)
  }
  return out
}
