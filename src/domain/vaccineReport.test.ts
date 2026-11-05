import { describe, expect, it } from 'vitest'
import type { BabyEvent } from './events'
import { vaccineReport, withoutVaccineDetails } from './vaccineReport'

type Vaccine = Extract<BabyEvent, { kind: 'vaccine' }>
const dose = (id: string, vaccineId: string, label: string, at: number, extra: Partial<Vaccine> = {}): Vaccine => ({
  id,
  kind: 'vaccine',
  at,
  loggedBy: 'mom',
  vaccineId,
  label,
  ...extra,
})
const date = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const day = Date.parse('2026-09-01T12:00:00Z')

describe('vaccineReport', () => {
  it('lists each recorded dose by date and drops place, lot and notes', () => {
    const r = vaccineReport([dose('a', 'dtap', 'DTaP', day, { dose: 1, place: 'Dr Lee', lot: 'AB1', note: 'fussy' })], 10, date)
    expect(r.recorded).toEqual([{ vaccine: 'DTaP', dose: 1, date: '2026-09-01' }])
    expect(JSON.stringify(r)).not.toMatch(/Dr Lee|AB1|fussy/)
  })

  it('lists what the CDC schedule names for the age with the recorded dose counts, and cites it', () => {
    const r = vaccineReport([dose('a', 'dtap', 'DTaP', day), dose('b', 'dtap', 'DTaP', day + 1)], 10, date)
    expect(r.listedForAge.map((v) => v.visit)).toEqual(['2 months', '4 months'])
    expect(r.listedForAge[0].items.find((i) => i.text === 'DTaP')?.recorded).toEqual(['DTaP: 2 doses recorded'])
    expect(r.listedForAge[0].items.find((i) => i.text === 'Hib')?.recorded).toEqual(['Hib: not recorded yet'])
    expect(r.sources.length).toBeGreaterThan(0)
    expect(r.sources.every((s) => s.url.startsWith('https://'))).toBe(true)
  })

  it('tells the assistant it may not call anything due, late or missed, and to send questions to the pediatrician', () => {
    const r = vaccineReport([], 10, date)
    expect(r.rules).toMatch(/pediatrician/i)
    expect(r.rules).toMatch(/never say/i)
    expect(r.recorded).toEqual([])
  })

  it('says the schedule needs a birth date, instead of guessing an age', () => {
    const r = vaccineReport([], undefined, date)
    expect(r.listedForAge).toEqual([])
    expect(r.ageNote).toMatch(/birth date/i)
  })

  it('strips place, lot and note from a vaccine entry before it goes to the assistant, and leaves other entries alone', () => {
    const e = dose('a', 'dtap', 'DTaP', day, { dose: 1, place: 'Dr Lee', lot: 'AB1', note: 'fussy' })
    expect(withoutVaccineDetails(e)).toEqual({ id: 'a', kind: 'vaccine', at: day, loggedBy: 'mom', vaccineId: 'dtap', label: 'DTaP', dose: 1 })
    const note: BabyEvent = { id: 'n', kind: 'note', at: day, loggedBy: 'mom', note: 'x' }
    expect(withoutVaccineDetails(note)).toBe(note)
  })
})
