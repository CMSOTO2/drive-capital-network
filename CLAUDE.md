# CLAUDE.md

Drive Capital take-home: a TypeScript CLI that reports the strongest partner relationship per company. The prompt's rules come first: it's kept verbatim in `docs/prompt.md` (never edit it), and `test/docs/prompt.test.ts` runs its example. Before changing behavior, check it against the prompt; where the prompt is unclear, record the interpretation in the README's "Assumptions and edge cases" table. See README.md for the output format and assumptions.

## Docs stay in sync with the code

README.md, ARCHITECTURE.md, ROADMAP.md, and CHANGELOG.md (under "Unreleased") describe the code. After any change to `src/`, `test/`, scripts, or config, reread all four and fix whatever no longer matches (module table, data model, rules, edge-case table, run commands, roadmap checkboxes) **in the same commit**. Significant design choices get a record in `docs/decisions/`. CONTRIBUTING.md is the human-facing version of these rules; keep the two consistent.

## Commits

- Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`. Optional scope, e.g. `feat(parse): …`. Enforced by commitlint in `.husky/commit-msg` (`commitlint.config.js`).
- Small commits, one roadmap item or less each.
- Run `pnpm check` before committing; don't commit with failures.
- The husky pre-commit hook (`.husky/pre-commit`) runs lint-staged (oxlint --fix + oxfmt on staged files) and then `pnpm test`. Don't bypass it with `--no-verify`.

## Code

- Node 22.18+ (CI tests 22.18 and 24; develop on 24), pnpm, TypeScript strict. Don't use Node APIs newer than 22.18. Only erasable syntax (no enums or namespaces); relative imports use `.ts` extensions.
- Layout (see ARCHITECTURE.md): constants in `src/constants.ts`, Zod schemas in `src/schemas/`, pure logic in `src/core/`, I/O only in `src/cli/`, shared helpers in `src/utils/`. Imports point one way: `cli → core → schemas → constants`.
- Accessible output: color is never the only signal, information is never dimmed, and the `plain` layout in `src/cli/render.ts` must say everything the `rich` one does.
- Every dependency, dev tools included, must support Node 22.18 (`engine-strict` is on). Check `engines` before adding or upgrading one. lint-staged is pinned to 16.x for this reason (17.x needs 22.22.1).
- No magic strings or numbers in logic; put them in `src/constants.ts`.
- Readable over clever: named intermediate values, plain `if` over chained ternaries or `&&`/`||` tricks, and a comment with an example for any non-obvious algorithm.
- Tests mirror `src/` (`src/core/parse.ts` → `test/core/parse.test.ts`), using Vitest. New behavior needs a test.
- Lint with oxlint, format with oxfmt.
