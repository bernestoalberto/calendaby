import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore'
import { AgentRequest, AgentResponse } from '../src/agents/remote'

// Credentials and the runtime ARN live in Vercel env vars, never in the app bundle.
const client = new BedrockAgentCoreClient({ region: process.env.AWS_REGION ?? 'us-west-2' })

export async function POST(request: Request): Promise<Response> {
  const arn = process.env.AGENT_RUNTIME_ARN
  if (!arn) return Response.json({ error: 'Agent is not configured' }, { status: 503 })

  const allowed = process.env.AGENT_ALLOWED_ORIGIN
  if (allowed && request.headers.get('origin') !== allowed) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = AgentRequest.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })

  try {
    const out = await client.send(
      new InvokeAgentRuntimeCommand({
        agentRuntimeArn: arn,
        contentType: 'application/json',
        accept: 'application/json',
        payload: new TextEncoder().encode(JSON.stringify(parsed.data)),
      }),
    )
    const text = (await out.response?.transformToString()) ?? ''
    // Re-validate on the way out so a misbehaving agent cannot write bad data to the phone.
    return Response.json(AgentResponse.parse(JSON.parse(text)))
  } catch (err) {
    console.error('agent invoke failed', err)
    return Response.json({ error: 'Agent unavailable' }, { status: 502 })
  }
}
