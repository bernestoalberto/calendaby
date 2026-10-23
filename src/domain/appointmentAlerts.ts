import type { Appointment } from './appointments.js'
import { buildAgenda } from './calendar.js'
import type { BabyEvent } from './events.js'
import type { NapAlert } from './notifications.js'
import { feedForecast, sleepForecast } from './predictions.js'
import { formatMinutes } from './summary.js'

/** Ids 1000+ are appointment alerts, three per visit; the nap and feed alerts use 101 to 105. */
export const APPT_ID_BASE = 1000
export const MAX_APPOINTMENTS = 20
export const APPT_ID_COUNT = MAX_APPOINTMENTS * 3

const HOUR = 3_600_000
export const LEAVE_LEAD_MS = 30 * 60_000

function clockText(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/**
 * Reminders for confirmed appointments: the day before, two hours before (with what the baby's rhythm
 * says about the slot and when they last ate), and when it is time to leave.
 */
export function appointmentAlerts(baby: string, appointments: Appointment[], events: BabyEvent[], now: number): NapAlert[] {
  const upcoming = appointments
    .filter((a) => a.status === 'confirmed' && a.startsAt !== undefined && a.startsAt > now)
    .sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0))
    .slice(0, MAX_APPOINTMENTS)

  const clashes = new Map(
    buildAgenda(upcoming, [], sleepForecast(events, now), feedForecast(events, now), now).map((i) => [i.id, i.clash]),
  )
  const lastFeed = feedForecast(events, now)?.lastFeedAt

  const out: NapAlert[] = []
  upcoming.forEach((a, n) => {
    const start = a.startsAt ?? 0
    const id = APPT_ID_BASE + n * 3
    const where = a.location ? ` at ${a.location}` : ''

    if (start - 24 * HOUR > now) {
      out.push({
        id,
        at: start - 24 * HOUR,
        title: `Tomorrow: ${a.title}`,
        body: `${baby} has an appointment at ${clockText(start)}${where}.`,
      })
    }
    if (start - 2 * HOUR > now) {
      const clash = clashes.get(a.id)
      const fed = lastFeed ? ` Last fed ${formatMinutes(Math.round((now - lastFeed) / 60_000))} ago.` : ''
      out.push({
        id: id + 1,
        at: start - 2 * HOUR,
        title: `In 2 hours: ${a.title}`,
        body: `${clockText(start)}${where}. ${clash ? `${clash}. ` : ''}Pack the diaper bag and plan a feed before leaving.${fed}`,
      })
    }
    out.push({
      id: id + 2,
      at: start - LEAVE_LEAD_MS,
      title: `Time to leave: ${a.title}`,
      body: `${baby}'s appointment is at ${clockText(start)}${where}.`,
    })
  })
  return out
}
