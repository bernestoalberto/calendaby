import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it } from 'vitest'
import { openDb } from '../backend/db'
import { runAgent, Session } from './agent'

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

describe('runAgent', () => {
  it('puts a red flag and the baby age at the top of the chat prompt', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [{ type: 'text', text: 'Call your pediatrician now.' }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
        warnings: [],
      },
    })
    const req = { mode: 'chat', prompt: 'My 3 week old has a fever of 38.5', now: '2026-10-24T12:00:00-04:00', birth: '2026-10-03' } as const
    await runAgent(req, openDb(':memory:'), model)
    const system = JSON.stringify(model.doGenerateCalls[0].prompt[0])
    expect(system).toContain('Possible red flag')
    expect(system).toContain('3 weeks old')
  })
})
