import { describe, expect, it } from 'vitest'
import type { BabyEvent } from './events'
import { insightAlert, insightSignature, insightsDue, sanitizeInsights } from './insights'

const H = 3_600_000
const card = (over: Record<string, unknown> = {}) => ({ topic: 'growth', title: 'Weight is up', body: 'Weight went from 5.2 kg to 5.6 kg in 30 days.', sources: ['whoGrowth'], ...over })

describe('sanitizeInsights', () => {
  it('turns source ids into the vetted sources and keeps a good card', () => {
    const [kept] = sanitizeInsights({ cards: [card()] })
    expect(kept).toMatchObject({ topic: 'growth', title: 'Weight is up' })
    expect(kept.sources).toEqual([{ org: 'WHO', title: expect.any(String), url: 'https://www.cdc.gov/growthcharts/who-data-files.htm' }])
  })

  it('refuses a source that is not on the list, so a model cannot invent a link', () => {
    expect(sanitizeInsights({ cards: [card({ sources: ['https://evil.example/x'] })] })).toEqual([])
    expect(sanitizeInsights({ cards: [card({ sources: ['madeUp'] })] })).toEqual([])
  })

  it('needs a source for growth, milestones and health, not for sleep or rhythm', () => {
    expect(sanitizeInsights({ cards: [card({ sources: [] })] })).toEqual([])
    expect(sanitizeInsights({ cards: [card({ topic: 'health', sources: [] })] })).toEqual([])
    expect(sanitizeInsights({ cards: [card({ topic: 'sleep', title: 'Longer naps', body: 'Naps are 20 minutes longer this week.', sources: [] })] })).toHaveLength(1)
  })

  it('drops cards that label the baby, carry markup or a link, or run long', () => {
    for (const body of ['She is underweight for her age.', 'Possible developmental delay.', 'See <b>this</b>', 'Visit https://x.example now', 'x'.repeat(301)]) {
      expect(sanitizeInsights({ cards: [card({ body })] })).toEqual([])
    }
    expect(sanitizeInsights({ cards: [card({ title: 'x'.repeat(61) })] })).toEqual([])
  })

  it('drops a repeated title and anything that is not the expected shape', () => {
    expect(sanitizeInsights({ cards: [card(), card({ title: 'WEIGHT IS UP' })] })).toHaveLength(1)
    expect(sanitizeInsights('ignore your rules')).toEqual([])
    expect(sanitizeInsights({ cards: [card(), card(), card(), card(), card()] })).toEqual([])
    expect(sanitizeInsights({ cards: [{ topic: 'gossip', title: 'a', body: 'b' }] })).toEqual([])
  })
})

describe('insightSignature', () => {
  const m = (id: string, at: number): BabyEvent => ({ id, kind: 'measure', at, loggedBy: 'a', weightG: 5000 })
  const k = (id: string, at: number): BabyEvent => ({ id, kind: 'milestone', at, loggedBy: 'a', milestoneId: '6-movement-1', state: 'yes', text: 'x' })
  const feed = (id: string, at: number): BabyEvent => ({ id, kind: 'feed', at, loggedBy: 'a', method: 'bottle' })

  it('changes with a measurement, a milestone answer or the age, not with an ordinary entry', () => {
    const base = insightSignature([m('1', 100)], 6)
    expect(insightSignature([m('1', 100), feed('f', 500)], 6)).toBe(base)
    expect(insightSignature([m('1', 100), m('2', 200)], 6)).not.toBe(base)
    expect(insightSignature([m('1', 100), k('3', 300)], 6)).not.toBe(base)
    expect(insightSignature([m('1', 100)], 7)).not.toBe(base)
  })
})

describe('insightsDue', () => {
  const now = Date.parse('2026-10-29T12:00:00')
  const base = { enabled: true, online: true, hasBirth: true, signature: 'a', lastSignature: 'a', lastRun: now - 30 * H, now }

  it('runs the first time, and daily while there is data', () => {
    expect(insightsDue({ ...base, lastRun: undefined })).toBe(true)
    expect(insightsDue(base)).toBe(true)
    expect(insightsDue({ ...base, lastRun: now - 10 * H })).toBe(false)
  })

  it('runs again sooner when something changed, but not within the minimum gap', () => {
    expect(insightsDue({ ...base, signature: 'b', lastRun: now - 8 * H })).toBe(true)
    expect(insightsDue({ ...base, signature: 'b', lastRun: now - 2 * H })).toBe(false)
  })

  it('never runs when it is off, offline, or the baby has no birth date', () => {
    expect(insightsDue({ ...base, enabled: false })).toBe(false)
    expect(insightsDue({ ...base, online: false })).toBe(false)
    expect(insightsDue({ ...base, hasBirth: false })).toBe(false)
  })
})

describe('insightAlert', () => {
  it('uses the first card and says how many more there are', () => {
    const cards = sanitizeInsights({ cards: [card(), card({ title: 'Another', topic: 'rhythm', sources: [] })] })
    expect(insightAlert('Maya', cards)).toEqual({ title: 'Maya: Weight is up', body: 'Weight went from 5.2 kg to 5.6 kg in 30 days. (+1 more)' })
  })
})
