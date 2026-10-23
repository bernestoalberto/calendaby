import { apiKey, runAgent } from '../agent/agent.js'
import { googleFor } from '../agent/google.js'
import { authenticate } from '../backend/auth.js'
import { sharedDb } from '../backend/app.js'
import { AgentRequest, AgentResponse } from '../src/agents/remote.js'

const NATIVE_ORIGINS = new Set(['https://localhost', 'capacitor://localhost'])

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = process.env.AGENT_ALLOWED_ORIGIN
  if (origin && (origin === allowed || NATIVE_ORIGINS.has(origin))) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  }
  return {}
}

export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) })
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)

  if (!apiKey()) {
    return Response.json({ error: 'Agent is not configured' }, { status: 503, headers })
  }

  const allowed = process.env.AGENT_ALLOWED_ORIGIN
  if (allowed && origin !== allowed && (!origin || !NATIVE_ORIGINS.has(origin))) {
    return Response.json({ error: 'Forbidden' }, { status: 403, headers })
  }

  const auth = await authenticate(request)
  if (auth instanceof Response) {
    return new Response(auth.body, { status: auth.status, headers: { ...headers, 'content-type': 'application/json' } })
  }

  const parsed = AgentRequest.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400, headers })

  try {
    return Response.json(AgentResponse.parse(await runAgent(parsed.data, sharedDb(), undefined, auth.userId ? googleFor(auth.userId) : undefined)), { headers })
  } catch (err) {
    console.error('agent failed', err)
    return Response.json({ error: 'Agent unavailable' }, { status: 502, headers })
  }
}
