import { describe, expect, it } from 'vitest'
import { activityDays } from './activity'
import type { BabyEvent, DraftEvent } from './events'

const at = (h: number, m = 0, day = 22) => new Date(2026, 9, day, h, m).getTime()
let n = 0
const ev = (e: DraftEvent): BabyEvent => ({ ...e, id: `e${n++}`, loggedBy: 'dad' })

describe('activityDays', () => {
  it('totals minutes and sessions per type for each of the last days, oldest first', () => {
    const events = [
      ev({ kind: 'activity', at: at(8, 0, 21), type: 'tummy', durationMin: 10 }),
      ev({ kind: 'activity', at: at(8), type: 'tummy', durationMin: 6 }),
      ev({ kind: 'activity', at: at(14), type: 'tummy', durationMin: 3 }),
      ev({ kind: 'activity', at: at(15), type: 'bath', durationMin: 15 }),
      ev({ kind: 'activity', at: at(16), type: 'indoor' }),
      ev({ kind: 'pump', at: at(9), amountMl: 100, durationMin: 20 }),
      ev({ kind: 'feed', at: at(9), method: 'bottle', amountMl: 90 }),
    ]
    const [yesterday, today] = activityDays(events, 2, at(18))
    expect(yesterday).toMatchObject({ totalMin: 10, sessions: 1, byType: { tummy: 10 } })
    expect(today).toMatchObject({ totalMin: 24, sessions: 4, byType: { tummy: 9, bath: 15, indoor: 0 } })
  })

  it('returns empty days when nothing was logged', () => {
    expect(activityDays([], 3, at(12)).map((d) => [d.totalMin, d.sessions])).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
    ])
  })
})
