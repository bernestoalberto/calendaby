import type { BabyEvent } from './events.js'
import { MILESTONE_AREAS, type Milestone } from '../knowledge/milestones.js'

export type MilestoneState = 'yes' | 'not_yet' | 'unsure'
export type MilestoneEvent = Extract<BabyEvent, { kind: 'milestone' }>

export interface Answer {
  state: MilestoneState
  at: number
  by: string
}

/** The latest answer for each item; changing your mind is a newer entry. */
export function answers(events: BabyEvent[]): Map<string, Answer> {
  const out = new Map<string, Answer>()
  for (const e of events) {
    if (e.kind !== 'milestone') continue
    const seen = out.get(e.milestoneId)
    if (!seen || e.at >= seen.at) out.set(e.milestoneId, { state: e.state, at: e.at, by: e.loggedBy })
  }
  return out
}

/** Whole months old on `now`, from a YYYY-MM-DD birth date; undefined when missing or in the future. */
export function wholeMonths(birth: string | undefined, now: number): number | undefined {
  if (!birth) return undefined
  const b = new Date(`${birth}T00:00`)
  if (Number.isNaN(b.getTime()) || b.getTime() > now) return undefined
  const n = new Date(now)
  let months = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth()
  if (n.getDate() < b.getDate()) months--
  return Math.max(0, months)
}

export interface BandItem {
  milestone: Milestone
  state?: MilestoneState
}

export interface Band {
  ageMonths: number
  items: BandItem[]
  yes: number
}

export interface MilestoneView {
  /** The latest checklist the baby is old enough for; undefined under the first checkpoint. */
  current?: Band
  /** The checklist coming up next. */
  next?: Band
  /** Earlier checklists that still have items not answered with "yes". */
  earlier: Band[]
  /** Items answered "not yet" in checklists the baby is old enough for: worth raising at the next checkup. */
  raise: BandItem[]
}

function band(milestones: Milestone[], given: Map<string, Answer>, ageMonths: number): Band {
  const items = milestones.filter((m) => m.ageMonths === ageMonths).map((milestone) => ({ milestone, state: given.get(milestone.id)?.state }))
  return { ageMonths, items, yes: items.filter((i) => i.state === 'yes').length }
}

export function milestoneView(milestones: Milestone[], events: BabyEvent[], months: number | undefined): MilestoneView {
  const given = answers(events)
  const ages = [...new Set(milestones.map((m) => m.ageMonths))].sort((a, b) => a - b)
  if (months === undefined) return { earlier: [], raise: [] }
  const reached = ages.filter((a) => a <= months)
  const current = reached.length ? band(milestones, given, reached[reached.length - 1]) : undefined
  const upcoming = ages.find((a) => a > months)
  const earlier = reached
    .slice(0, -1)
    .map((a) => band(milestones, given, a))
    .filter((b) => b.yes < b.items.length)
    .reverse()
  const raise = [...(current ? [current] : []), ...earlier].flatMap((b) => b.items).filter((i) => i.state === 'not_yet')
  return { current, next: upcoming === undefined ? undefined : band(milestones, given, upcoming), earlier, raise }
}

/** "6 months", "1 year", "2 years" as the CDC titles its checklists. */
export const bandLabel = (months: number): string => (months % 12 === 0 ? `${months / 12} ${months === 12 ? 'year' : 'years'}` : `${months} months`)

export const areaLabel = (id: string): string => MILESTONE_AREAS.find((a) => a.id === id)?.label ?? id

/** What the assistant may say about milestones: the baby's own answers and the CDC items, nothing else. */
export interface MilestoneReport {
  ageMonths: number | null
  checklist: { forAgeMonths: number; reached: number; total: number; notAnswered: string[] } | null
  notYet: { forAgeMonths: number; area: string; text: string }[]
  notSure: { forAgeMonths: number; area: string; text: string }[]
  comingUp: { forAgeMonths: number; items: string[] } | null
}

export function milestoneReport(milestones: Milestone[], events: BabyEvent[], months: number | undefined): MilestoneReport {
  const view = milestoneView(milestones, events, months)
  const flat = (state: MilestoneState) =>
    [...(view.current ? [view.current] : []), ...view.earlier].flatMap((b) =>
      b.items.filter((i) => i.state === state).map((i) => ({ forAgeMonths: b.ageMonths, area: areaLabel(i.milestone.area), text: i.milestone.text })),
    )
  return {
    ageMonths: months ?? null,
    checklist: view.current
      ? {
          forAgeMonths: view.current.ageMonths,
          reached: view.current.yes,
          total: view.current.items.length,
          notAnswered: view.current.items.filter((i) => i.state === undefined).map((i) => i.milestone.text),
        }
      : null,
    notYet: flat('not_yet'),
    notSure: flat('unsure'),
    comingUp: view.next ? { forAgeMonths: view.next.ageMonths, items: view.next.items.map((i) => i.milestone.text) } : null,
  }
}
