import { z } from 'zod'
import { BabyEvent, DraftEventSchema, type DraftEvent } from '../domain/events.js'
import { parseLog, type CaptureAgent, type CaptureResult } from './capture.js'

/** Body the app sends to /api/agent; the Vercel function runs the agent. */
export const AgentRequest = z.object({
  mode: z.enum(['capture', 'chat']),
  prompt: z.string().min(1).max(2000),
  now: z.string().min(1), // ISO 8601 with the parent's UTC offset
  events: z.array(BabyEvent).max(500).optional(),
})
export type AgentRequest = z.infer<typeof AgentRequest>

export const AgentResponse = z.object({
  reply: z.string(),
  drafts: z.array(DraftEventSchema),
  questions: z.array(z.string()),
})
export type AgentResponse = z.infer<typeof AgentResponse>

/** Local time with offset, e.g. 2026-10-22T16:10:00-04:00, so the agent resolves "at 3" in the parent's zone. */
export function isoWithOffset(d: Date): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0')
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`
  )
}

type TokenSource = () => Promise<string | null>
let tokenSource: TokenSource | undefined

/** Set by the Account card once Clerk is ready; stays unset (signed out) otherwise. */
export function setAgentTokenSource(source: TokenSource | undefined): void {
  tokenSource = source
}

async function post(path: string, body: unknown, fetchImpl: typeof fetch): Promise<Response> {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  const base = cap?.isNativePlatform?.() ? 'https://calendaby.vercel.app' : ''
  const token = await tokenSource?.().catch(() => null)
  const res = await fetchImpl(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Server returned ${res.status}`)
  return res
}

export async function callAgent(body: AgentRequest, fetchImpl: typeof fetch = fetch): Promise<AgentResponse> {
  return AgentResponse.parse(await (await post('/api/agent', body, fetchImpl)).json())
}

/** One backend operation by operationId; the caller validates the shape it expects. */
export async function callBackend<T>(operationId: string, body: unknown, fetchImpl: typeof fetch = fetch): Promise<T> {
  return (await (await post(`/api/backend/${operationId}`, body, fetchImpl)).json()) as T
}

/**
 * Rules first, agent second: clauses the offline parser understands never leave the phone,
 * and only the leftovers go to the LLM. Offline or on error, the leftovers come back as unsure.
 */
export class HybridCaptureAgent implements CaptureAgent {
  private readonly call: typeof callAgent

  constructor(call: typeof callAgent = callAgent) {
    this.call = call
  }

  async capture(text: string, now: Date): Promise<CaptureResult> {
    const local = parseLog(text, now)
    if (local.unsure.length === 0) return local
    if ((globalThis as { navigator?: { onLine?: boolean } }).navigator?.onLine === false) return local

    try {
      const res = await this.call({ mode: 'capture', prompt: local.unsure.join(', '), now: isoWithOffset(now) })
      const drafts: DraftEvent[] = [...local.drafts, ...res.drafts]
      return { drafts, unsure: res.questions }
    } catch {
      return local
    }
  }
}
