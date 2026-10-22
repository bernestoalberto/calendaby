import { describe, expect, it } from 'vitest'
import { parseLog, resolveTime } from './capture'

// Local time 2026-10-22 16:10
const now = new Date(2026, 9, 22, 16, 10)
const at = (h: number, m = 0, day = 22) => new Date(2026, 9, day, h, m).getTime()

describe('parseLog', () => {
  it('turns one sentence into several events', () => {
    const { drafts, unsure } = parseLog("fed 120 ml at 3, she's down now", now)
    expect(unsure).toEqual([])
    expect(drafts).toEqual([
      { kind: 'feed', at: at(15), method: 'bottle', amountMl: 120, side: undefined },
      { kind: 'sleep', at: now.getTime(), phase: 'start' },
    ])
  })

  it('converts ounces and reads breastfeeding sides', () => {
    expect(parseLog('bottle 4oz', now).drafts[0]).toMatchObject({ method: 'bottle', amountMl: 118 })
    expect(parseLog('nursed left side 20 min ago', now).drafts[0]).toMatchObject({
      method: 'breast',
      side: 'left',
      at: now.getTime() - 20 * 60_000,
    })
  })

  it('keeps a wet and dirty diaper as one event', () => {
    expect(parseLog('wet and dirty diaper', now).drafts).toEqual([
      { kind: 'diaper', at: now.getTime(), contents: 'both' },
    ])
  })

  it('carries a stated time to the clauses after it', () => {
    const { drafts } = parseLog('woke at 2:30, wet diaper', now)
    expect(drafts.map((d) => [d.kind, d.at])).toEqual([
      ['sleep', at(14, 30)],
      ['diaper', at(14, 30)],
    ])
  })

  it('logs medicine with a dose', () => {
    expect(parseLog('gave tylenol 2.5 ml', now).drafts[0]).toMatchObject({ kind: 'med', name: 'tylenol', doseMl: 2.5 })
  })

  it('returns what it could not understand instead of guessing', () => {
    expect(parseLog('grandma visited', now)).toEqual({ drafts: [], unsure: ['grandma visited'] })
  })
})

describe('resolveTime', () => {
  it('picks the most recent past occurrence of an ambiguous hour', () => {
    expect(resolveTime('at 3', now)).toBe(at(15))
    expect(resolveTime('at 5', now)).toBe(at(5))
    expect(resolveTime('at 11pm', now)).toBe(at(23, 0, 21))
  })

  it('handles relative times and no time at all', () => {
    expect(resolveTime('2 hours ago', now)).toBe(now.getTime() - 2 * 3_600_000)
    expect(resolveTime('fed', now)).toBeUndefined()
  })
})
