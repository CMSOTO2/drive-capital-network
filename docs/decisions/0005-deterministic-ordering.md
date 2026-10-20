# 0005: Deterministic ordering and tie-breaking

- **Status:** Accepted
- **Date:** 2026-10-19
- **Origin:** Claude's suggestion, accepted, from the initial plan.

## Context

The prompt asks for companies "sorted alphabetically" and the partner with the strongest relationship. It doesn't define alphabetical order for mixed case, or what happens when two partners tie.

## Decision

Companies are sorted case-insensitively, with plain code-unit order as a tiebreak, so `ACME`, `apple`, and `Globex` sort the way a person expects, and `Acme` and `ACME` still have a fixed order. When partners tie on strength, the alphabetically first one (by the same comparison) wins. Both rules live in `compareNames` in `src/utils/text.ts`. The same comparison breaks ties between equally close "did you mean" suggestions.

## Consequences

- The same input always produces the same output, regardless of input order or locale.
- The prompt's example output is unchanged.
- A different tie rule (for example, the most recent contact) would be a one-function change once the input carries that information.
