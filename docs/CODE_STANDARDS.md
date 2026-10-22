# Code standards

1. Keep it simple. Comments only when they explain why.
2. TypeScript strict, never `any`. Validate anything that crosses a boundary (Zod / Pydantic).
3. Tests never call a model, AWS or the network; use the stub model and stand-ins.
4. Python: always `uv run`. TypeScript: npm scripts that work on Windows, macOS and Linux.
5. No secrets in git. `.env` files stay local; `.env.example` documents them.
