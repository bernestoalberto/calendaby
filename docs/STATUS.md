# Status

## Built

- PWA with conversational logging, duplicate guard, handoff brief, Ask box, voice input.
- Capacitor config for iOS and Android (native projects not generated yet).
- Hybrid capture: the rules parser handles what it can on the phone; leftovers go to the agent.
- Strands agent (`agent/`) with `capture` and `chat` modes and typed tools, ready for AgentCore.
- Vercel function `api/agent.ts` that invokes the AgentCore runtime. It returns 503 until `AGENT_RUNTIME_ARN` is set.

## Run locally (Windows PowerShell, macOS or Linux)

Needs Node 20+, `uv`, and for the assistant, AWS credentials with Bedrock model access (`aws configure` or `aws sso login`).

```bash
npm install
cd agent; uv sync; cd ..
npm run dev              # app at http://localhost:5173, logging works offline
```

With the assistant, in a second terminal:

```bash
copy agent\.env.example agent\.env    # macOS/Linux: cp agent/.env.example agent/.env
npm run agent                          # agent on http://localhost:8080
```

Try "fed 120 ml at 3, grandma visited" (the second part goes to the agent) and ask "how much has she eaten today?".

```bash
npm run check            # everything, no model calls
cd agent; uv run evals.py  # live agent on the eval set (costs a few cents)
```

## Deploy (not done yet)

1. `cd agent; uv run agentcore configure -e calendaby_agent.py --region us-west-2; uv run agentcore launch`
2. On Vercel, import the repo and set the variables in `.env.example`, including the runtime ARN from step 1.

## Known gaps

- `/api/agent` has no sign-in yet, so keep `AGENT_RUNTIME_ARN` unset in production until Clerk auth and usage limits land.
- Events live on one device; syncing between parents needs a backend.
- The rules parser misses some phrasings that it doesn't flag as unclear ("about 60" without ml).
