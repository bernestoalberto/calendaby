import { describe, expect, it } from 'vitest'
import type { BabyEvent } from './events'
import { isOverdue, logGap, parseLogGap, usualGapHours } from './logReminder'
import { NO_LOGS_ID, logGapAlert } from './notifications'

const hr = 3_600_000
const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime()
const diaper = (id: string, ms: number): BabyEvent => ({ id, kind: 'diaper', contents: 'wet', at: ms, loggedBy: 'Dad' })

describe('logGap', () => {
  it('reminds a fixed number of hours after the last daytime log', () => {
    const events = [diaper('d1', at(29, 9))]
    const gap = logGap(events, 3, at(29, 11))
    expect(gap).toMatchObject({ kind: 'gap', since: at(29, 9), dueAt: at(29, 12) })
    expect(isOverdue(gap, at(29, 11))).toBe(false)
    expect(isOverdue(gap, at(29, 12))).toBe(true)
  })

  it('counts a quiet morning from 7 am, not from the last log of the night', () => {
    const events = [diaper('d1', at(28, 23))]
    const gap = logGap(events, 3, at(29, 8))
    expect(gap).toMatchObject({ kind: 'today', since: at(29, 7), dueAt: at(29, 10) })
  })

  it('moves a reminder that would land in the evening to the next morning', () => {
    const events = [diaper('d1', at(29, 17))]
    const gap = logGap(events, 3, at(29, 17))
    expect(gap).toMatchObject({ kind: 'today', dueAt: at(30, 10) })
    expect(isOverdue(gap, at(29, 22))).toBe(false)
  })

  it('stays quiet while asleep or when switched off', () => {
    const events: BabyEvent[] = [{ id: 's1', kind: 'sleep', phase: 'start', at: at(29, 9), loggedBy: 'Dad' }]
    expect(logGap(events, 2, at(29, 15))).toBeUndefined()
    expect(logGap([diaper('d1', at(29, 9))], 'off', at(29, 15))).toBeUndefined()
  })

  it('schedules the notification only while it is still ahead', () => {
    const gap = logGap([diaper('d1', at(29, 9))], 2, at(29, 10))
    expect(logGapAlert('Maya', gap, at(29, 10))).toMatchObject([{ id: NO_LOGS_ID, at: at(29, 11), title: 'Maya: nothing logged for 2h' }])
    expect(logGapAlert('Maya', gap, at(29, 12))).toEqual([])
  })
})

describe('usualGapHours', () => {
  it('learns the usual longest daytime gap from recent days', () => {
    const events = [26, 27, 28].flatMap((d) => [diaper(`a${d}`, at(d, 8)), diaper(`b${d}`, at(d, 12)), diaper(`c${d}`, at(d, 13))])
    expect(usualGapHours(events, at(29, 9))).toBe(4.5)
    expect(logGap(events, 'auto', at(29, 9))?.hours).toBe(4.5)
  })

  it('uses 3 hours until there are three days of logs', () => {
    expect(usualGapHours([diaper('d1', at(28, 8)), diaper('d2', at(28, 9))], at(29, 9))).toBe(3)
    expect(usualGapHours([], at(29, 9) + hr)).toBe(3)
  })
})

describe('parseLogGap', () => {
  it('reads what Customize stores', () => {
    expect(parseLogGap('off')).toBe('off')
    expect(parseLogGap('4')).toBe(4)
    expect(parseLogGap(undefined)).toBe('auto')
  })
})
