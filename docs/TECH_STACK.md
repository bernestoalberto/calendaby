# Tech stack

| Part | Choice |
| --- | --- |
| App | React 19, TypeScript (strict), Vite, PWA via `vite-plugin-pwa` |
| Native shells | Capacitor 8 (iOS, Android) wrapping the same `dist/` build |
| Device storage | SQLite: WASM on the web, Capacitor plugin on native |
| Backend | Hono on SQLite (`node:sqlite`) |
| Agent | Vercel AI SDK tool loop in TypeScript |
| Models | OpenRouter, chosen by `MODEL_NAME` |
| Validation | Zod everywhere |
| Hosting | Vercel: static app plus `api/` functions |
| Tests | Vitest, Playwright; Husky runs `npm run check` before commits |

How the pieces fit is in [ARCHITECTURE.md](ARCHITECTURE.md).
