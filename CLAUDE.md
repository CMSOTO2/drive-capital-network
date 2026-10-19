# CLAUDE.md

Drive Capital take-home: a TypeScript CLI that reports the strongest partner relationship per company. The prompt's rules come first. See README.md for the output format and assumptions.

## Docs stay in sync with the code

README.md, ARCHITECTURE.md, and ROADMAP.md describe the code. After any change to `src/`, `test/`, scripts, or config, reread all three and fix whatever no longer matches (module table, data model, rules, edge-case table, run commands, roadmap checkboxes) **in the same commit**.

## Commits

- Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`. Optional scope, e.g. `feat(parse): …`. Enforced by commitlint in `.husky/commit-msg` (`commitlint.config.js`).
- Small commits, one roadmap item or less each.
- Run `pnpm check` before committing; don't commit with failures.
- The husky pre-commit hook (`.husky/pre-commit`) runs lint-staged (oxlint --fix + oxfmt on staged files) and then `pnpm test`. Don't bypass it with `--no-verify`.

## Code

- Node 24, pnpm, TypeScript strict. Only erasable syntax (no enums or namespaces); relative imports use `.ts` extensions.
- Only `src/cli.ts` does I/O. Keep everything else pure and unit tested.
- Tests go in `test/<module>.test.ts` (Vitest). New behavior needs a test.
- Lint with oxlint, format with oxfmt.
