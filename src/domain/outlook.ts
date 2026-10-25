import { NIGHT_END_HOUR, NIGHT_START_HOUR, addDays, startOfDay } from './analytics.js'
import { ageLabel, type AgeNorm } from './ageNorms.js'
import type { BabyEvent } from './events.js'
import { feedForecast } from './predictions.js'
import { formatMinutes, sleepSessions, type SleepSession } from './summary.js'

/** Where a range came from: the baby's own logs, the age table, or both when there is little data. */
export type Basis = 'own' | 'age' | 'blend'

export interface OutlookItem {
  id: 'nap' | 'wake' | 'feed' | 'bedtime'
  title: string
  from: number
  to: number
  basis: Basis
  note: string
  advice: string
}

export interface Tonight {
  nights: number
  bedtimeFrom?: number
  bedtimeTo?: number
  nightFeeds: number
  longestStretchMin: number
}

export interface Outlook {
  items: OutlookItem[]
  tonight?: Tonight
}

const MIN = 60_000
const HOUR = 60 * MIN
const OWN_SAMPLES = 3

/** Value at fraction q of the sorted list, interpolated. */
export function quantile(values: number[], q: number): number {
  const s = [...values].sort((a, b) => a - b)
  const pos = (s.length - 1) * q
  const lo = Math.floor(pos)
  return s[lo] + (s[Math.ceil(pos)] - s[lo]) * (pos - lo)
}

/** The middle half of recent values: an honest range instead of one average. */
function middleHalf(values: number[]): [number, number] {
  return [quantile(values, 0.25), quantile(values, 0.75)]
}

function isDaytime(ms: number): boolean {
  const h = new Date(ms).getHours()
  return h >= NIGHT_END_HOUR && h < NIGHT_START_HOUR
}

/** Daytime sleeps that started before `s` on the same day; 0 means `s` is the first nap. */
function napIndex(sessions: SleepSession[], s: SleepSession): number {
  const day = startOfDay(s.start)
  return sessions.filter((o) => o.start < s.start && o.start >= day && isDaytime(o.start)).length
}

interface Window {
  minutes: number
  napIndex: number
}

function recentWakeWindows(sessions: SleepSession[], now: number): Window[] {
  const since = now - 5 * 24 * HOUR
  const out: Window[] = []
  for (let i = 1; i < sessions.length; i++) {
    const prevEnd = sessions[i - 1].end
    if (prevEnd === undefined || prevEnd < since || !isDaytime(sessions[i].start)) continue
    const gap = sessions[i].start - prevEnd
    // Longer gaps are missed logs, shorter ones are stirrings.
    if (gap >= 15 * MIN && gap <= 6 * HOUR) out.push({ minutes: gap / MIN, napIndex: napIndex(sessions, sessions[i]) })
  }
  return out
}

/** Range in minutes from own data, the age norm, or a blend of both. */
function rangeFor(own: number[], norm: [number, number] | undefined): { range: [number, number]; basis: Basis } | undefined {
  if (own.length >= OWN_SAMPLES) return { range: middleHalf(own), basis: 'own' }
  if (!norm) return own.length >= 2 ? { range: middleHalf(own), basis: 'own' } : undefined
  if (own.length === 0) return { range: norm, basis: 'age' }
  const mid = quantile(own, 0.5)
  return { range: [(mid + norm[0]) / 2, (mid + norm[1]) / 2], basis: 'blend' }
}

function basisNote(basis: Basis, weeks: number | undefined): string {
  if (basis === 'own') return 'From your logs'
  const age = weeks === undefined ? '' : ` for ${ageLabel(weeks)}`
  return basis === 'age' ? `Typical${age}` : `Your logs and what is typical${age}`
}

function napItem(sessions: SleepSession[], norm: AgeNorm | undefined, weeks: number | undefined, now: number): OutlookItem | undefined {
  const last = sessions.at(-1)
  if (!last || last.end === undefined) return undefined
  const windows = recentWakeWindows(sessions, now)
  const nextIndex = isDaytime(last.end) ? napIndex(sessions, { start: now }) : 0
  const sameSlot = windows.filter((w) => w.napIndex === nextIndex).map((w) => w.minutes)
  // Plenty of history but never this many naps: the next sleep is bedtime, not another nap.
  if (sameSlot.length === 0 && windows.length >= 2 * OWN_SAMPLES) return undefined
  const own = sameSlot.length >= OWN_SAMPLES ? sameSlot : windows.map((w) => w.minutes)
  const r = rangeFor(own, norm && [norm.wakeMinLow, norm.wakeMinHigh])
  if (!r) return undefined
  const from = last.end + r.range[0] * MIN
  const to = last.end + r.range[1] * MIN
  // Far past the range means a sleep was not logged; a stale nap would only mislead.
  if (now > to + HOUR || !isDaytime(from)) return undefined
  return {
    id: 'nap',
    title: nextIndex === 0 ? 'First nap' : `Nap ${nextIndex + 1}`,
    from,
    to,
    basis: r.basis,
    note: basisNote(r.basis, weeks),
    advice: 'Start a calm 15-minute wind-down (dim light, fresh diaper) as the window opens; yawning or rubbing eyes means now.',
  }
}

function wakeItem(sessions: SleepSession[], now: number): OutlookItem | undefined {
  const open = sessions.at(-1)
  if (!open || open.end !== undefined || !isDaytime(open.start)) return undefined
  const lengths = sessions
    .filter((s) => s.end !== undefined && s.start >= now - 7 * 24 * HOUR && isDaytime(s.start))
    .map((s) => ((s.end ?? 0) - s.start) / MIN)
    .filter((m) => m >= 15 && m <= 240)
  if (lengths.length < 2) return undefined
  const [lo, hi] = middleHalf(lengths)
  return {
    id: 'wake',
    title: 'Wakes from nap',
    from: open.start + lo * MIN,
    to: open.start + hi * MIN,
    basis: 'own',
    note: basisNote('own', undefined),
    advice: 'Good window to get the next feed ready.',
  }
}

function feedItem(events: BabyEvent[], now: number): OutlookItem | undefined {
  const feeds = events.filter((e) => e.kind === 'feed' && e.at >= now - 3 * 24 * HOUR && e.at <= now).sort((a, b) => a.at - b.at)
  const gaps: number[] = []
  for (let i = 1; i < feeds.length; i++) {
    const gap = feeds[i].at - feeds[i - 1].at
    // Overnight stretches and split-feed double logs fall outside this band.
    if (gap >= 30 * MIN && gap <= 5 * HOUR) gaps.push(gap / MIN)
  }
  const last = feeds.at(-1)
  if (!last || gaps.length < 2 || now - last.at > 8 * HOUR) return undefined
  const [lo, hi] = middleHalf(gaps)
  const f = feedForecast(events, now)
  const advice = f?.nextBreastSide
    ? `Start on the ${f.nextBreastSide} side.`
    : f?.usualBottleMl
      ? `Usual bottle is about ${f.usualBottleMl} ml.`
      : 'Watch for early hunger cues: rooting, hands to mouth.'
  return { id: 'feed', title: 'Feed', from: last.at + lo * MIN, to: last.at + hi * MIN, basis: 'own', note: basisNote('own', undefined), advice }
}

/** Minutes after 6 pm of evening sleep starts over the last 7 days. */
function bedtimeOffsets(sessions: SleepSession[], now: number): number[] {
  return sessions
    .filter((s) => s.start >= now - 7 * 24 * HOUR)
    .map((s) => new Date(s.start))
    .filter((d) => d.getHours() >= 18 && d.getHours() <= 22)
    .map((d) => (d.getHours() - 18) * 60 + d.getMinutes())
}

function bedtimeItem(sessions: SleepSession[], now: number): OutlookItem | undefined {
  const offsets = bedtimeOffsets(sessions, now)
  if (offsets.length < 2) return undefined
  const [lo, hi] = middleHalf(offsets)
  const sixPm = new Date(now).setHours(18, 0, 0, 0)
  return {
    id: 'bedtime',
    title: 'Bedtime',
    from: sixPm + lo * MIN,
    to: sixPm + hi * MIN,
    basis: 'own',
    note: basisNote('own', undefined),
    advice: 'Short naps today? Aim for the early end of the range.',
  }
}

/** Night feeds and the longest sleep stretch over the last 5 nights (7 pm to 7 am), as medians. */
export function tonight(events: BabyEvent[], now: number): Tonight | undefined {
  const sessions = sleepSessions(events)
  const today = startOfDay(now)
  const feeds: number[] = []
  const stretches: number[] = []
  for (let i = 1; i <= 5; i++) {
    const from = new Date(addDays(today, -i)).setHours(NIGHT_START_HOUR, 0, 0, 0)
    const to = new Date(addDays(today, -i + 1)).setHours(NIGHT_END_HOUR, 0, 0, 0)
    const night = sessions.filter((s) => s.end !== undefined && s.start < to && s.end > from)
    if (night.length === 0) continue
    stretches.push(Math.max(...night.map((s) => (Math.min(s.end ?? 0, to) - Math.max(s.start, from)) / MIN)))
    // The bedtime feed is not a night feed.
    const asleep = Math.max(from, night[0].start)
    feeds.push(events.filter((e) => e.kind === 'feed' && e.at > asleep && e.at < to).length)
  }
  if (stretches.length < 2) return undefined
  const bed = bedtimeItem(sessions, now)
  return {
    nights: stretches.length,
    bedtimeFrom: bed?.from,
    bedtimeTo: bed?.to,
    nightFeeds: Math.round(quantile(feeds, 0.5)),
    longestStretchMin: Math.round(quantile(stretches, 0.5)),
  }
}

/**
 * What is coming up for the rest of the day, each with a time range and where it came from.
 * Rules and statistics only; the agent explains these, it never invents its own times.
 */
export function outlook(events: BabyEvent[], norm: AgeNorm | undefined, weeks: number | undefined, now: number): Outlook {
  const sessions = sleepSessions(events)
  const items = [napItem(sessions, norm, weeks, now), wakeItem(sessions, now), feedItem(events, now), bedtimeItem(sessions, now)]
    .filter((i): i is OutlookItem => i !== undefined && i.to >= now)
    .sort((a, b) => a.from - b.from)
  return { items, tonight: tonight(events, now) }
}

export function rangeText(item: { from: number; to: number }, clock: (ms: number) => string): string {
  const a = clock(item.from)
  const b = clock(item.to)
  return a === b ? a : `${a} – ${b}`
}

export function tonightText(t: Tonight, clock: (ms: number) => string): string {
  const parts = [
    t.bedtimeFrom !== undefined && t.bedtimeTo !== undefined ? `bed ${rangeText({ from: t.bedtimeFrom, to: t.bedtimeTo }, clock)}` : '',
    t.nightFeeds === 0 ? 'no night feeds lately' : `about ${t.nightFeeds} night feed${t.nightFeeds === 1 ? '' : 's'}`,
    `longest stretch ~${formatMinutes(t.longestStretchMin)}`,
  ]
  return parts.filter(Boolean).join(', ')
}
