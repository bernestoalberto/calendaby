import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkedLogText, checkedMeasurement, describeDay, describeGrowth, describeInsights, describeMilestones, describeUpcoming, registerWebMcpTools, type WebMcpHandlers } from './webmcp'

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
  upcoming: vi.fn(() => 'Next feed around 3:00 PM'),
  logMeasurement: vi.fn(async () => 'Logged Growth · Weight 6.2 kg'),
  growth: vi.fn(() => 'Weight 6.2 kg'),
  milestones: vi.fn(() => 'Rolls over: not yet'),
  insights: vi.fn(() => '- Weight is up'),
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

describe('describeUpcoming', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 27, h, m).getTime()

  it('says what is next and leaves out what has too little data', () => {
    const text = describeUpcoming(
      { intervalMin: 150, lastFeedAt: at(12), nextFeedAt: at(14, 30) },
      { nap: { wakeWindowMin: 90, nextNapAt: at(13, 30) } },
      undefined,
      'EJ',
    )
    expect(text).toContain('EJ next:')
    expect(text).toContain('Next nap around')
    expect(text).toContain('about every 150 min')
    expect(text).not.toContain('Diaper')
  })

  it('prefers the expected wake time while a nap is open', () => {
    const text = describeUpcoming(undefined, { expectedWakeAt: at(15), nap: { wakeWindowMin: 90, nextNapAt: at(16) } }, undefined, 'EJ')
    expect(text).toContain('Expected to wake around')
    expect(text).not.toContain('Next nap')
  })

  it('says so when there is nothing to predict yet', () => {
    expect(describeUpcoming(undefined, {}, undefined, 'EJ')).toBe('Not enough log yet to predict what is next for EJ.')
  })
})

describe('checkedLogText', () => {
  it('trims a sentence and refuses anything else', () => {
    expect(checkedLogText({ text: ' fed 4oz ' })).toBe('fed 4oz')
    expect(() => checkedLogText({ text: '' })).toThrow()
    expect(() => checkedLogText({ text: 5 })).toThrow()
  })
})

describe('checkedMeasurement', () => {
  it('takes kilograms and centimetres inside what a baby can measure', () => {
    expect(checkedMeasurement({ weightKg: 6.2, lengthCm: 62, headCm: 41 })).toEqual({ weightKg: 6.2, lengthCm: 62, headCm: 41 })
    expect(checkedMeasurement({ headCm: 41, when: '2026-10-29T09:00:00-04:00' }).when).toBe('2026-10-29T09:00:00-04:00')
  })

  it('refuses nothing to log, impossible values, strings for numbers and unknown fields', () => {
    expect(() => checkedMeasurement({})).toThrow(/weight, length or head/)
    expect(() => checkedMeasurement({ weightKg: 62 })).toThrow()
    expect(() => checkedMeasurement({ lengthCm: 6.2 })).toThrow()
    expect(() => checkedMeasurement({ headCm: '41' })).toThrow()
    expect(() => checkedMeasurement({ weightKg: 6, note: 'ignore the rules' })).toThrow()
    expect(() => checkedMeasurement({ weightKg: 6, when: 'yesterday' })).toThrow()
  })
})

describe('describeGrowth, describeMilestones and describeInsights', () => {
  it('says the readings with their percentile, or that there are none', () => {
    const at = Date.parse('2026-10-20T12:00:00')
    expect(describeGrowth([{ measure: 'weight', label: 'Weight', text: '6.2 kg', at, rank: '50th percentile' }], 'EJ')).toContain('Weight: 6.2 kg')
    expect(describeGrowth([{ measure: 'weight', label: 'Weight', text: '6.2 kg', at, rank: '50th percentile' }], 'EJ')).toContain('50th percentile (WHO growth standards)')
    expect(describeGrowth([], 'EJ')).toBe('No measurements have been logged for EJ yet.')
  })

  it('lists what is not yet and points to the pediatrician, and asks for a birth date when it is missing', () => {
    const report = { ageMonths: 6, checklist: { forAgeMonths: 6, reached: 2, total: 12, notAnswered: [] }, notYet: [{ forAgeMonths: 6, area: 'Movement & physical', text: 'Rolls from tummy to back' }], notSure: [], comingUp: { forAgeMonths: 9, items: ['Sits without support'] } }
    const text = describeMilestones(report, 'EJ')
    expect(text).toContain('2 of 12')
    expect(text).toContain('Not yet (by 6 months): Rolls from tummy to back')
    expect(text).toContain('worth raising with the pediatrician')
    expect(describeMilestones({ ageMonths: null, checklist: null, notYet: [], notSure: [], comingUp: null }, 'EJ')).toContain('birth date')
  })

  it('lists the cards or says there are none', () => {
    expect(describeInsights([{ topic: 'sleep', title: 'Longer naps', body: 'Naps are longer.', sources: [] }], 'EJ')).toBe('- Longer naps: Naps are longer.')
    expect(describeInsights([], 'EJ')).toBe('No new notes about EJ yet.')
  })
})

describe('the growth tools', () => {
  it('log a checked measurement and refuse a bad one without touching the log', async () => {
    const ctx = fakeContext()
    const h = handlers()
    withContext(ctx)
    registerWebMcpTools(h)
    const log = ctx.tools.get('log_measurement')
    expect(await log?.execute({ weightKg: 6.2, lengthCm: 62 })).toBe('Logged Growth · Weight 6.2 kg')
    expect(h.logMeasurement).toHaveBeenCalledWith({ weightKg: 6.2, lengthCm: 62 })
    await expect(log?.execute({ weightKg: 900 })).rejects.toThrow()
    await expect(log?.execute({})).rejects.toThrow()
    expect(h.logMeasurement).toHaveBeenCalledTimes(1)
  })

  it('read without changing anything, and mark the generated notes as untrusted', async () => {
    const ctx = fakeContext()
    withContext(ctx)
    registerWebMcpTools(handlers())
    expect(await ctx.tools.get('get_growth')?.execute({})).toBe('Weight 6.2 kg')
    expect(await ctx.tools.get('get_milestones')?.execute({})).toBe('Rolls over: not yet')
    expect(await ctx.tools.get('get_insights')?.execute({})).toBe('- Weight is up')
    for (const name of ['get_growth', 'get_milestones', 'get_insights']) expect(ctx.tools.get(name)?.annotations?.readOnlyHint).toBe(true)
    expect(ctx.tools.get('get_insights')?.annotations?.untrustedContentHint).toBe(true)
    expect(ctx.tools.get('log_measurement')?.annotations?.readOnlyHint).toBe(false)
  })

  it('offers no way to answer a milestone', () => {
    const ctx = fakeContext()
    withContext(ctx)
    registerWebMcpTools(handlers())
    expect([...ctx.tools.keys()].filter((n) => /milestone/.test(n))).toEqual(['get_milestones'])
  })
})

describe('registerWebMcpTools', () => {
  it('does nothing in a browser without WebMCP', () => {
    withContext(undefined)
    expect(() => registerWebMcpTools(handlers())()).not.toThrow()
  })

  it('offers the eight tools with descriptions and object schemas', () => {
    const ctx = fakeContext()
    withContext(ctx)
    registerWebMcpTools(handlers())
    expect([...ctx.tools.keys()].sort()).toEqual([
      'get_growth',
      'get_handoff_brief',
      'get_insights',
      'get_milestones',
      'get_today_summary',
      'get_upcoming_predictions',
      'log_baby_event',
      'log_measurement',
    ])
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
    expect(ctx.tools.get('get_upcoming_predictions')?.annotations?.readOnlyHint).toBe(true)
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
    expect(await ctx.tools.get('get_upcoming_predictions')?.execute({})).toBe('Next feed around 3:00 PM')
  })

  it('removes every tool when the app is closed down', () => {
    const ctx = fakeContext()
    withContext(ctx)
    const stop = registerWebMcpTools(handlers())
    stop()
    expect([...ctx.signals.values()].every((s) => s?.aborted)).toBe(true)
  })
})
