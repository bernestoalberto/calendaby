import { describe, expect, it } from 'vitest'
import type { BabyEvent, DraftEvent } from '../domain/events'
import { buildHandoff, handoffText } from './handoff'

const now = new Date(2026, 9, 22, 18, 0)
const ago = (min: number) => now.getTime() - min * 60_000
let n = 0
const ev = (e: DraftEvent): BabyEvent => ({ ...e, id: `e${n++}`, loggedBy: 'mom' })

describe('buildHandoff', () => {
  it('summarises sleep, feeds, diapers and meds for the incoming caregiver', () => {
    const events = [
      ev({ kind: 'feed', at: ago(240), method: 'bottle', amountMl: 90 }),
      ev({ kind: 'med', at: ago(200), name: 'vitamin d' }),
      ev({ kind: 'feed', at: ago(95), method: 'bottle', amountMl: 120, note: 'spat up a little' }),
      ev({ kind: 'diaper', at: ago(80), contents: 'wet' }),
      ev({ kind: 'sleep', at: ago(45), phase: 'start' }),
    ]
    const brief = buildHandoff(events, now)
    expect(brief.headline).toBe('Asleep for 45 min')
    expect(handoffText(brief)).toBe(
      [
        'Asleep for 45 min',
        '- Last feed 1 h 35 min ago (120 ml bottle)',
        '- 2 feeds in the last 8 h, 210 ml total',
        '- Last diaper 1 h 20 min ago (wet)',
        '- Gave vitamin d 3 h 20 min ago',
        '- Note: spat up a little',
      ].join('\n'),
    )
  })

  it('handles an empty log', () => {
    expect(buildHandoff([], now)).toEqual({ headline: 'No sleep logged yet', lines: ['No feed logged yet'] })
  })
})
