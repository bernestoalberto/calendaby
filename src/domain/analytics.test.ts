import { describe, expect, it } from 'vitest'
import { dailyStats, napForecast } from './analytics'
import type { BabyEvent, DraftEvent } from './events'

const at = (h: number, m = 0, day = 22) => new Date(2026, 9, day, h, m).getTime()
let n = 0
const ev = (e: DraftEvent): BabyEvent => ({ ...e, id: `a${n++}`, loggedBy: 'dad' })
const sleep = (a: number, b: number) => [ev({ kind: 'sleep', at: a, phase: 'start' }), ev({ kind: 'sleep', at: b, phase: 'end' })]

describe('dailyStats', () => {
  it('splits night and day sleep and counts feeds and diapers per day', () => {
    const events = [
      ...sleep(at(20, 0, 21), at(6, 0)), // 4h of night on the 21st, 6h on the 22nd
      ...sleep(at(9), at(10, 30)),
      ev({ kind: 'feed', at: at(6, 10), method: 'bottle', amountMl: 120 }),
      ev({ kind: 'feed', at: at(11), method: 'breast', side: 'left' }),
      ev({ kind: 'diaper', at: at(11, 5), contents: 'both' }),
    ]
    const [prev, today] = dailyStats(events, 2, at(12))
    expect(prev.nightMin).toBe(240)
    expect(today).toMatchObject({ nightMin: 360, dayMin: 90, naps: 1, feeds: 2, nursing: 1, bottles: 1, bottleMl: 120, wet: 1, dirty: 1 })
  })
})

describe('napForecast', () => {
  it('needs a few wake windows first', () => {
    expect(napForecast([...sleep(at(8), at(9)), ...sleep(at(11), at(12))], at(13))).toBeUndefined()
  })

  it('averages recent wake windows and predicts the next nap', () => {
    const events = [
      ...sleep(at(7), at(8)),
      ...sleep(at(10), at(11)), // 2h awake
      ...sleep(at(13), at(14)), // 2h
      ...sleep(at(16, 30), at(17)), // 2.5h
    ]
    const f = napForecast(events, at(18))
    expect(f?.wakeWindowMin).toBe(130)
    expect(f?.nextNapAt).toBe(at(17) + 130 * 60_000)
  })
})
