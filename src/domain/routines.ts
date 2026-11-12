import { z } from 'zod'
import type { NapAlert } from './notifications.js'

/** Ids 2000+ are routine reminders, one per routine; appointments use 1000+. */
export const ROUTINE_ID_BASE = 2000
export const MAX_ROUTINES = 20

/** Active routines show on Today and remind; paused ones are kept for later; done ones are finished and kept for the record. */
export const ROUTINE_STATES = ['active', 'paused', 'done'] as const
export type RoutineState = (typeof ROUTINE_STATES)[number]

/** Weekdays as `Date.getDay()` gives them: 0 is Sunday. */
export const RoutineDraft = z.object({
  name: z.string().trim().min(1, 'Give the routine a name').max(40, 'Keep the name under 40 characters'),
  /** The first day the routine runs, YYYY-MM-DD on the parent's calendar; '' when it has no start date (the starter routine). */
  date: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a start date')]),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Pick a start time'),
  days: z.array(z.number().int().min(0).max(6)).min(1, 'Pick at least one day').max(7),
  steps: z.array(z.string().trim().min(1).max(60, 'Keep each step under 60 characters')).max(12, 'Keep it to 12 steps or fewer'),
  remind: z.boolean(),
  state: z.enum(ROUTINE_STATES),
})
export type RoutineDraft = z.infer<typeof RoutineDraft>

export const Routine = RoutineDraft.extend({ id: z.string().min(1).max(40) })
export type Routine = z.infer<typeof Routine>

export function routineProblem(draft: RoutineDraft): string | undefined {
  const parsed = RoutineDraft.safeParse(draft)
  return parsed.success ? undefined : parsed.error.issues[0]?.message
}

/** When the routine starts on the local calendar day that contains `dayMs`. */
export function startOn(r: Pick<Routine, 'time'>, dayMs: number): number {
  const [h, m] = r.time.split(':').map(Number)
  const d = new Date(dayMs)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

export interface Scheduled {
  routine: Routine
  at: number
}

/** True when an active routine runs on the local day that contains `dayMs`. */
function runsOn(r: Routine, dayMs: number): boolean {
  return r.state === 'active' && r.days.includes(new Date(dayMs).getDay()) && (r.date === '' || localDate(dayMs) >= r.date)
}

/** YYYY-MM-DD on the parent's clock. */
function localDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The routines set for today, earliest first. */
export function routinesToday(routines: Routine[], now: number): Scheduled[] {
  return routines
    .filter((r) => runsOn(r, now))
    .map((r) => ({ routine: r, at: startOn(r, now) }))
    .sort((a, b) => a.at - b.at)
}

/** The next start of one routine from `now` on, from its start date if that is later, looking a week ahead. */
function nextStart(r: Routine, now: number): number | undefined {
  const [y, m, d] = r.date.split('-').map(Number)
  const from = r.date === '' ? now : Math.max(now, new Date(y, m - 1, d).getTime())
  for (let i = 0; i < 8; i++) {
    const day = new Date(from)
    day.setDate(day.getDate() + i)
    if (!runsOn(r, day.getTime())) continue
    const at = startOn(r, day.getTime())
    if (at >= now) return at
  }
  return undefined
}

/** The routine that starts next, today or later this week. */
export function nextRoutine(routines: Routine[], now: number): Scheduled | undefined {
  return routines
    .flatMap((r) => {
      const at = nextStart(r, now)
      return at === undefined ? [] : [{ routine: r, at }]
    })
    .sort((a, b) => a.at - b.at)[0]
}

/** One reminder at the next start of each routine the parent asked to be reminded about. */
export function routineAlerts(baby: string, routines: Routine[], now: number): NapAlert[] {
  return routines.slice(0, MAX_ROUTINES).flatMap((r, i) => {
    if (!r.remind) return []
    const at = nextStart(r, now)
    if (at === undefined || at <= now) return []
    const first = r.steps[0] ? ` First up: ${r.steps[0]}.` : ''
    return [{ id: ROUTINE_ID_BASE + i, at, title: `Time for ${r.name}`, body: `${baby}'s ${r.name.toLowerCase()} routine starts now.${first}` }]
  })
}

/** "Every day", "Weekdays", "Weekends" or the short day names, in the parent's language. */
export function daysText(days: number[]): string {
  const set = new Set(days)
  if (set.size === 7) return 'Every day'
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Weekdays'
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends'
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => set.has(d)).map(weekdayName).join(', ')
}

/** Short weekday name for 0 (Sunday) to 6, from a fixed week in January 2023 that starts on a Sunday. */
export function weekdayName(day: number): string {
  return new Date(2023, 0, 1 + day).toLocaleDateString([], { weekday: 'short' })
}
