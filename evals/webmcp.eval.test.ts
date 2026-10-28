import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerWebMcpTools } from '../src/webmcp'

interface Schema {
  tools: { name: string; description: string; inputSchema: { properties: Record<string, unknown>; required?: string[] } }[]
}
interface Case {
  name: string
  expectedCall: { functionName: string; arguments: Record<string, unknown> }[]
}

const read = <T>(file: string) => JSON.parse(readFileSync(new URL(`./webmcp/${file}`, import.meta.url), 'utf8')) as T
const schema = read<Schema>('schema.json')
const cases = read<Case[]>('evals.json')

afterEach(() => vi.unstubAllGlobals())

describe('WebMCP evals (the model-driven run is `npm run evals:webmcp`)', () => {
  it('schema.json is exactly what the app registers, so the evals test the real tools', () => {
    const registered: unknown[] = []
    vi.stubGlobal('document', { modelContext: { registerTool: async (t: unknown) => void registered.push(t) } })
    registerWebMcpTools({ logText: async () => '', handoff: () => '', today: () => '', upcoming: () => '' })
    const strip = ({ name, description, inputSchema }: Schema['tools'][number]) => ({ name, description, inputSchema })
    expect(registered.map((t) => strip(t as Schema['tools'][number]))).toEqual(schema.tools.map(strip))
  })

  it('every case expects a real tool, with only arguments it takes and all it requires', () => {
    expect(cases.length).toBeGreaterThan(0)
    for (const c of cases) {
      expect(c.expectedCall.length, c.name).toBeGreaterThan(0)
      for (const call of c.expectedCall) {
        const tool = schema.tools.find((t) => t.name === call.functionName)
        expect(tool, `${c.name}: unknown tool ${call.functionName}`).toBeDefined()
        const given = Object.keys(call.arguments)
        expect(given.filter((a) => !(a in (tool?.inputSchema.properties ?? {}))), c.name).toEqual([])
        expect((tool?.inputSchema.required ?? []).filter((a) => !given.includes(a)), c.name).toEqual([])
      }
    }
  })

  it('every tool has at least one case', () => {
    const covered = new Set(cases.flatMap((c) => c.expectedCall.map((e) => e.functionName)))
    expect(schema.tools.map((t) => t.name).filter((n) => !covered.has(n))).toEqual([])
  })
})
