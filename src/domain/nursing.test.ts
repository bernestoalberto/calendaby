import { describe, expect, it } from 'vitest'
import { EMPTY_TIMER, elapsed, nursingDraft, switchSide, toggle } from './nursing'

const MIN = 60_000

describe('nursing stopwatch', () => {
  it('runs one side at a time and logs both sides', () => {
    let t = toggle(EMPTY_TIMER, 'left', 0)
    t = switchSide(t, 8 * MIN)
    expect(t.running).toBe('right')
    expect(elapsed(t, 'left', 20 * MIN)).toBe(8 * MIN)
    expect(elapsed(t, 'right', 13 * MIN)).toBe(5 * MIN)
    t = toggle(t, 'right', 13 * MIN)
    expect(t.running).toBeUndefined()
    expect(nursingDraft(t, 30 * MIN)).toEqual({
      kind: 'feed',
      at: 0,
      method: 'breast',
      side: 'both',
      durationMin: 13,
      leftMin: 8,
      rightMin: 5,
    })
  })

  it('logs nothing when it never ran', () => {
    expect(nursingDraft(EMPTY_TIMER, 1000)).toBeUndefined()
  })
})
