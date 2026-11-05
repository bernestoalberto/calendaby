import { describe, expect, it } from 'vitest'
import { CHECKUPS } from '../knowledge/checkups'
import { BabyEvent, DraftEventSchema } from './events'
import { DEFAULT_VACCINE_TYPES, vaccineId, vaccineLabel, vaccineProblem } from './vaccines'

const draft = { kind: 'vaccine', at: 1_000_000, vaccineId: 'dtap', label: 'DTaP' } as const

describe('vaccine event', () => {
  it('accepts a dose with place, lot and note', () => {
    const parsed = DraftEventSchema.safeParse({ ...draft, dose: 2, place: 'Dr Lee', lot: 'AB1234', note: 'Slight fever after' })
    expect(parsed.success).toBe(true)
  })

  it('refuses an id that is not a slug, a dose out of range and text that is too long', () => {
    expect(DraftEventSchema.safeParse({ ...draft, vaccineId: 'DTaP 2' }).success).toBe(false)
    expect(DraftEventSchema.safeParse({ ...draft, vaccineId: '' }).success).toBe(false)
    expect(DraftEventSchema.safeParse({ ...draft, dose: 0 }).success).toBe(false)
    expect(DraftEventSchema.safeParse({ ...draft, dose: 6 }).success).toBe(false)
    expect(DraftEventSchema.safeParse({ ...draft, dose: 1.5 }).success).toBe(false)
    expect(DraftEventSchema.safeParse({ ...draft, place: 'x'.repeat(81) }).success).toBe(false)
    expect(DraftEventSchema.safeParse({ ...draft, lot: 'x'.repeat(41) }).success).toBe(false)
  })

  it('is read back from storage like any other event', () => {
    expect(BabyEvent.safeParse({ ...draft, id: 'v1', loggedBy: 'mom' }).success).toBe(true)
  })
})

describe('vaccine list', () => {
  it('has unique slug ids, and every vaccine the CDC schedule names is in it', () => {
    const ids = DEFAULT_VACCINE_TYPES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(vaccineId(id)).toBe(id)
    const scheduled = CHECKUPS.us.visits.flatMap((v) => v.vaccines).join(' ')
    for (const word of ['Hepatitis B', 'DTaP', 'Hib', 'PCV', 'IPV', 'Rotavirus', 'MMR', 'varicella', 'Hepatitis A', 'Flu', 'COVID', 'RSV']) {
      expect(scheduled).toContain(word)
    }
    expect(ids).toEqual(expect.arrayContaining(['hepb', 'dtap', 'hib', 'pcv', 'ipv', 'rotavirus', 'mmr', 'varicella', 'hepa', 'flu', 'covid', 'rsv']))
  })

  it('makes a slug from a custom name and falls back to a readable label', () => {
    expect(vaccineId('Yellow fever')).toBe('yellow-fever')
    expect(vaccineLabel(DEFAULT_VACCINE_TYPES, 'dtap')).toBe('DTaP')
    expect(vaccineLabel(DEFAULT_VACCINE_TYPES, 'yellow-fever')).toBe('Yellow fever')
  })
})

describe('vaccineProblem', () => {
  const now = Date.parse('2026-11-05T10:00:00')
  it('allows today and the past', () => {
    expect(vaccineProblem({ ...draft, at: Date.parse('2026-11-05T12:00:00') }, now)).toBeUndefined()
    expect(vaccineProblem({ ...draft, at: Date.parse('2026-01-02T12:00:00') }, now)).toBeUndefined()
  })
  it('refuses a day that has not come yet', () => {
    expect(vaccineProblem({ ...draft, at: Date.parse('2026-11-07T12:00:00') }, now)).toMatch(/future/i)
  })
  it('ignores other kinds', () => {
    expect(vaccineProblem({ kind: 'note', at: now + 9e9, note: 'x' }, now)).toBeUndefined()
  })
})
