import { describe, expect, it, vi } from 'vitest'
import { HybridCaptureAgent, isoWithOffset, type AgentResponse } from './remote'

const now = new Date(2026, 9, 22, 16, 10)

describe('HybridCaptureAgent', () => {
  it('does not call the agent when the rules understand everything', async () => {
    const call = vi.fn()
    const res = await new HybridCaptureAgent(call).capture('fed 120 ml, wet diaper', now)
    expect(call).not.toHaveBeenCalled()
    expect(res.drafts).toHaveLength(2)
  })

  it('sends only the leftovers and merges what comes back', async () => {
    const reply: AgentResponse = {
      reply: 'Logged a note.',
      drafts: [{ kind: 'note', at: now.getTime(), note: 'Grandma visited' }],
      questions: [],
    }
    const call = vi.fn().mockResolvedValue(reply)
    const res = await new HybridCaptureAgent(call).capture('fed 120 ml, grandma visited', now)
    expect(call).toHaveBeenCalledWith({ mode: 'capture', prompt: 'grandma visited', now: isoWithOffset(now) })
    expect(res).toEqual({
      drafts: [{ kind: 'feed', at: now.getTime(), method: 'bottle', amountMl: 120, side: undefined }, reply.drafts[0]],
      unsure: [],
    })
  })

  it('falls back to the rules result when the agent fails', async () => {
    const call = vi.fn().mockRejectedValue(new Error('offline'))
    const res = await new HybridCaptureAgent(call).capture('grandma visited', now)
    expect(res).toEqual({ drafts: [], unsure: ['grandma visited'] })
  })
})

describe('isoWithOffset', () => {
  it('keeps local wall time and appends the offset', () => {
    expect(isoWithOffset(now)).toMatch(/^2026-10-22T16:10:00[+-]\d{2}:\d{2}$/)
  })
})
