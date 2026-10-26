import { describe, expect, it } from 'vitest'
import type { Appointment } from './appointments'
import type { BabyEvent } from './events'
import { visitPrep } from './visitPrep'

const HOUR = 3_600_000
const WEEK = 7 * 24 * HOUR
const now = new Date(2026, 9, 26, 10, 0).getTime()
const born = (weeksAgo: number) => new Date(now - weeksAgo * WEEK).toISOString().slice(0, 10)
const visit = (title: string, startsAt: number): Appointment => ({ id: 'gmail:1', title, startsAt, status: 'confirmed' })
const feeds = (every: number): BabyEvent[] =>
  Array.from({ length: 6 }, (_, i) => ({ kind: 'feed', at: now - (6 - i) * every * 60_000, method: 'bottle', amountMl: 120 }) as BabyEvent)

describe('visitPrep', () => {
  it('explains the checkup for the baby\'s age on the visit day, with sources', () => {
    const prep = visitPrep(visit('4 month checkup', now + 3 * 24 * HOUR), 'EJ', born(17), [], now)
    const text = prep.expect.map((l) => l.text).join(' ')
    expect(text).toContain('4 months')
    expect(text).toContain('DTaP')
    expect(prep.expect.every((l) => l.source.url.startsWith('https://'))).toBe(true)
  })

  it('uses the age at the visit, not today', () => {
    const prep = visitPrep(visit('Well baby visit', now + 5 * WEEK), 'EJ', born(3.5), [], now)
    expect(prep.expect.map((l) => l.text).join(' ')).toContain('2 months')
  })

  it('adds the cited fever advice after visits that include shots', () => {
    const prep = visitPrep(visit('Vaccinations', now + 24 * HOUR), 'EJ', born(9), [], now)
    expect(prep.expect.some((l) => /fever/i.test(l.text))).toBe(true)
  })

  it('has no expectations for a visit that is not a checkup, but still plans the day', () => {
    const prep = visitPrep(visit('Dentist for mom', now + 24 * HOUR), 'EJ', born(17), [], now)
    expect(prep.expect).toEqual([])
    expect(prep.plan.join(' ')).toContain('Leave by')
  })

  it('says so when the birth date is missing instead of guessing the visit', () => {
    const prep = visitPrep(visit('4 month checkup', now + 24 * HOUR), 'EJ', undefined, [], now)
    expect(prep.expect).toEqual([])
    expect(prep.plan.join(' ')).toContain('birth date')
  })

  it('uses the baby\'s own feeding rhythm for the feed plan', () => {
    const prep = visitPrep(visit('Checkup', now + 24 * HOUR), 'EJ', born(17), feeds(150), now)
    expect(prep.plan.join(' ')).toMatch(/every 2h 30m/)
  })
})
