import { afterEach, describe, expect, it, vi } from 'vitest'
import { describeDay, registerWebMcpTools, type WebMcpHandlers } from './webmcp'

interface Registered {
  name: string
  description: string
  inputSchema: { type: string }
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }
  execute: (args: unknown) => Promise<string>
}

function fakeContext() {
  const tools = new Map<string, Registered>()
  const signals = new Map<string, AbortSignal | undefined>()
  return {
    tools,
    signals,
    registerTool: vi.fn(async (tool: Registered, options?: { signal?: AbortSignal }) => {
      tools.set(tool.name, tool)
      signals.set(tool.name, options?.signal)
    }),
  }
}

const handlers = (): WebMcpHandlers => ({
  logText: vi.fn(async (text: string) => `Logged: ${text}`),
  handoff: vi.fn(() => 'Awake since 2:10 PM'),
  today: vi.fn(() => '3 feeds'),
})

const withContext = (modelContext: unknown) => vi.stubGlobal('document', { modelContext })

afterEach(() => vi.unstubAllGlobals())

describe('describeDay', () => {
  const day = { feeds: 3, feedMl: 360, sleepMinutes: 95, naps: 1, wet: 2, dirty: 1, changes: 3, tummyMinutes: 0, pumpMl: 0 }

  it('says the totals in plain words and leaves out what has no data', () => {
    expect(describeDay(day, 'EJ')).toBe(['EJ today:', '- Feeds: 3 (360 ml)', '- Sleep: 95 minutes in 1 nap', '- Diapers: 3 (2 wet, 1 dirty)'].join('\n'))
    expect(describeDay({ ...day, tummyMinutes: 10, pumpMl: 120 }, 'EJ')).toContain('Tummy time: 10 minutes')
  })
})

describe('registerWebMcpTools', () => {
  it('does nothing in a browser without WebMCP', () => {
    withContext(undefined)
    expect(() => registerWebMcpTools(handlers())()).not.toThrow()
  })

  it('offers the three tools with descriptions and object schemas', () => {
    const ctx = fakeContext()
    withContext(ctx)
    registerWebMcpTools(handlers())
    expect([...ctx.tools.keys()].sort()).toEqual(['get_handoff_brief', 'get_today_summary', 'log_baby_event'])
    for (const tool of ctx.tools.values()) {
      expect(tool.description.length).toBeGreaterThan(20)
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('marks reading tools read-only and the one with the parent\'s own notes as untrusted content', () => {
    const ctx = fakeContext()
    withContext(ctx)
    registerWebMcpTools(handlers())
    expect(ctx.tools.get('get_today_summary')?.annotations?.readOnlyHint).toBe(true)
    expect(ctx.tools.get('get_handoff_brief')?.annotations).toMatchObject({ readOnlyHint: true, untrustedContentHint: true })
    expect(ctx.tools.get('log_baby_event')?.annotations?.readOnlyHint).toBeFalsy()
  })

  it('passes a checked sentence on to the app and returns what it said', async () => {
    const ctx = fakeContext()
    const h = handlers()
    withContext(ctx)
    registerWebMcpTools(h)
    expect(await ctx.tools.get('log_baby_event')?.execute({ text: '  fed 4oz  ' })).toBe('Logged: fed 4oz')
    expect(h.logText).toHaveBeenCalledWith('fed 4oz')
  })

  it('refuses input that is not a short sentence, without touching the log', async () => {
    const ctx = fakeContext()
    const h = handlers()
    withContext(ctx)
    registerWebMcpTools(h)
    const log = ctx.tools.get('log_baby_event')
    await expect(log?.execute({})).rejects.toThrow(/text/i)
    await expect(log?.execute({ text: '   ' })).rejects.toThrow()
    await expect(log?.execute({ text: 'x'.repeat(501) })).rejects.toThrow()
    await expect(log?.execute('fed 4oz')).rejects.toThrow()
    expect(h.logText).not.toHaveBeenCalled()
  })

  it('reads the handoff and today\'s totals', async () => {
    const ctx = fakeContext()
    withContext(ctx)
    registerWebMcpTools(handlers())
    expect(await ctx.tools.get('get_handoff_brief')?.execute({})).toBe('Awake since 2:10 PM')
    expect(await ctx.tools.get('get_today_summary')?.execute({})).toBe('3 feeds')
  })

  it('removes every tool when the app is closed down', () => {
    const ctx = fakeContext()
    withContext(ctx)
    const stop = registerWebMcpTools(handlers())
    stop()
    expect([...ctx.signals.values()].every((s) => s?.aborted)).toBe(true)
  })
})
