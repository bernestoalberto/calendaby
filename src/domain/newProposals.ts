import type { Appointment } from './appointments.js'

/**
 * Appointments waiting for a decision that this phone has not been told about yet. `seen` is undefined the first time
 * the phone looks: that list is the starting point, so nothing old is announced.
 */
export function newProposals(seen: ReadonlySet<string> | undefined, list: Appointment[]): Appointment[] {
  if (seen === undefined) return []
  return list.filter((a) => (a.status === 'proposed' || a.status === 'review') && !seen.has(a.id))
}

/** The text of the notification for freshly found appointments. The email's words are data and shown as plain text only. */
export function proposalAlert(baby: string, found: Appointment[]): { title: string; body: string } {
  if (found.length === 1) {
    const a = found[0]
    const when = a.startsAt
      ? new Date(a.startsAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'no time found, check the email'
    return { title: 'Found an appointment in your email', body: `${a.title} (${when}). Confirm it so ${baby} gets reminders.` }
  }
  return { title: `Found ${found.length} appointments in your email`, body: `Open Calendar to confirm them so ${baby} gets reminders.` }
}
