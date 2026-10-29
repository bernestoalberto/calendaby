import { describe, expect, it } from 'vitest'
import { DEFAULT_MILESTONES } from '../knowledge/milestones'
import { DraftEventSchema, type BabyEvent } from './events'
import { answers, milestoneReport, milestoneView, wholeMonths } from './milestones'

const mark = (id: string, state: 'yes' | 'not_yet' | 'unsure', at: number): BabyEvent => ({
  id: `${id}-${at}`,
  kind: 'milestone',
  at,
  loggedBy: 'dad',
  milestoneId: id,
  state,
  text: DEFAULT_MILESTONES.find((m) => m.id === id)?.text ?? 'x',
})

describe('the CDC checklists', () => {
  it('cover 2 months to 3 years, four areas each, with unique ids', () => {
    const ages = [...new Set(DEFAULT_MILESTONES.map((m) => m.ageMonths))]
    expect(ages).toEqual([2, 4, 6, 9, 12, 15, 18, 24, 30, 36])
    expect(new Set(DEFAULT_MILESTONES.map((m) => m.id)).size).toBe(DEFAULT_MILESTONES.length)
    for (const age of ages) expect(new Set(DEFAULT_MILESTONES.filter((m) => m.ageMonths === age).map((m) => m.area)).size).toBe(4)
  })

  it('has the published items for the 6 month checklist', () => {
    const six = DEFAULT_MILESTONES.filter((m) => m.ageMonths === 6).map((m) => m.text)
    expect(six).toContain('Rolls from tummy to back')
    expect(six).toContain('Knows familiar people')
    expect(six).toHaveLength(12)
  })

  it('every id passes the event schema', () => {
    for (const m of DEFAULT_MILESTONES) {
      expect(DraftEventSchema.safeParse({ kind: 'milestone', at: 1, milestoneId: m.id, state: 'yes', text: m.text }).success).toBe(true)
    }
    expect(DraftEventSchema.safeParse({ kind: 'milestone', at: 1, milestoneId: 'banana', state: 'yes', text: 'x' }).success).toBe(false)
    expect(DraftEventSchema.safeParse({ kind: 'milestone', at: 1, milestoneId: '6-movement-1', state: 'late', text: 'x' }).success).toBe(false)
  })
})

describe('answers', () => {
  it('keeps the latest answer for each item', () => {
    const given = answers([mark('6-movement-1', 'not_yet', 100), mark('6-movement-1', 'yes', 200), mark('6-social-1', 'unsure', 150)])
    expect(given.get('6-movement-1')).toMatchObject({ state: 'yes', at: 200 })
    expect(given.get('6-social-1')?.state).toBe('unsure')
  })
})

describe('milestoneView', () => {
  it('shows the latest checklist the baby is old enough for and the next one', () => {
    const view = milestoneView(DEFAULT_MILESTONES, [], 7)
    expect(view.current?.ageMonths).toBe(6)
    expect(view.next?.ageMonths).toBe(9)
    expect(view.earlier.map((b) => b.ageMonths)).toEqual([4, 2])
  })

  it('has no current checklist before 2 months and starts at the first one', () => {
    const view = milestoneView(DEFAULT_MILESTONES, [], 1)
    expect(view.current).toBeUndefined()
    expect(view.next?.ageMonths).toBe(2)
  })

  it('shows nothing without a birth date', () => {
    expect(milestoneView(DEFAULT_MILESTONES, [], undefined)).toEqual({ earlier: [], raise: [] })
  })

  it('drops an earlier checklist once every item is a yes, and lists "not yet" to raise', () => {
    const twoMonths = DEFAULT_MILESTONES.filter((m) => m.ageMonths === 2).map((m) => mark(m.id, 'yes', 10))
    const view = milestoneView(DEFAULT_MILESTONES, [...twoMonths, mark('4-language-1', 'not_yet', 20), mark('6-movement-1', 'not_yet', 30), mark('6-movement-1', 'yes', 40)], 7)
    expect(view.earlier.map((b) => b.ageMonths)).toEqual([4])
    expect(view.raise.map((i) => i.milestone.id)).toEqual(['4-language-1'])
  })
})

describe('milestoneReport', () => {
  it("gives only the baby's own answers and the CDC items", () => {
    const report = milestoneReport(DEFAULT_MILESTONES, [mark('6-movement-1', 'yes', 10), mark('6-social-2', 'not_yet', 20), mark('4-cognitive-1', 'unsure', 30)], 6)
    expect(report.checklist).toMatchObject({ forAgeMonths: 6, reached: 1, total: 12 })
    expect(report.notYet).toEqual([{ forAgeMonths: 6, area: 'Social & emotional', text: 'Likes to look at themself in a mirror' }])
    expect(report.notSure).toHaveLength(1)
    expect(report.comingUp?.forAgeMonths).toBe(9)
  })

  it('has nulls when the age is unknown', () => {
    expect(milestoneReport(DEFAULT_MILESTONES, [], undefined)).toMatchObject({ ageMonths: null, checklist: null, comingUp: null })
  })
})

describe('wholeMonths', () => {
  it('counts calendar months', () => {
    expect(wholeMonths('2026-01-15', Date.parse('2026-07-14T12:00'))).toBe(5)
    expect(wholeMonths('2026-01-15', Date.parse('2026-07-15T12:00'))).toBe(6)
    expect(wholeMonths(undefined, 1)).toBeUndefined()
    expect(wholeMonths('2030-01-01', Date.parse('2026-07-15T12:00'))).toBeUndefined()
  })
})
