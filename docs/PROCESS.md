# Process

`npm run check` runs lint, typecheck and build, and Vitest. Run it before handing work over.

- Plan larger work in `docs/PLAN_<NAME>.md` with phases and checkable success criteria, then build phase by phase.
- Add tests with each change. Never lower a threshold or skip a test to get green.
- The capture eval (`evals/capture.json`) has a baseline for the rules parser in `evals/capture.eval.test.ts`; raise it when the rules improve.
- The WebMCP evals (`evals/webmcp/`, run with Google's `webmcp-evals`, pinned in the scripts) check that an assistant picks the right tool with the right arguments. `npm test` keeps `schema.json` identical to the tools the app registers and checks every case against it. `npm run evals:webmcp:smoke` calls each expected tool on the live page (no model, no key; needs Chrome Canary with WebMCP on, and the dev server started signed out: `VITE_CLERK_PUBLISHABLE_KEY= npx vite --host`). `npm run evals:webmcp` has a model choose the tools (needs `GOOGLE_AI`, `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env`; costs tokens, not part of `npm run check`). Reports go to `.evals/`.
- Keep `docs/STATUS.md` current.
- The agent never runs `git commit` or `git push`. It hands the owner the commands (and a commit message) to run himself. No `Co-Authored-By` trailers in commit messages.
