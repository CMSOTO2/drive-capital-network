# 0007: Usage telemetry, designed but not built

- **Status:** Proposed. Nothing in this version sends data anywhere.
- **Date:** 2026-10-19
- **Origin:** My request, Claude's design. I asked for analytics; Claude pointed out the privacy problem with sending data from a file full of names and proposed local `--stats` plus this written design. I chose that option.

## Context

If this were a real internal tool, we'd want to know how it's used: which mistakes people make most (so hints can improve), which options matter, how often runs fail, and how large networks get (for performance planning).

The input is Drive's relationship data: real people's names and who talked to whom. A command-line tool that sends anything off the machine without being asked would break the trust of the people running it, and any leak of names would be serious.

## Decision

This version has no telemetry. `--stats` gives each user the same summary locally, as text or JSON (see `src/core/stats.ts`).

If telemetry is added later, it follows these rules:

- **Opt-in only.** Off unless `ANALYZE_NETWORK_TELEMETRY=1` is set. `DO_NOT_TRACK=1` always wins. The first run with telemetry on prints a one-line notice saying what is sent and how to turn it off.
- **Counts only.** One event per run: the `RunStats` object, the tool version, which options were used (flag names only, never values, since `--company` values are company names), the exit code, the run time, the Node version, and the OS. Never names, file paths, or line text. The existing test that `summarize` output contains no names would guard this.
- **Never in the way.** Sent after the report is written, with a short timeout. A failed send is ignored silently and never changes the exit code or the output.
- **Internal only.** Events go to an internal endpoint, documented in the README alongside the switch to turn them off.

## Consequences

- No privacy risk in the submission, and nothing for reviewers to audit.
- `RunStats` is already the event payload, so adding telemetry later is a small, contained change in `src/cli/`. The core stays free of I/O.
- With opt-in, the numbers will undercount, since many people never turn it on. For an internal tool with a handful of users, asking them directly may be just as useful.
