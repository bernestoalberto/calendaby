import { describe, expect, it } from 'vitest'
import type { BabyEvent } from './events'
import { BRIEFING_ID, DIAPER_CHECK_ID, FEED_DUE_ID, NAP_DUE_ID, NAP_LEAD_MS, NAP_SOON_ID, WAKE_SOON_ID, briefingAlert, napAlerts, smartAlerts } from './notifications'
import { deduceInsights, diaperForecast, feedForecast, sleepForecast } from './predictions'

describe('napAlerts', () => {
  const base = Date.parse('2026-10-22T14:00:00Z')
  const forecast = {
    wakeWindowMin: 90,
    awakeSince: base,
    nextNapAt: base + 90 * 60_000,
  }

  it('schedules both 15-minute wind-down and due-now alerts when ahead of both', () => {
    const alerts = napAlerts('Maya', forecast, false, base + 30 * 60_000)
    expect(alerts).toHaveLength(2)
    expect(alerts[0]).toMatchObject({
      id: NAP_SOON_ID,
      at: forecast.nextNapAt - NAP_LEAD_MS,
      title: 'Maya: nap in 15 minutes',
    })
    expect(alerts[1]).toMatchObject({
      id: NAP_DUE_ID,
      at: forecast.nextNapAt,
      title: 'Maya: nap time',
      body: "It's been 1h 30m since Maya woke up.",
    })
  })

  it('schedules only the due-now alert when less than 15 minutes remain', () => {
    const alerts = napAlerts('Maya', forecast, false, forecast.nextNapAt - 10 * 60_000)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].id).toBe(NAP_DUE_ID)
  })

  it('returns no alerts when asleep, past due, or without a forecast', () => {
    expect(napAlerts('Maya', forecast, true, base)).toEqual([])
    expect(napAlerts('Maya', forecast, false, forecast.nextNapAt)).toEqual([])
    expect(napAlerts('Maya', undefined, false, base)).toEqual([])
  })
})

describe('smart predictions, deductions, and alerts', () => {
  // 1:00 PM local time so daytime checks are deterministic in any US/EU timezone.
  const now = new Date(2026, 9, 22, 13, 0, 0).getTime()
  const hr = 3_600_000
  const min = 60_000

  const events: BabyEvent[] = [
    // 4 sleeps giving 3 wake windows of 2h (120m) and completed daytime naps of 60m
    { id: 's1', kind: 'sleep', phase: 'start', at: now - 11 * hr, loggedBy: 'Dad' },
    { id: 's2', kind: 'sleep', phase: 'end', at: now - 10 * hr, loggedBy: 'Dad' },
    { id: 's3', kind: 'sleep', phase: 'start', at: now - 8 * hr, loggedBy: 'Dad' },
    { id: 's4', kind: 'sleep', phase: 'end', at: now - 7 * hr, loggedBy: 'Dad' },
    { id: 's5', kind: 'sleep', phase: 'start', at: now - 5 * hr, loggedBy: 'Dad' },
    { id: 's6', kind: 'sleep', phase: 'end', at: now - 4 * hr, loggedBy: 'Dad' },
    { id: 's7', kind: 'sleep', phase: 'start', at: now - 2 * hr, loggedBy: 'Dad' },
    { id: 's8', kind: 'sleep', phase: 'end', at: now - 1 * hr, loggedBy: 'Dad' },
    // 3 feeds spaced 3h apart; last one was left breast + bottle history
    { id: 'f1', kind: 'feed', method: 'bottle', amountMl: 120, at: now - 7 * hr, loggedBy: 'Dad' },
    { id: 'f2', kind: 'feed', method: 'bottle', amountMl: 130, at: now - 4 * hr, loggedBy: 'Dad' },
    { id: 'f3', kind: 'feed', method: 'breast', side: 'left', at: now - 1 * hr, loggedBy: 'Mom' },
    // 3 diapers spaced 2h apart
    { id: 'd1', kind: 'diaper', contents: 'wet', at: now - 5 * hr, loggedBy: 'Dad' },
    { id: 'd2', kind: 'diaper', contents: 'wet', at: now - 3 * hr, loggedBy: 'Dad' },
    { id: 'd3', kind: 'diaper', contents: 'both', at: now - 1 * hr, loggedBy: 'Dad' },
  ]

  it('deduces feed interval, usual bottle volume, and next nursing side', () => {
    const feed = feedForecast(events, now)
    expect(feed).toEqual({
      intervalMin: 180,
      lastFeedAt: now - 1 * hr,
      nextFeedAt: now + 2 * hr,
      usualBottleMl: 125,
      nextBreastSide: 'right',
    })
  })

  it('deduces usual nap duration and expected wake time when asleep', () => {
    const asleepEvents: BabyEvent[] = [
      ...events,
      { id: 's9', kind: 'sleep', phase: 'start', at: now - 20 * min, loggedBy: 'Dad' },
    ]
    const sleep = sleepForecast(asleepEvents, now)
    expect(sleep.usualNapMin).toBe(60)
    expect(sleep.expectedWakeAt).toBe(now + 40 * min)

    const alerts = smartAlerts('Maya', asleepEvents, now)
    expect(alerts.map((a) => a.id)).toContain(WAKE_SOON_ID)
  })

  it('deduces diaper cadence and schedules nap, feed, and diaper alerts when awake', () => {
    const diaper = diaperForecast(events, now)
    expect(diaper?.intervalMin).toBe(120)

    const alerts = smartAlerts('Maya', events, now)
    expect(alerts.map((a) => a.id)).toEqual([NAP_SOON_ID, NAP_DUE_ID, FEED_DUE_ID, DIAPER_CHECK_ID])
    const defaults = smartAlerts('Maya', events, now, (f) => f === 'alertWindDown')
    expect(defaults.map((a) => a.id)).toEqual([NAP_SOON_ID])

    const insights = deduceInsights(events, 'Maya', now)
    expect(insights.map((i) => i.id)).toContain('nap-prediction')
    expect(insights.map((i) => i.id)).toContain('feed-prediction')
  })
})

describe('briefingAlert', () => {
  it('schedules the next morning briefing with recent nights', () => {
    const now = new Date(2026, 9, 22, 9, 0).getTime()
    const alert = briefingAlert('Maya', '07:30', { nights: 3, nightFeeds: 2, longestStretchMin: 300 }, now)
    expect(alert).toMatchObject({ id: BRIEFING_ID, at: new Date(2026, 9, 23, 7, 30).getTime() })
    expect(alert.body).toContain('about 2 night feeds, longest stretch ~5h')
    expect(briefingAlert('Maya', '07:30', undefined, new Date(2026, 9, 22, 6, 0).getTime()).at).toBe(new Date(2026, 9, 22, 7, 30).getTime())
  })
})
