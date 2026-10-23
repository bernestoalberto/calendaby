# Process

`npm run check` runs lint, typecheck and build, and Vitest. Run it before handing work over.

- Plan larger work in `docs/PLAN_<NAME>.md` with phases and checkable success criteria, then build phase by phase.
- Add tests with each change. Never lower a threshold or skip a test to get green.
- The capture eval (`evals/capture.json`) has a baseline for the rules parser in `evals/capture.eval.test.ts`; raise it when the rules improve.
- Keep `docs/STATUS.md` current.
- The agent never runs `git commit` or `git push`. It hands the owner the commands (and a commit message) to run himself.
