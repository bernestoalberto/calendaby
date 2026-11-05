import { describe, expect, it } from 'vitest'
import { CHECKUPS } from '../knowledge/checkups'
import type { BabyEvent } from './events'
import { DEFAULT_VACCINE_TYPES } from './vaccines'
import { vaccineView } from './vaccineRecord'

type Vaccine = Extract<BabyEvent, { kind: 'vaccine' }>
const given = (id: string, vaccineId: string, at: number, extra: Partial<Vaccine> = {}): BabyEvent => ({
  id,
  kind: 'vaccine',
  at,
  loggedBy: 'mom',
  vaccineId,
  label: DEFAULT_VACCINE_TYPES.find((t) => t.id === vaccineId)?.label ?? vaccineId,
  ...extra,
})
const WEEK = 7 * 86_400_000

describe('vaccineView', () => {
  it('lists the record newest first and ignores other kinds of entries', () => {
    const events: BabyEvent[] = [
      given('a', 'hepb', 1 * WEEK, { dose: 1 }),
      { id: 'n', kind: 'note', at: 5 * WEEK, loggedBy: 'mom', note: 'x' },
      given('b', 'dtap', 9 * WEEK, { dose: 1, place: 'Dr Lee' }),
    ]
    const view = vaccineView(events, DEFAULT_VACCINE_TYPES, 10)
    expect(view.recorded.map((r) => r.id)).toEqual(['b', 'a'])
    expect(view.recorded[0]).toMatchObject({ label: 'DTaP', dose: 1, place: 'Dr Lee' })
  })

  it('shows the visit at or before the age and the next one, from the CDC schedule', () => {
    const view = vaccineView([], DEFAULT_VACCINE_TYPES, 10)
    expect(view.rows.map((r) => r.label)).toEqual(['2 months', '4 months'])
    expect(view.rows[0].items.map((i) => i.text)).toEqual(CHECKUPS.us.visits.find((v) => v.label === '2 months')?.vaccines)
    expect(view.note).toBe(CHECKUPS.us.note)
    expect(view.sources.map((s) => s.org)).toContain('CDC')
  })

  it('counts recorded doses per listed vaccine and never calls anything overdue or missed', () => {
    const events = [given('a', 'dtap', 8 * WEEK, { dose: 1 }), given('b', 'dtap', 9 * WEEK, { dose: 2 }), given('c', 'rotavirus', 8 * WEEK)]
    const view = vaccineView(events, DEFAULT_VACCINE_TYPES, 10)
    const items = view.rows[0].items
    expect(items.find((i) => i.text === 'DTaP')?.matches).toEqual([{ label: 'DTaP', doses: 2 }])
    expect(items.find((i) => i.text === 'Rotavirus')?.matches).toEqual([{ label: 'Rotavirus', doses: 1 }])
    expect(items.find((i) => i.text === 'Hib')?.matches).toEqual([{ label: 'Hib', doses: 0 }])
    expect(JSON.stringify(view)).not.toMatch(/overdue|missed|behind/i)
  })

  it('matches a listed line that names two vaccines, and keeps Hepatitis A apart from Hepatitis B', () => {
    const events = [given('a', 'hepb', 1 * WEEK), given('b', 'ipv', 8 * WEEK)]
    const six = vaccineView(events, DEFAULT_VACCINE_TYPES, 26).rows.find((r) => r.label === '6 months')
    expect(six?.items.find((i) => i.text.startsWith('Hepatitis B dose 3'))?.matches).toEqual([
      { label: 'Hepatitis B', doses: 1 },
      { label: 'Polio (IPV)', doses: 1 },
    ])
    const twelve = vaccineView(events, DEFAULT_VACCINE_TYPES, 52).rows.find((r) => r.label === '12 months')
    expect(twelve?.items.find((i) => i.text.startsWith('Hepatitis A'))?.matches).toEqual([{ label: 'Hepatitis A', doses: 0 }])
  })

  it('keeps a custom vaccine in the record, and shows no schedule without an age', () => {
    const view = vaccineView([given('a', 'yellow-fever', WEEK)], DEFAULT_VACCINE_TYPES, undefined)
    expect(view.recorded).toHaveLength(1)
    expect(view.rows).toEqual([])
  })

  it('shows only the last visit once the baby is past the schedule', () => {
    const view = vaccineView([], DEFAULT_VACCINE_TYPES, 400)
    expect(view.rows.map((r) => r.label)).toEqual(['3 years'])
  })
})
