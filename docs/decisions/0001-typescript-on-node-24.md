# 0001: TypeScript on Node 24

- **Status:** Accepted
- **Date:** 2026-10-19
- **Origin:** Mine: TypeScript, pnpm, Vitest, oxlint, and oxfmt were my choices from the start. Supporting Node 22.18 as well as 24 was one of several reviewer-experience options Claude offered; I chose it.

## Context

The prompt asks for the language and tools I'm strongest in, not Drive's stack. The program reads a text file and prints text, so performance isn't the deciding factor.

## Decision

TypeScript in strict mode on Node 24, with pnpm, Vitest, oxlint, and oxfmt. The code sticks to erasable syntax (no enums or namespaces), so Node 24 can run the source directly through type stripping (`pnpm dev`), while `tsc` builds `dist/` for normal use.

## Consequences

- **Update:** the code runs on Node 22.18+ as well (the first Node 22 release that strips types by default). CI tests 22.18 and 24, so reviewers on the previous LTS don't need to upgrade. `engine-strict` makes an older Node fail at install time with a clear message, and `.nvmrc` pins 24 for development.
- Strict compiler flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) catch missing-value bugs at compile time.
- Node's standard library covers argument parsing (`parseArgs`) and color (`styleText`), and a 50-line `readLines` splits input into lines, so Zod is the only runtime dependency. (It started with `node:readline`, whose async iterator turned out to drop lines when a single chunk is large.)
