# 0006: A CLI, not a web UI

- **Status:** Accepted
- **Date:** 2026-10-19

## Context

The prompt requires a command-line program and exact output lines. I considered adding a web UI on top to make the tool more pleasant to use.

## Decision

No web UI. The input is a file and the output is a few lines of text that people will pipe, diff, and script. A web front end would add a server, a build, and a second way to run the code, without making the answer any clearer. The UX effort went into the CLI instead: `--help`, compiler-style warnings with "did you mean" hints, meaningful exit codes, `--format json` for other tools, and color that turns itself off when piped or when `NO_COLOR` is set.

## Consequences

- One way to run the program, matching how reviewers will run it.
- `--format json` leaves room for a UI later: any front end could consume it without touching the core.
- Because `src/core/` has no I/O, the same code could back an HTTP endpoint or a browser build if a real need appears.
