# Process

`npm run check` runs lint, typecheck and build, Vitest, and the agent's pytest suite. Run it before handing work over.

- Plan larger work in `docs/PLAN_<NAME>.md` with phases and checkable success criteria, then build phase by phase.
- Add tests with each change. Never lower a threshold or skip a test to get green.
- The capture eval (`evals/capture.json`) has a baseline for the rules parser in `evals/capture.eval.test.ts`; raise it when the rules improve. `uv run evals.py` in `agent/` scores the live agent and costs money, so run it by hand.
- Keep `docs/STATUS.md` current.
- Commit locally. Push only with the owner's approval.
