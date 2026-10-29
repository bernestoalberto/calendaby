import { describe, expect, it } from 'vitest'
import type { BabyEvent } from './events'
import { flaggedIds, sleepIssues } from './sleepIssues'

const H = 3_600_000
const t0 = new Date('2026-10-20T08:00:00').getTime()
let n = 0
const sleep = (hoursFromT0: number, phase: 'start' | 'end'): BabyEvent => ({ id: `s${n++}`, kind: 'sleep', at: t0 + hoursFromT0 * H, loggedBy: 'a', phase })
const now = t0 + 6 * 24 * H

describe('sleepIssues', () => {
  it('finds nothing in a clean log', () => {
    n = 0
    expect(sleepIssues([sleep(0, 'start'), sleep(1.5, 'end'), sleep(5, 'start'), sleep(6, 'end')], now)).toEqual([])
  })

  it('flags two fell-asleeps with no wake-up between, on both entries', () => {
    n = 0
    const events = [sleep(0, 'start'), sleep(2, 'start'), sleep(3, 'end')]
    const found = sleepIssues(events, now)
    expect(found).toMatchObject([{ kind: 'double_start', eventIds: ['s0', 's1'] }])
    expect([...flaggedIds(found)]).toEqual(['s0', 's1'])
  })

  it('flags a wake-up with nothing before it', () => {
    n = 0
    expect(sleepIssues([sleep(0, 'end')], now)).toMatchObject([{ kind: 'orphan_end', eventIds: ['s0'] }])
  })

  it('flags a stretch longer than 18 hours', () => {
    n = 0
    expect(sleepIssues([sleep(0, 'start'), sleep(20, 'end')], now)).toMatchObject([{ kind: 'too_long' }])
  })

  it('flags a sleep still open after 14 hours but not a fresh one', () => {
    n = 0
    const events = [sleep(0, 'start')]
    expect(sleepIssues(events, t0 + 15 * H)).toMatchObject([{ kind: 'still_open', eventIds: ['s0'] }])
    expect(sleepIssues(events, t0 + 3 * H)).toEqual([])
  })

  it('flags a finished day with more than 20 hours, not today', () => {
    n = 0
    const day = new Date('2026-10-20T00:00:00').getTime()
    const at = (h: number, phase: 'start' | 'end', id: string): BabyEvent => ({ id, kind: 'sleep', at: day + h * H, loggedBy: 'a', phase })
    const events = [at(0, 'start', 'a'), at(12, 'end', 'b'), at(12.5, 'start', 'c'), at(23, 'end', 'd')]
    const found = sleepIssues(events, day + 3 * 24 * H)
    expect(found.some((i) => i.kind === 'day_total')).toBe(true)
    expect(sleepIssues(events, day + 23.5 * H).some((i) => i.kind === 'day_total')).toBe(false)
  })

  it('gives the same key for the same problem, so it is announced once', () => {
    n = 0
    const events = [sleep(0, 'start'), sleep(2, 'start')]
    expect(sleepIssues(events, now)[0].key).toBe(sleepIssues(events, now + H)[0].key)
  })
})
