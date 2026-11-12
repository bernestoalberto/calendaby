import { describe, expect, it } from 'vitest'
import { daysText, nextRoutine, ROUTINE_ID_BASE, routineAlerts, routineProblem, routinesToday, type Routine } from './routines'

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime()
// 2026-11-09 is a Monday.
const MON = 9
const bedtime: Routine = { id: 'bed', name: 'Bedtime', time: '19:00', days: [0, 1, 2, 3, 4, 5, 6], steps: ['Bath', 'Book'], remind: true, date: '', state: 'active' }
const school: Routine = { id: 'am', name: 'Daycare drop-off', time: '08:15', days: [1, 2, 3, 4, 5], steps: [], remind: false, date: '2026-11-01', state: 'active' }

describe('routines', () => {
  it('lists the routines set for today, earliest first', () => {
    expect(routinesToday([bedtime, school], at(MON, 6)).map((s) => [s.routine.id, s.at])).toEqual([
      ['am', at(MON, 8, 15)],
      ['bed', at(MON, 19)],
    ])
    expect(routinesToday([school], at(MON - 1, 6))).toEqual([])
  })

  it('finds the next routine, rolling over to a later day', () => {
    expect(nextRoutine([bedtime, school], at(MON, 9))?.routine.id).toBe('bed')
    // Friday after bedtime: daycare is weekdays only, so bedtime on Saturday comes first.
    const fri = MON + 4
    expect(nextRoutine([bedtime, school], at(fri, 20))).toMatchObject({ routine: { id: 'bed' }, at: at(fri + 1, 19) })
    expect(nextRoutine([school], at(fri, 20))).toMatchObject({ at: at(fri + 3, 8, 15) })
  })

  it('reminds only for routines with a reminder, at their next start', () => {
    const alerts = routineAlerts('Mia', [school, bedtime], at(MON, 20))
    expect(alerts).toEqual([{ id: ROUTINE_ID_BASE + 1, at: at(MON + 1, 19), title: 'Time for Bedtime', body: expect.stringContaining('First up: Bath') }])
  })

  it('skips paused and done routines, and waits for the start date', () => {
    const paused: Routine = { ...bedtime, id: 'p', state: 'paused' }
    const finished: Routine = { ...bedtime, id: 'd', state: 'done' }
    expect(routinesToday([paused, finished], at(MON, 6))).toEqual([])
    expect(routineAlerts('Mia', [paused, finished], at(MON, 6))).toEqual([])
    const later: Routine = { ...bedtime, id: 'l', date: '2026-11-12' }
    expect(routinesToday([later], at(MON, 6))).toEqual([])
    expect(nextRoutine([later], at(MON, 6))).toMatchObject({ at: at(12, 19) })
  })

  it('names the days in plain words', () => {
    expect(daysText(bedtime.days)).toBe('Every day')
    expect(daysText(school.days)).toBe('Weekdays')
    expect(daysText([6, 0])).toBe('Weekends')
  })

  it('explains what is missing from a routine', () => {
    expect(routineProblem({ ...bedtime, name: ' ' })).toBe('Give the routine a name')
    expect(routineProblem({ ...bedtime, days: [] })).toBe('Pick at least one day')
    expect(routineProblem({ ...bedtime, time: '7pm' })).toBe('Pick a start time')
    expect(routineProblem(bedtime)).toBeUndefined()
  })
})
