import { describe, expect, it } from 'vitest'
<<<<<<< HEAD
import { DEFAULT_AGE_NORMS, ageLabel, normFor } from './ageNorms'
=======
import { DEFAULT_AGE_NORMS, ageInWeeks, ageLabel, normFor } from './ageNorms'
>>>>>>> fc9c5a4 (Add pediatric knowledge layer to the agent: advice cites CDC, NIH and WHO instead of the model's memory 2)
import type { BabyEvent, DraftEvent } from './events'
import { outlook, quantile, tonight } from './outlook'

const at = (h: number, m = 0, day = 22) => new Date(2026, 9, day, h, m).getTime()
let n = 0
const ev = (e: DraftEvent): BabyEvent => ({ ...e, id: `o${n++}`, loggedBy: 'dad' })
const sleep = (a: number, b?: number) => [
  ev({ kind: 'sleep', at: a, phase: 'start' }),
  ...(b === undefined ? [] : [ev({ kind: 'sleep', at: b, phase: 'end' })]),
]
const feed = (t: number) => ev({ kind: 'feed', at: t, method: 'bottle', amountMl: 120 })
const norm16 = normFor(DEFAULT_AGE_NORMS, 16)

/** Three nights and days: up at 7, naps after 90 and 120 minutes awake, bed at 19:30, one night feed. */
function threeDays(): BabyEvent[] {
  return [19, 20, 21].flatMap((d) => [
    ...sleep(at(19, 30, d - 1), at(7, 0, d)),
    feed(at(2, 0, d)),
    ...sleep(at(8, 30, d), at(9, 30, d)),
    ...sleep(at(11, 30, d), at(12, 30, d)),
    ...[7, 10, 13, 16, 19].map((h) => feed(at(h, 0, d))),
  ])
}

describe('quantile', () => {
  it('interpolates between sorted values', () => {
    expect(quantile([40, 10, 30, 20], 0.5)).toBe(25)
    expect(quantile([10, 20, 30, 40, 50], 0.25)).toBe(20)
  })
})

describe('age norms', () => {
  it('finds the band for an age and labels it', () => {
<<<<<<< HEAD
=======
    expect(ageInWeeks('2026-06-01', at(12))).toBe(20)
    expect(ageInWeeks('2027-01-01', at(12))).toBeUndefined()
>>>>>>> fc9c5a4 (Add pediatric knowledge layer to the agent: advice cites CDC, NIH and WHO instead of the model's memory 2)
    expect(normFor(DEFAULT_AGE_NORMS, 20)).toMatchObject({ wakeMinLow: 105, wakeMinHigh: 150 })
    expect(ageLabel(6)).toBe('6 weeks')
    expect(ageLabel(20)).toBe('4 months')
  })
})

describe('outlook', () => {
  it('uses the age norm when there is only one sleep logged', () => {
    const [nap] = outlook(sleep(at(8), at(9)), norm16, 16, at(9, 30)).items
    expect(nap).toMatchObject({ id: 'nap', basis: 'age', from: at(10, 15), to: at(11), note: 'Typical for 3 months' })
  })

  it('blends with the norm while own wake windows are few', () => {
    const events = [...sleep(at(7), at(8)), ...sleep(at(9, 30), at(10))]
    const [nap] = outlook(events, norm16, 16, at(10, 5)).items
    // One 90 minute window: middle of (90+75)/2 and (90+120)/2.
    expect(nap).toMatchObject({ basis: 'blend', from: at(11, 22, 22) + 30_000, to: at(11, 45) })
  })

  it('uses own wake windows for the same nap of the day', () => {
    const events = [...threeDays(), ...sleep(at(19, 30, 21), at(7)), feed(at(7)), ...sleep(at(8, 30), at(9, 30))]
    const items = outlook(events, norm16, 16, at(10)).items
    const nap = items.find((i) => i.id === 'nap')
    expect(nap).toMatchObject({ title: 'Nap 2', basis: 'own', from: at(11, 30), to: at(11, 30) })
    expect(items.find((i) => i.id === 'feed')).toMatchObject({ basis: 'own', from: at(10), to: at(10) })
    expect(items.map((i) => i.id)).toEqual(['feed', 'nap', 'bedtime'])
  })

  it('skips a nap the baby never takes and leaves the evening to bedtime', () => {
    const events = [...threeDays(), ...sleep(at(19, 30, 21), at(7)), ...sleep(at(8, 30), at(9, 30)), ...sleep(at(11, 30), at(12, 30))]
    expect(outlook(events, norm16, 16, at(13)).items.map((i) => i.id)).toEqual(['bedtime'])
  })

  it('shows the wake-up range during a nap and drops a stale nap', () => {
    const events = [...threeDays(), ...sleep(at(19, 30, 21), at(7)), ...sleep(at(8, 30))]
    expect(outlook(events, norm16, 16, at(9)).items[0]).toMatchObject({ id: 'wake', from: at(9, 30), to: at(9, 30) })
    expect(outlook(sleep(at(8), at(9)), norm16, 16, at(13)).items).toEqual([])
  })
})

describe('tonight', () => {
  it('needs two nights, then gives night feeds and the longest stretch', () => {
    expect(tonight(sleep(at(19, 30, 21), at(7)), at(17))).toBeUndefined()
    const t = tonight([...threeDays(), ...sleep(at(19, 30, 21), at(7))], at(17))
    expect(t).toMatchObject({ nights: 4, nightFeeds: 1, longestStretchMin: 690, bedtimeFrom: at(19, 30), bedtimeTo: at(19, 30) })
  })
})
