import { describe, expect, it } from 'vitest'
import { Session } from './agent'

const now = new Date('2026-10-22T16:10:00-04:00')

describe('Session', () => {
  it('records valid events as epoch ms drafts', () => {
    const s = new Session(now)
    const out = s.recordEvents([{ kind: 'feed', at: '2026-10-22T15:00:00-04:00', method: 'bottle', amountMl: 120 }])
    expect(out).toBe('Recorded 1 event(s).')
    expect(s.drafts).toEqual([
      { kind: 'feed', at: Date.parse('2026-10-22T15:00:00-04:00'), method: 'bottle', amountMl: 120 },
    ])
  })

  it('rejects invalid and future events so the model can retry', () => {
    const s = new Session(now)
    expect(s.recordEvents([{ kind: 'feed', at: '2026-10-22T15:00:00-04:00', method: 'cup' }])).toMatch(/^Rejected/)
    expect(s.recordEvents([{ kind: 'note', at: '2026-10-22T18:00:00-04:00', note: 'later' }])).toMatch(/future/)
    expect(s.drafts).toEqual([])
  })

  it('asks each question once', () => {
    const s = new Session(now)
    s.askParent('Bottle or breast?')
    s.askParent('Bottle or breast?')
    expect(s.questions).toEqual(['Bottle or breast?'])
  })
})
