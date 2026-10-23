import type { Appointment } from './appointments.js'
import type { SleepForecast, FeedForecast } from './predictions.js'

export interface AgendaItem {
  id: string
  title: string
  startsAt: number
  endsAt: number
  allDay: boolean
  source: 'appointment' | 'calendar'
  status?: Appointment['status']
  /** What the baby's rhythm says about this slot, if anything. */
  clash?: string
}

export interface CalendarEvent {
  id: string
  title: string
  startsAt: number
  endsAt: number
  allDay: boolean
}

const HOUR = 3_600_000
const DEFAULT_VISIT = HOUR
const DEFAULT_NAP_MIN = 60
const FEED_MARGIN = 20 * 60_000

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

function clockText(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/**
 * Appointments (not dismissed, with a time) merged with calendar events, soonest first,
 * each timed item flagged when it lands on the predicted nap or next feed.
 */
export function buildAgenda(
  appointments: Appointment[],
  events: CalendarEvent[],
  sleep: SleepForecast | undefined,
  feed: FeedForecast | undefined,
  now: number,
): AgendaItem[] {
  const items: AgendaItem[] = []
  for (const a of appointments) {
    if (a.status === 'dismissed' || a.startsAt === undefined) continue
    items.push({
      id: a.id,
      title: a.title,
      startsAt: a.startsAt,
      endsAt: a.endsAt ?? a.startsAt + DEFAULT_VISIT,
      allDay: false,
      source: 'appointment',
      status: a.status,
    })
  }
  for (const e of events) items.push({ ...e, source: 'calendar' })

  const napAt = sleep?.nap?.nextNapAt
  const napEnd = napAt === undefined ? undefined : napAt + (sleep?.usualNapMin ?? DEFAULT_NAP_MIN) * 60_000
  const feedAt = feed?.nextFeedAt

  return items
    .filter((i) => i.endsAt > now)
    .map((i) => {
      if (i.allDay) return i
      if (napAt !== undefined && napEnd !== undefined && overlaps(i.startsAt, i.endsAt, napAt, napEnd)) {
        return { ...i, clash: `Overlaps the predicted nap around ${clockText(napAt)}` }
      }
      if (feedAt !== undefined && overlaps(i.startsAt, i.endsAt, feedAt - FEED_MARGIN, feedAt + FEED_MARGIN)) {
        return { ...i, clash: `Close to the next feed around ${clockText(feedAt)}` }
      }
      return i
    })
    .sort((a, b) => a.startsAt - b.startsAt)
}
