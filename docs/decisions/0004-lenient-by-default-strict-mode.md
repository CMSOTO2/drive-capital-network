# 0004: Lenient by default, with a strict mode

- **Status:** Accepted
- **Date:** 2026-10-19
- **Origin:** Claude's suggestion, accepted. Warn-and-skip was in the initial plan, with `--strict` listed as future work; Claude built it in the CLI phase.

## Context

The prompt says input is well formed and leaves error handling up to us. In practice, network data comes from imports and other systems, and it won't always be clean. Two failure modes are bad: crashing on one typo, which hides the answer for every other company, and silently producing a wrong answer.

## Decision

By default, an invalid line is skipped and reported on stderr with its line number and text. The rest of the file is still analyzed, and the report on stdout stays clean. `--strict` stops at the first invalid line with exit code 1 and no report, for pipelines that would rather fail. Usage and file errors always exit 2. Exit 1 also covers a `--company` that isn't in the input, since in both cases the input can't answer the request.

## Consequences

- One bad line costs one warning, not the whole report.
- Every skip is visible, and a summary line says how many lines were skipped.
- Callers in scripts can tell what happened from the exit code alone.
- Warnings are capped at 20 so a wrong file doesn't flood the terminal; the count of hidden warnings is still shown.
