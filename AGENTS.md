# Calendaby

A Huckleberry-style baby tracker built for dads and co-parents. Before you plan or change anything, read:

1. `docs/SPEC.md`: what the product must do
2. `docs/TECH_STACK.md`: the tech choices
3. `docs/CODE_STANDARDS.md`: how to write the code
4. `docs/PROCESS.md`: how to plan, build and check the work
5. `docs/STATUS.md`: what is built and how to run it

Follow the nine working rules in `docs/CODE_STANDARDS.md` on every change.

Never run `git commit` or `git push`. Give the owner the exact commands and he runs them himself, after testing locally. Staging with `git add` is also his call unless he asks. Commit messages carry no `Co-Authored-By` line.

## Cursor Cloud specific instructions

The app is one Node 22 process. `npm ci` installs it (Husky's `prepare` script runs). The dev server is `npx vite --host 0.0.0.0 --port 5173 --strictPort`; that same process serves the PWA, `/api/backend`, and `/api/agent`. `npm run dev` does not pass `--host`.

Logging and `npm run check` need no secrets. Without `OPEN_ROUTER_API`, `/api/agent` returns 503 and the assistant stays offline. Without `VITE_CLERK_PUBLISHABLE_KEY` the app runs signed out. Turso and Clerk are only for sharing and sign-in.

`npm run check` is lint, the production build, and Vitest, including a smoke test that boots Vite and calls `listEvents`. Node prints an experimental warning for `node:sqlite`; the suite still passes. Playwright uses the installed Chrome (`npx playwright test`). The case "agent answers a baby question" calls the live model and needs `OPEN_ROUTER_API`. The case "Analytics opens" looks for a nav button the default tab bar does not have (the bar is Today, Timeline, Activity, Log, Calendar, Agent).

There is no Android SDK or phone here. Skip the post-commit APK hook with `SKIP_ANDROID_INSTALL=1`. The old Python agent under `agent/*.py` is unused.
