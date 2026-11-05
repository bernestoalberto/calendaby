# Calendaby

A Huckleberry-style baby tracker built for dads and co-parents. Before you plan or change anything, read:

1. `docs/SPEC.md`: what the product must do
2. `docs/TECH_STACK.md`: the tech choices
3. `docs/CODE_STANDARDS.md`: how to write the code
4. `docs/PROCESS.md`: how to plan, build and check the work
5. `docs/STATUS.md`: what is built and how to run it

Follow the nine working rules in `docs/CODE_STANDARDS.md` on every change.

For any HTML, CSS or browser-side JavaScript work (forms, dialogs, dates, accessibility, performance, WebMCP), run the `modern-web-guidance` skill first (`.agents/skills/modern-web-guidance`, locked in `skills-lock.json`) and follow the guides it returns. Features that are not Baseline widely available need the fallback the guide gives. It is not for backend, tooling or tests.

Never run `git commit` or `git push`. Give the owner the exact commands and he runs them himself, after testing locally. Staging with `git add` is also his call unless he asks. Commit messages carry no `Co-Authored-By` line.
