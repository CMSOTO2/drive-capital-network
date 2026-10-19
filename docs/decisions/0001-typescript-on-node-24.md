# 0001: TypeScript on Node 24

- **Status:** Accepted
- **Date:** 2026-10-19

## Context

The prompt asks for the language and tools I'm strongest in, not Drive's stack. The program reads a text file and prints text, so performance isn't the deciding factor.

## Decision

TypeScript in strict mode on Node 24, with pnpm, Vitest, oxlint, and oxfmt. The code sticks to erasable syntax (no enums or namespaces), so Node 24 can run the source directly through type stripping (`pnpm dev`), while `tsc` builds `dist/` for normal use.

## Consequences

- **Update:** the code runs on Node 22.18+ as well (the first Node 22 release that strips types by default). CI tests 22.18 and 24, so reviewers on the previous LTS don't need to upgrade. `engine-strict` makes an older Node fail at install time with a clear message, and `.nvmrc` pins 24 for development.
- Strict compiler flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) catch missing-value bugs at compile time.
- Node's standard library covers argument parsing (`parseArgs`), line reading (`readline`), and color (`styleText`), so Zod is the only runtime dependency.
