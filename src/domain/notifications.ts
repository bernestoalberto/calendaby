import { NIGHT_END_HOUR, NIGHT_START_HOUR, type NapForecast } from './analytics.js'
import type { BabyEvent } from './events.js'
import type { Tonight } from './outlook.js'
import { diaperForecast, feedForecast, sleepForecast, type FeedForecast } from './predictions.js'
import { formatMinutes, sleepSessions } from './summary.js'

export interface NapAlert {
  id: number
  at: number
  title: string
  body: string
}

export const NAP_SOON_ID = 101
export const NAP_DUE_ID = 102
export const WAKE_SOON_ID = 103
export const FEED_DUE_ID = 104
export const DIAPER_CHECK_ID = 105
export const BRIEFING_ID = 106
export const ALL_ALERT_IDS = [NAP_SOON_ID, NAP_DUE_ID, WAKE_SOON_ID, FEED_DUE_ID, DIAPER_CHECK_ID, BRIEFING_ID] as const

/** The `features` row that switches each alert on or off. */
export const ALERT_FEATURE: Record<number, string> = {
  [NAP_SOON_ID]: 'alertWindDown',
  [NAP_DUE_ID]: 'alertNapDue',
  [WAKE_SOON_ID]: 'alertWake',
  [FEED_DUE_ID]: 'alertFeed',
  [DIAPER_CHECK_ID]: 'alertDiaper',
  [BRIEFING_ID]: 'alertBriefing',
}
export const NAP_LEAD_MS = 15 * 60_000

function clockText(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function isDaytime(ms: number): boolean {
  const h = new Date(ms).getHours()
  return h >= NIGHT_END_HOUR && h <= NIGHT_START_HOUR
}

function feedTipText(feed: FeedForecast): string {
  if (feed.nextBreastSide) return ` Next nursing side: ${feed.nextBreastSide}.`
  if (feed.usualBottleMl) {
    const oz = (feed.usualBottleMl / 29.5735).toFixed(1)
    return ` Usual bottle: ~${feed.usualBottleMl} ml (${oz} oz).`
  }
  return ''
}

/**
 * Upcoming notifications for the current wake window:
 * 1) 15 minutes before the predicted nap (wind-down reminder)
 * 2) At the predicted nap time
 */
export function napAlerts(baby: string, forecast: NapForecast | undefined, asleep: boolean, now: number): NapAlert[] {
  if (asleep || forecast?.nextNapAt === undefined) return []
  const next = forecast.nextNapAt
  const soonAt = next - NAP_LEAD_MS
  const out: NapAlert[] = []

  if (soonAt > now) {
    out.push({
      id: NAP_SOON_ID,
      at: soonAt,
      title: `${baby}: nap in 15 minutes`,
      body: `Predicted nap around ${clockText(next)}. Good time to start winding down.`,
    })
  }
  if (next > now) {
    out.push({
      id: NAP_DUE_ID,
      at: next,
      title: `${baby}: nap time`,
      body: `It's been ${formatMinutes(forecast.wakeWindowMin)} since ${baby} woke up.`,
    })
  }
  return out
}

/**
 * Smart agent notifications deduced from the baby's own sleep, feed, and diaper history:
 * - Nap wind-down (15m early) & nap sweet-spot
 * - Expected wake-up time when napping
 * - Next predicted feed (with usual bottle amount or next nursing side)
 * - Next diaper check reminder
 */
export function smartAlerts(baby: string, events: BabyEvent[], now: number, on: (feature: string) => boolean = () => true): NapAlert[] {
  const sessions = sleepSessions(events)
  const currentSleep = sessions.at(-1)
  const asleep = currentSleep !== undefined && currentSleep.end === undefined
  const sleep = sleepForecast(events, now)
  const out = napAlerts(baby, sleep.nap, asleep, now)

  if (asleep && sleep.expectedWakeAt !== undefined && sleep.usualNapMin !== undefined && sleep.expectedWakeAt > now) {
    out.push({
      id: WAKE_SOON_ID,
      at: sleep.expectedWakeAt,
      title: `${baby}: likely waking soon`,
      body: `${baby}'s daytime naps average ${formatMinutes(sleep.usualNapMin)}. Good window to prep the next feed.`,
    })
  }

  const feed = feedForecast(events, now)
  if (feed && feed.nextFeedAt > now && isDaytime(feed.nextFeedAt)) {
    out.push({
      id: FEED_DUE_ID,
      at: feed.nextFeedAt,
      title: `${baby}: feed window open`,
      body: `${baby} usually feeds every ${formatMinutes(feed.intervalMin)}.${feedTipText(feed)}`,
    })
  }

  const diaper = diaperForecast(events, now)
  if (!asleep && diaper && diaper.nextCheckAt > now && isDaytime(diaper.nextCheckAt)) {
    out.push({
      id: DIAPER_CHECK_ID,
      at: diaper.nextCheckAt,
      title: `${baby}: diaper check`,
      body: `It's been ${formatMinutes(diaper.intervalMin)} since the last diaper change.`,
    })
  }

  return out.filter((a) => on(ALERT_FEATURE[a.id]))
}

/** One note a day at `time` ("07:30"), with what recent nights looked like. */
export function briefingAlert(baby: string, time: string, recent: Tonight | undefined, now: number): NapAlert {
  const [h, m] = time.split(':').map(Number)
  const today = new Date(now).setHours(h, m, 0, 0)
  const at = today > now ? today : new Date(today).setDate(new Date(today).getDate() + 1)
  const lately = recent
    ? ` Lately: ${recent.nightFeeds === 0 ? 'no night feeds' : `about ${recent.nightFeeds} night feed${recent.nightFeeds === 1 ? '' : 's'}`}, longest stretch ~${formatMinutes(recent.longestStretchMin)}.`
    : ''
  return {
    id: BRIEFING_ID,
    at,
    title: `${baby}: good morning`,
    body: `Log the wake-up and Today will lay out the naps, feeds and bedtime ahead.${lately}`,
  }
}
