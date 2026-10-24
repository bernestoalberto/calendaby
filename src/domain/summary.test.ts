import { describe, expect, it } from 'vitest'
import type { BabyEvent, DraftEvent } from './events'
import { formatMinutes, sleepSessions, summarizeDay } from './summary'

const at = (h: number, m = 0, day = 22) => new Date(2026, 9, day, h, m).getTime()
let n = 0
const ev = (e: DraftEvent): BabyEvent => ({ ...e, id: `e${n++}`, loggedBy: 'dad' })

describe('summarizeDay', () => {
  it('totals feeds, diapers and sleep since midnight', () => {
    const events = [
      ev({ kind: 'sleep', at: at(20, 0, 21), phase: 'start' }),
      ev({ kind: 'sleep', at: at(2), phase: 'end' }),
      ev({ kind: 'feed', at: at(2, 10), method: 'bottle', amountMl: 120 }),
      ev({ kind: 'feed', at: at(6), method: 'breast', side: 'left' }),
      ev({ kind: 'diaper', at: at(6, 5), contents: 'both' }),
      ev({ kind: 'diaper', at: at(9), contents: 'wet' }),
      ev({ kind: 'sleep', at: at(9, 30), phase: 'start' }),
    ]
    expect(summarizeDay(events, new Date(at(10)))).toEqual({
      feeds: 2,
      feedMl: 120,
      sleepMinutes: 150,
      naps: 1,
      wet: 2,
      dirty: 1,
      changes: 2,
      tummyMinutes: 0,
      pumpMl: 0,
    })
  })

  it('totals tummy time and pumped milk, ignoring yesterday', () => {
    const events = [
      ev({ kind: 'activity', at: at(20, 0, 21), type: 'tummy', durationMin: 30 }),
      ev({ kind: 'activity', at: at(8), type: 'tummy', durationMin: 6 }),
      ev({ kind: 'activity', at: at(9), type: 'tummy', durationMin: 3 }),
      ev({ kind: 'activity', at: at(9, 30), type: 'bath', durationMin: 15 }),
      ev({ kind: 'pump', at: at(7), amountMl: 90 }),
      ev({ kind: 'pump', at: at(9), amountMl: 60, side: 'both' }),
    ]
    expect(summarizeDay(events, new Date(at(10)))).toMatchObject({ tummyMinutes: 9, pumpMl: 150, feeds: 0 })
  })

  it('formats minutes', () => {
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(120)).toBe('2h')
    expect(formatMinutes(150)).toBe('2h 30m')
  })
})

describe('sleepSessions', () => {
  it('pairs starts with ends and leaves the last one open', () => {
    const events = [
      ev({ kind: 'sleep', at: at(1), phase: 'end' }),
      ev({ kind: 'sleep', at: at(2), phase: 'start' }),
      ev({ kind: 'sleep', at: at(3), phase: 'end' }),
      ev({ kind: 'sleep', at: at(5), phase: 'start' }),
    ]
    expect(sleepSessions(events)).toEqual([{ start: at(2), end: at(3) }, { start: at(5) }])
  })
})
