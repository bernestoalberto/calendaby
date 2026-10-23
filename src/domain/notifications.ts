import type { NapForecast } from './analytics.js'
import { formatMinutes } from './summary.js'

export interface NapAlert {
  id: number
  at: number
  title: string
  body: string
}

export const NAP_SOON_ID = 101
export const NAP_DUE_ID = 102
export const NAP_LEAD_MS = 15 * 60_000

function clockText(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/**
 * Upcoming notifications for the current wake window:
 * 1) 15 minutes before the predicted nap (wind-down reminder)
 * 2) At the predicted nap time
 */
export function napAlerts(baby: string, forecast: NapForecast | undefined, asleep: boolean, now: number): NapAlert[] {
  if (asleep || !forecast || forecast.nextNapAt === undefined) return []
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

