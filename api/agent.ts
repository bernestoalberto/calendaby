import { apiKey, runAgent } from '../agent/agent.js'
import { sharedDb } from '../backend/app.js'
import { AgentRequest, AgentResponse } from '../src/agents/remote.js'

export async function POST(request: Request): Promise<Response> {
  if (!apiKey()) {
    return Response.json({ error: 'Agent is not configured' }, { status: 503 })
  }

  const allowed = process.env.AGENT_ALLOWED_ORIGIN
  if (allowed && request.headers.get('origin') !== allowed) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = AgentRequest.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })

  try {
    return Response.json(AgentResponse.parse(await runAgent(parsed.data, sharedDb())))
  } catch (err) {
    console.error('agent failed', err)
    return Response.json({ error: 'Agent unavailable' }, { status: 502 })
  }
}
