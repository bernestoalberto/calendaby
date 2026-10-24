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

  it('logs tummy time and other activities with a duration', () => {
    expect(parseLog('tummy time 5 min', now).drafts).toEqual([
      { kind: 'activity', at: now.getTime(), type: 'tummy', durationMin: 5 },
    ])
    expect(parseLog('bath at 3', now).drafts).toEqual([{ kind: 'activity', at: at(15), type: 'bath', durationMin: undefined }])
    expect(parseLog('played outside for 1 hour', now).drafts[0]).toMatchObject({ type: 'outdoor', durationMin: 60 })
  })

  it('tells physical activities apart from outings', () => {
    expect(parseLog('crawled 10 min', now).drafts[0]).toMatchObject({ type: 'crawl', durationMin: 10 })
    expect(parseLog('swimming 20 minutes', now).drafts[0]).toMatchObject({ type: 'swim', durationMin: 20 })
    expect(parseLog('walking around the house', now).drafts[0]).toMatchObject({ type: 'walk' })
    expect(parseLog('went for a walk', now).drafts[0]).toMatchObject({ type: 'outdoor' })
  })

  it('does not read "5 min ago" as a duration', () => {
    expect(parseLog('tummy time 5 min ago', now).drafts).toEqual([
      { kind: 'activity', at: now.getTime() - 5 * 60_000, type: 'tummy', durationMin: undefined },
    ])
  })

  it('logs pumping and does not count it as a feed', () => {
    expect(parseLog('pumped 4 oz left', now).drafts).toEqual([
      { kind: 'pump', at: now.getTime(), amountMl: 118, side: 'left', durationMin: undefined },
    ])
    expect(parseLog('breast pump 20 min', now).drafts.map((d) => d.kind)).toEqual(['pump'])
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
