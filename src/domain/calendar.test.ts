import { describe, expect, it } from 'vitest'
import type { Appointment } from './appointments'
import { buildAgenda } from './calendar'

const at = (hhmm: string) => Date.parse(`2026-10-23T${hhmm}:00Z`)
const now = at('08:00')
const visit = (id: string, start: string, status: Appointment['status'] = 'confirmed'): Appointment => ({
  id,
  title: 'Visit',
  startsAt: at(start),
  status,
})
const sleep = { nap: { wakeWindowMin: 90, nextNapAt: at('13:00') }, usualNapMin: 60 }

describe('buildAgenda', () => {
  it('merges appointments and calendar events, soonest first, dropping dismissed and finished ones', () => {
    const out = buildAgenda(
      [visit('a', '15:00'), visit('b', '09:00', 'dismissed'), visit('c', '07:00')],
      [{ id: 'e', title: 'Standup', startsAt: at('10:00'), endsAt: at('10:30'), allDay: false }],
      undefined,
      undefined,
      now,
    )
    expect(out.map((i) => [i.id, i.source])).toEqual([
      ['e', 'calendar'],
      ['a', 'appointment'],
    ])
  })

  it('flags items that land on the predicted nap or next feed', () => {
    const out = buildAgenda(
      [visit('nap', '13:30'), visit('feed', '16:10'), visit('free', '18:00')],
      [{ id: 'day', title: 'Holiday', startsAt: at('00:00'), endsAt: at('23:59'), allDay: true }],
      sleep,
      { intervalMin: 180, lastFeedAt: at('13:00'), nextFeedAt: at('16:00') },
      now,
    )
    const clash = Object.fromEntries(out.map((i) => [i.id, i.clash]))
    expect(clash.nap).toMatch(/predicted nap/)
    expect(clash.feed).toMatch(/next feed/)
    expect(clash.free).toBeUndefined()
    expect(clash.day).toBeUndefined()
  })
})
