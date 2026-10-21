# 0002: Validate input with Zod

- **Status:** Accepted
- **Date:** 2026-10-19
- **Origin:** Mine: I asked for Zod for validation. Claude designed the two-step check (structure first, then the schema) and the custom messages.

## Context

Every line is untrusted text. Hand-written checks and hand-written TypeScript types tend to drift apart over time, and an invalid value that slips past parsing turns into a confusing bug deep in the model.

## Decision

Each command is a Zod schema in `src/schemas/command.ts`, and the `Command` types are inferred from those schemas with `z.infer`. `parseLine` checks structure first (known keyword, right number of words), because those errors need the usage string. The words then go through the schema. Zod's error messages are customized into plain English. CLI options follow the same pattern in `src/schemas/options.ts`.

## Consequences

- One source of truth for both the shape and the rules of every command.
- The network model only ever receives valid commands, so it doesn't re-check names or contact types.
- One runtime dependency. Zod is widely used and stable, and its error customization made "did you mean" hints straightforward.
