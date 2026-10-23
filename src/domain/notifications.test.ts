import { describe, expect, it } from 'vitest'
import { NAP_DUE_ID, NAP_LEAD_MS, NAP_SOON_ID, napAlerts } from './notifications'

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

