import { describe, expect, it } from 'vitest'
import type { DayStats } from './analytics'
import { DEFAULT_SLEEP_NEEDS, goalNote, needFor, smartSleepGoal } from './sleepGoal'

const day = (hours: number): DayStats => ({ day: 0, nightMin: hours * 40, dayMin: hours * 20, naps: 3, feeds: 0, nursing: 0, bottles: 0, bottleMl: 0, wet: 0, dirty: 0 })
const newborn = needFor(DEFAULT_SLEEP_NEEDS, 3)
const infant = needFor(DEFAULT_SLEEP_NEEDS, 30)

describe('needFor', () => {
  it('uses the CDC ranges by age', () => {
    expect(newborn).toMatchObject({ lowHours: 14, highHours: 17 })
    expect(infant).toMatchObject({ lowHours: 12, highHours: 16 })
    expect(needFor(DEFAULT_SLEEP_NEEDS, 80)).toMatchObject({ lowHours: 11, highHours: 14 })
    expect(needFor(DEFAULT_SLEEP_NEEDS, undefined)).toBeUndefined()
  })

  it('leaves no gap between ages', () => {
    for (let w = 0; w < 312; w++) expect(needFor(DEFAULT_SLEEP_NEEDS, w)).toBeDefined()
  })
})

describe('smartSleepGoal', () => {
  it('keeps the number a parent set when automatic is off', () => {
    expect(smartSleepGoal({ auto: false, setHours: 13, need: newborn, days: [day(16), day(16), day(16)] })).toMatchObject({ hours: 13, basis: 'set' })
  })

  it('uses the middle of the age range with no log, which can be above 15 hours for a newborn', () => {
    const goal = smartSleepGoal({ auto: true, setHours: 14, need: newborn, days: [] })
    expect(goal).toEqual({ hours: 15.5, range: { low: 14, high: 17 }, basis: 'age' })
  })

  it('follows what the baby actually sleeps once three full days are logged, inside the range', () => {
    expect(smartSleepGoal({ auto: true, setHours: 14, need: newborn, days: [day(16), day(16.5), day(16)] })).toMatchObject({ hours: 16, basis: 'log' })
    expect(smartSleepGoal({ auto: true, setHours: 14, need: newborn, days: [day(19), day(19), day(19)] }).hours).toBe(17)
    expect(smartSleepGoal({ auto: true, setHours: 14, need: newborn, days: [day(9), day(9), day(9)] }).hours).toBe(14)
  })

  it('ignores a day that was barely logged and a log of fewer than three days', () => {
    expect(smartSleepGoal({ auto: true, setHours: 14, need: infant, days: [day(14), day(1), day(14)] })).toMatchObject({ basis: 'age', hours: 14 })
  })

  it('falls back to the set number when the age is unknown', () => {
    expect(smartSleepGoal({ auto: true, setHours: 14, need: undefined, days: [] })).toEqual({ hours: 14, range: undefined, basis: 'set' })
  })
})

describe('goalNote', () => {
  it('says where the number came from', () => {
    expect(goalNote({ hours: 15.5, range: { low: 14, high: 17 }, basis: 'age' })).toBe('Set by age, typical 14 to 17 h for this age')
    expect(goalNote({ hours: 16, range: { low: 14, high: 17 }, basis: 'log' })).toBe('Based on recent days, typical 14 to 17 h for this age')
    expect(goalNote({ hours: 14, basis: 'set' })).toBeUndefined()
  })
})
