# Tech stack

| Part | Choice |
| --- | --- |
| App | React 19, TypeScript (strict), Vite, PWA via `vite-plugin-pwa` |
| Native shells | Capacitor 8 (iOS, Android) wrapping the same `dist/` build |
| Validation | Zod in the app and the Vercel function; Pydantic in the agent |
| Local storage | `localStorage` behind the `EventStore` interface |
| Hosting | Vercel: static app plus `api/agent.ts` |
| Agent | Python 3.12, Strands Agents, on Amazon Bedrock AgentCore Runtime |
| Models | Claude Haiku 5.5 for capture, Claude Sonnet 5.5 for chat, through Bedrock |
| Tests | Vitest, pytest with a stub model |

## How a request flows

App -> `POST /api/agent` (Vercel, validates with Zod) -> `InvokeAgentRuntime` (AWS SDK, IAM credentials in Vercel env) -> Strands agent on AgentCore -> Bedrock. The response is validated again before it reaches the phone. In local dev, Vite proxies `/api/agent` to the agent on port 8080.

## Borrowed patterns

- `finale/`: Strands agent served by `BedrockAgentCoreApp`, deployed with `agentcore launch`.
- `undercover/`: docs-driven FDE process, tests on a stub model, an eval set with a baseline, data treated as untrusted.
- `cyber/`: prompts in their own `context.py`; validated, structured output.
- `twin/`: Bedrock behind a thin API, jailbreak rules in the prompt, least-privilege IAM, secrets only in env.
- `saas/`: Vercel functions as the API layer; next comes Clerk sign-in and per-family usage limits.
