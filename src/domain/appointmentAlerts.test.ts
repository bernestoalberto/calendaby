import { describe, expect, it } from 'vitest'
import { APPT_ID_BASE, appointmentAlerts } from './appointmentAlerts'
import type { Appointment } from './appointments'

const now = Date.parse('2026-10-23T08:00:00Z')
const visit = (id: string, hoursAhead: number, status: Appointment['status'] = 'confirmed'): Appointment => ({
  id,
  title: 'Well visit',
  startsAt: now + hoursAhead * 3_600_000,
  status,
})

describe('appointmentAlerts', () => {
  it('schedules day-before, two-hours and leave alerts for a visit far enough ahead', () => {
    const out = appointmentAlerts('Mia', [visit('a', 48)], [], now)
    expect(out.map((a) => a.id)).toEqual([APPT_ID_BASE, APPT_ID_BASE + 1, APPT_ID_BASE + 2])
    expect(out.map((a) => a.at)).toEqual([now + 24 * 3_600_000, now + 46 * 3_600_000, now + 47.5 * 3_600_000])
  })

  it('skips alerts already in the past and visits that are not confirmed', () => {
    const out = appointmentAlerts('Mia', [visit('soon', 1), visit('p', 5, 'proposed'), visit('d', 5, 'dismissed')], [], now)
    expect(out.map((a) => a.title)).toEqual(['Time to leave: Well visit'])
  })

  it('gives every visit its own ids', () => {
    const ids = appointmentAlerts('Mia', [visit('a', 48), visit('b', 72)], [], now).map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
