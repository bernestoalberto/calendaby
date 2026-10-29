import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it } from 'vitest'
import { openDb } from '../backend/db'
import type { AgentRequest } from '../src/agents/remote'
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

describe('getGrowth', () => {
  const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } }
  const call = { content: [{ type: 'tool-call' as const, toolCallId: 'g1', toolName: 'getGrowth', input: '{}' }], finishReason: { unified: 'tool-calls' as const, raw: 'tool-calls' }, usage, warnings: [] }
  const done = { content: [{ type: 'text' as const, text: 'ok' }], finishReason: { unified: 'stop' as const, raw: 'stop' }, usage, warnings: [] }

  it('hands the model the entered readings with WHO percentiles, and nothing it was not given', async () => {
    const model = new MockLanguageModelV4({ doGenerate: [call, done] })
    const measure = { id: 'm1', kind: 'measure' as const, at: Date.parse('2026-03-03T12:00:00Z'), loggedBy: 'dad', weightG: 4471 }
    const req: AgentRequest = { mode: 'chat', prompt: 'How is her weight?', now: '2026-03-10T12:00:00+00:00', birth: '2026-02-01', sex: 'boy', measures: [measure] }
    await runAgent(req, openDb(':memory:'), model)
    const result = JSON.stringify(model.doGenerateCalls[1].prompt.filter((m) => m.role === 'tool'))
    expect(result).toContain('4.47')
    expect(result).toContain('WHO growth standards')
    expect(result).not.toContain('\\"length\\"')
  })

  it('says percentiles are unavailable when the sex is not set', async () => {
    const model = new MockLanguageModelV4({ doGenerate: [call, done] })
    const measure = { id: 'm1', kind: 'measure' as const, at: Date.parse('2026-03-03T12:00:00Z'), loggedBy: 'dad', weightG: 4471 }
    await runAgent({ mode: 'chat', prompt: 'How is her weight?', now: '2026-03-10T12:00:00+00:00', birth: '2026-02-01', measures: [measure] }, openDb(':memory:'), model)
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain('not available')
  })
})

describe('insights mode', () => {
  const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } }
  const stop = { content: [{ type: 'text' as const, text: 'done' }], finishReason: { unified: 'stop' as const, raw: 'stop' }, usage, warnings: [] }
  const calling = (toolName: string, input: unknown) => ({
    content: [{ type: 'tool-call' as const, toolCallId: `t-${toolName}`, toolName, input: JSON.stringify(input) }],
    finishReason: { unified: 'tool-calls' as const, raw: 'tool-calls' },
    usage,
    warnings: [],
  })
  const req: AgentRequest = {
    mode: 'insights',
    prompt: 'insights',
    now: '2026-10-29T12:00:00+00:00',
    birth: '2026-04-20',
    marks: [{ id: 'k1', kind: 'milestone', at: Date.parse('2026-10-28T12:00:00Z'), loggedBy: 'dad', milestoneId: '6-movement-1', state: 'not_yet', text: 'Rolls from tummy to back' }],
  }

  it('returns the cards that pass the rules and drops the rest', async () => {
    const cards = {
      cards: [
        { topic: 'milestones', title: 'Rolling is not here yet', body: 'Rolling from tummy to back is marked not yet. Worth raising at the next checkup.', sources: ['cdcMilestones'] },
        { topic: 'growth', title: 'Looks underweight', body: 'She is underweight.', sources: ['whoGrowth'] },
      ],
    }
    const model = new MockLanguageModelV4({ doGenerate: [calling('publish_insights', cards), stop] })
    const res = await runAgent(req, openDb(':memory:'), model)
    expect(res.insights).toHaveLength(1)
    expect(res.insights?.[0]).toMatchObject({ topic: 'milestones', title: 'Rolling is not here yet' })
    expect(res.insights?.[0].sources[0].url).toContain('cdc.gov')
  })

  it('gives the model only the baby\'s own milestone answers and no logging tools', async () => {
    const model = new MockLanguageModelV4({ doGenerate: [calling('getMilestones', {}), stop] })
    await runAgent(req, openDb(':memory:'), model)
    const tool = JSON.stringify(model.doGenerateCalls[1].prompt.filter((m) => m.role === 'tool'))
    expect(tool).toContain('Rolls from tummy to back')
    expect(tool).toContain('forAgeMonths')
    const names = (model.doGenerateCalls[0].tools ?? []).map((t) => t.name)
    expect(names).toContain('publish_insights')
    expect(names).not.toContain('record_events')
  })

  it('has no insights when the model publishes nothing valid, and no insights field in other modes', async () => {
    const model = new MockLanguageModelV4({ doGenerate: [calling('publish_insights', { cards: [{ topic: 'growth', title: 'x', body: 'y', sources: [] }] }), stop] })
    expect((await runAgent(req, openDb(':memory:'), model)).insights).toEqual([])
    const chat = new MockLanguageModelV4({ doGenerate: stop })
    expect((await runAgent({ ...req, mode: 'chat', prompt: 'hi' }, openDb(':memory:'), chat)).insights).toBeUndefined()
  })
})
