# 0008: Accessible output

- **Status:** Accepted
- **Date:** 2026-10-19

## Context

The warnings follow compiler conventions: a `|` gutter, a row of `^` under the words at fault, and color. That reads well on screen but poorly through a screen reader, which reads every character out ("caret caret caret"). Color and dim text are also hard to see for some people and on some terminal themes. Some terminals (`TERM=dumb`) can't show color or Unicode at all.

## Decision

- Every message starts with a word (`error:`, `warning:`, `note:`); color only reinforces it.
- Text that carries information is never dimmed. Only decoration is.
- Every warning names the line and the value at fault in words, so the `^` markers are never the only way to find the problem.
- `--plain` switches diagnostics to a layout made of sentences (`line 20 reads: …`, `word at fault: "Rezzan"`, `note: …`), with no color and ASCII only. It turns on automatically when `TERM=dumb`. An explicit `--color` still wins.
- `NO_COLOR`, `FORCE_COLOR`, and `--[no-]color` work as their conventions describe.

## Consequences

- Screen-reader users and people on limited terminals get the same information as everyone else.
- The report on stdout is unaffected; it never had decoration or color.
- Two layouts have to stay in sync. Tests check the plain layout's wording, and CONTRIBUTING.md makes keeping them in sync a review rule.
