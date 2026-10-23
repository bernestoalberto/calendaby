import { dailyStats, napForecast, NIGHT_END_HOUR, NIGHT_START_HOUR, type NapForecast } from './analytics.js'
import type { BabyEvent } from './events.js'
import { formatMinutes, sleepSessions } from './summary.js'

export interface FeedForecast {
  intervalMin: number
  lastFeedAt: number
  nextFeedAt: number
  usualBottleMl?: number
  nextBreastSide?: 'left' | 'right'
}

export interface SleepForecast {
  nap?: NapForecast
  usualNapMin?: number
  expectedWakeAt?: number
  usualBedtimeAt?: number
}

export interface DiaperForecast {
  intervalMin: number
  lastDiaperAt: number
  nextCheckAt: number
}

export interface SmartInsight {
  id: string
  kind: 'sleep' | 'feed' | 'diaper' | 'rhythm'
  tone: 'lilac' | 'sage' | 'oat'
  title: string
  prediction: string
  advice: string
}

function clockText(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function isDaytime(ms: number): boolean {
  const h = new Date(ms).getHours()
  return h >= NIGHT_END_HOUR && h < NIGHT_START_HOUR
}

/** Deduces feeding cadence, typical bottle amount, and next nursing side from the last 3 days. */
export function feedForecast(events: BabyEvent[], now: number): FeedForecast | undefined {
  const since = now - 3 * 24 * 3_600_000
  const feeds = events
    .filter((e): e is Extract<BabyEvent, { kind: 'feed' }> => e.kind === 'feed' && e.at >= since && e.at <= now)
    .sort((a, b) => a.at - b.at)
  if (feeds.length < 3) return undefined

  const gaps: number[] = []
  for (let i = 1; i < feeds.length; i++) {
    const gap = feeds[i].at - feeds[i - 1].at
    // Daytime-sized intervals between 30m and 5h avoid overnight stretches and split-feed double logs.
    if (gap >= 30 * 60_000 && gap <= 5 * 3_600_000) gaps.push(gap)
  }
  if (gaps.length < 2) return undefined

  const intervalMin = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length / 60_000)
  const last = feeds.at(-1)!
  const bottles = feeds.filter((f) => f.method === 'bottle' && f.amountMl !== undefined)
  const usualBottleMl =
    bottles.length > 0 ? Math.round(bottles.reduce((a, f) => a + (f.amountMl ?? 0), 0) / bottles.length) : undefined

  const lastBreast = [...feeds].reverse().find((f) => f.method === 'breast')
  let nextBreastSide: 'left' | 'right' | undefined
  if (lastBreast) {
    if (lastBreast.side === 'left') nextBreastSide = 'right'
    else if (lastBreast.side === 'right') nextBreastSide = 'left'
    else if ((lastBreast.leftMin ?? 0) !== (lastBreast.rightMin ?? 0)) {
      nextBreastSide = (lastBreast.leftMin ?? 0) > (lastBreast.rightMin ?? 0) ? 'right' : 'left'
    }
  }

  return {
    intervalMin,
    lastFeedAt: last.at,
    nextFeedAt: last.at + intervalMin * 60_000,
    usualBottleMl,
    nextBreastSide,
  }
}

/** Deduces usual nap length, expected wake time when asleep, and typical evening bedtime over the last 7 days. */
export function sleepForecast(events: BabyEvent[], now: number): SleepForecast {
  const nap = napForecast(events, now)
  const since = now - 7 * 24 * 3_600_000
  const sessions = sleepSessions(events).filter((s) => s.start >= since && s.start <= now)

  const napLengths: number[] = []
  const bedtimeOffsetsMin: number[] = []

  for (const s of sessions) {
    const startHour = new Date(s.start).getHours()
    if (s.end !== undefined && isDaytime(s.start)) {
      const durMin = (s.end - s.start) / 60_000
      if (durMin >= 15 && durMin <= 240) napLengths.push(durMin)
    }
    if (startHour >= 18 && startHour <= 22) {
      const d = new Date(s.start)
      bedtimeOffsetsMin.push((d.getHours() - 18) * 60 + d.getMinutes())
    }
  }

  const usualNapMin =
    napLengths.length >= 2 ? Math.round(napLengths.reduce((a, b) => a + b, 0) / napLengths.length) : undefined

  const open = sessions.at(-1)
  const expectedWakeAt =
    open && open.end === undefined && isDaytime(open.start) && usualNapMin !== undefined
      ? open.start + usualNapMin * 60_000
      : undefined

  let usualBedtimeAt: number | undefined
  if (bedtimeOffsetsMin.length >= 2) {
    const avgOffset = Math.round(bedtimeOffsetsMin.reduce((a, b) => a + b, 0) / bedtimeOffsetsMin.length)
    const sixPm = new Date(now)
    sixPm.setHours(18, 0, 0, 0)
    usualBedtimeAt = sixPm.getTime() + avgOffset * 60_000
  }

  return { nap, usualNapMin, expectedWakeAt, usualBedtimeAt }
}

/** Deduces typical daytime diaper-change cadence from the last 3 days. */
export function diaperForecast(events: BabyEvent[], now: number): DiaperForecast | undefined {
  const since = now - 3 * 24 * 3_600_000
  const diapers = events
    .filter((e): e is Extract<BabyEvent, { kind: 'diaper' }> => e.kind === 'diaper' && e.at >= since && e.at <= now)
    .sort((a, b) => a.at - b.at)
  if (diapers.length < 3) return undefined

  const gaps: number[] = []
  for (let i = 1; i < diapers.length; i++) {
    const gap = diapers[i].at - diapers[i - 1].at
    if (gap >= 30 * 60_000 && gap <= 6 * 3_600_000) gaps.push(gap)
  }
  if (gaps.length < 2) return undefined

  const intervalMin = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length / 60_000)
  const last = diapers.at(-1)!
  return {
    intervalMin,
    lastDiaperAt: last.at,
    nextCheckAt: last.at + intervalMin * 60_000,
  }
}

/** Synthesizes data-backed predictions, deductions, and actionable advice from the baby's past logs. */
export function deduceInsights(events: BabyEvent[], baby: string, now: number): SmartInsight[] {
  const insights: SmartInsight[] = []
  const sleep = sleepForecast(events, now)
  const feed = feedForecast(events, now)
  const diaper = diaperForecast(events, now)
  const sessions = sleepSessions(events)
  const currentSleep = sessions.at(-1)
  const asleep = currentSleep !== undefined && currentSleep.end === undefined

  if (asleep && sleep.expectedWakeAt !== undefined && sleep.usualNapMin !== undefined) {
    const leftMin = Math.round((sleep.expectedWakeAt - now) / 60_000)
    insights.push({
      id: 'wake-prediction',
      kind: 'sleep',
      tone: 'lilac',
      title: leftMin > 0 ? `Likely waking around ${clockText(sleep.expectedWakeAt)}` : `Passing usual nap length`,
      prediction: `${baby}'s daytime naps average ${formatMinutes(sleep.usualNapMin)}.`,
      advice:
        leftMin > 0
          ? `About ${formatMinutes(leftMin)} left in this nap — good window to prep the next feed or take a breather.`
          : `${baby} has slept ${formatMinutes(Math.round((now - currentSleep.start) / 60_000))} (usual is ${formatMinutes(sleep.usualNapMin)}) and may wake soon.`,
    })
  } else if (!asleep && sleep.nap?.nextNapAt !== undefined) {
    const leftMin = Math.round((sleep.nap.nextNapAt - now) / 60_000)
    if (leftMin >= -60) {
      const collidesWithFeed =
        feed !== undefined && Math.abs(feed.nextFeedAt - sleep.nap.nextNapAt) <= 25 * 60_000
      insights.push({
        id: 'nap-prediction',
        kind: 'sleep',
        tone: leftMin <= 15 ? 'oat' : 'lilac',
        title:
          leftMin <= 0
            ? `Nap sweet-spot is open now`
            : `Next nap around ${clockText(sleep.nap.nextNapAt)}`,
        prediction: `Based on ${baby}'s ${formatMinutes(sleep.nap.wakeWindowMin)} wake window${sleep.usualNapMin ? ` (naps usually last ~${formatMinutes(sleep.usualNapMin)})` : ''}.`,
        advice: collidesWithFeed
          ? `Next feed and nap overlap around ${clockText(sleep.nap.nextNapAt)} — offer a feed 20m early so hunger doesn't cut the nap short.`
          : leftMin <= 15
            ? `Start winding down now (dim lights, fresh diaper) before overtiredness kicks in.`
            : `In ~${formatMinutes(Math.max(1, leftMin - 15))}, start a calm 15-minute wind-down routine.`,
      })
    }
  }

  if (feed && now - feed.lastFeedAt <= 8 * 3_600_000) {
    const leftMin = Math.round((feed.nextFeedAt - now) / 60_000)
    const details = [
      `every ~${formatMinutes(feed.intervalMin)}`,
      feed.usualBottleMl ? `usual bottle ~${feed.usualBottleMl} ml (${(feed.usualBottleMl / 29.5735).toFixed(1)} oz)` : '',
      feed.nextBreastSide ? `next nursing side: ${feed.nextBreastSide}` : '',
    ]
      .filter(Boolean)
      .join(' • ')

    insights.push({
      id: 'feed-prediction',
      kind: 'feed',
      tone: leftMin <= 0 ? 'oat' : 'sage',
      title: leftMin <= 0 ? `Feed window open now` : `Next feed around ${clockText(feed.nextFeedAt)}`,
      prediction: `${baby} feeds ${details}.`,
      advice: feed.nextBreastSide
        ? `Start on the ${feed.nextBreastSide} breast next to keep nursing balanced${feed.usualBottleMl ? `, or prep ~${feed.usualBottleMl} ml if offering a bottle.` : '.'}`
        : feed.usualBottleMl
          ? `Prep ~${feed.usualBottleMl} ml (${(feed.usualBottleMl / 29.5735).toFixed(1)} oz) ahead of ${clockText(feed.nextFeedAt)}.`
          : `Watch for early hunger cues (rooting, hands to mouth) around ${clockText(feed.nextFeedAt)}.`,
    })
  }

  // Compare today's naps against 7-day baseline or surface evening bedtime sweet-spot.
  const stats = dailyStats(events, 7, now)
  const todayStats = stats.at(-1)
  if (todayStats && sleep.usualNapMin && todayStats.naps >= 2) {
    const todayAvgNap = Math.round(todayStats.dayMin / todayStats.naps)
    if (todayAvgNap < sleep.usualNapMin * 0.75) {
      insights.push({
        id: 'short-naps-advice',
        kind: 'rhythm',
        tone: 'oat',
        title: `Shorter naps today (${formatMinutes(todayAvgNap)} avg)`,
        prediction: `Today's ${todayStats.naps} naps averaged ${formatMinutes(todayAvgNap)} vs ${baby}'s usual ${formatMinutes(sleep.usualNapMin)}.`,
        advice: `Short naps build sleep pressure faster — offer the next sleep or bedtime 15–20 minutes earlier than usual.`,
      })
    }
  }

  if (sleep.usualBedtimeAt !== undefined && !insights.some((i) => i.id === 'short-naps-advice')) {
    insights.push({
      id: 'bedtime-prediction',
      kind: 'rhythm',
      tone: 'lilac',
      title: `Bedtime sweet-spot around ${clockText(sleep.usualBedtimeAt)}`,
      prediction: `Deduced from ${baby}'s evening sleep starts over the past week.`,
      advice: `Aim to finish the last nap at least ${formatMinutes(sleep.nap?.wakeWindowMin ?? 90)} before ${clockText(sleep.usualBedtimeAt)} to build smooth bedtime pressure.`,
    })
  }

  if (diaper && !asleep && now - diaper.lastDiaperAt >= diaper.intervalMin * 60_000) {
    insights.push({
      id: 'diaper-check',
      kind: 'diaper',
      tone: 'sage',
      title: `Diaper check due`,
      prediction: `Last change was ${formatMinutes(Math.round((now - diaper.lastDiaperAt) / 60_000))} ago (usual cadence: every ~${formatMinutes(diaper.intervalMin)}).`,
      advice: `A fresh diaper before the next feed or nap helps prevent mid-nap wakeups.`,
    })
  }

  return insights.slice(0, 4)
}

