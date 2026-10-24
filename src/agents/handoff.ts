import type { BabyEvent } from '../domain/events'

export interface HandoffBrief {
  headline: string
  lines: string[]
}

const HOUR = 3_600_000

export function since(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/**
 * Builds the 30-second summary a caregiver reads when taking over.
 * `windowHours` bounds the totals so the brief covers the outgoing shift, not the whole history.
 */
export function buildHandoff(events: BabyEvent[], now: Date, windowHours = 8): HandoffBrief {
  const t = now.getTime()
  const past = events.filter((e) => e.at <= t).sort((a, b) => b.at - a.at)
  const recent = past.filter((e) => t - e.at <= windowHours * HOUR)
  const lines: string[] = []

  const lastSleep = past.find((e) => e.kind === 'sleep')
  const asleep = lastSleep?.kind === 'sleep' && lastSleep.phase === 'start'
  const headline = !lastSleep
    ? 'No sleep logged yet'
    : asleep
      ? `Asleep for ${since(t - lastSleep.at)}`
      : `Awake for ${since(t - lastSleep.at)}`

  const lastFeed = past.find((e) => e.kind === 'feed')
  if (lastFeed?.kind === 'feed') {
    const detail = lastFeed.amountMl ? ` (${lastFeed.amountMl} ml ${lastFeed.method})` : ` (${lastFeed.method})`
    lines.push(`Last feed ${since(t - lastFeed.at)} ago${detail}`)
  } else {
    lines.push('No feed logged yet')
  }

  const feeds = recent.filter((e) => e.kind === 'feed')
  const totalMl = feeds.reduce((sum, e) => sum + (e.kind === 'feed' ? (e.amountMl ?? 0) : 0), 0)
  if (feeds.length) {
    lines.push(`${feeds.length} feed${feeds.length === 1 ? '' : 's'} in the last ${windowHours} h${totalMl ? `, ${totalMl} ml total` : ''}`)
  }

  const lastDiaper = past.find((e) => e.kind === 'diaper')
  if (lastDiaper?.kind === 'diaper') {
    lines.push(`Last diaper ${since(t - lastDiaper.at)} ago (${lastDiaper.contents})`)
  }

  for (const med of past.filter((e) => e.kind === 'med' && t - e.at <= 24 * HOUR)) {
    if (med.kind !== 'med') continue
    lines.push(`Gave ${med.name}${med.doseMl ? ` ${med.doseMl} ml` : ''} ${since(t - med.at)} ago`)
  }

  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  const tummyMin = past
    .filter((e) => e.at >= midnight.getTime())
    .reduce((sum, e) => sum + (e.kind === 'activity' && e.type === 'tummy' ? (e.durationMin ?? 0) : 0), 0)
  if (tummyMin) lines.push(`Tummy time ${tummyMin} min today`)

  const lastPump = past.find((e) => e.kind === 'pump')
  if (lastPump?.kind === 'pump' && t - lastPump.at <= 24 * HOUR) {
    lines.push(`Last pump ${since(t - lastPump.at)} ago${lastPump.amountMl ? ` (${lastPump.amountMl} ml)` : ''}`)
  }

  for (const e of recent) {
    if (e.note) lines.push(`Note: ${e.note}`)
  }

  return { headline, lines }
}

export function handoffText(brief: HandoffBrief): string {
  return [brief.headline, ...brief.lines.map((l) => `- ${l}`)].join('\n')
}
