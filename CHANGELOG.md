# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `analyze-network` CLI: reads Partner, Company, Employee, and Contact commands from a file or STDIN and prints the partner with the strongest relationship to each company, alphabetically.
- Input validation with Zod. Invalid lines are skipped with a compiler-style warning that shows the line number and the line, with "did you mean" hints for case mistakes.
- `--strict` to stop at the first invalid line (exit 1), `--format json` for machine-readable output with the full partner ranking, `--quiet`, `--[no-]color` with `NO_COLOR` / `FORCE_COLOR` support, `--help`, and `--version`.
- Exit codes: 0 for success, 1 for invalid input with `--strict` or an unknown `--company`, 2 for usage or file errors.
- "Did you mean" hints for typos in keywords, contact types, and declared names, and a hint when a contact lists the partner before the employee.
- Warnings mark the words at fault with `^` and, when a name is declared later in the file, add a note pointing at that line.
- `--company <name>` (repeatable) to report on specific companies, and `--details` to list every partner's strength in text output.
- `./analyze_network` runs the CLI from source with no build step.
- Supports Node 22.18+ as well as 24; CI tests both.
- `--stats` / `-s`: a summary on stderr of everything declared, contacts by type, and skipped lines by reason (JSON with `--format json`).
- `--plain`: screen-reader-friendly diagnostics with no color, decoration, or non-ASCII characters; automatic when `TERM=dumb`.
- `pnpm -s stress`: generates long, messy inputs with the output they must produce, for differential and performance testing. A million contacts run in about 2 seconds.
- Example inputs with expected output: the prompt's example, an edge-case file, and 30 scenarios in `examples/scenarios/` covering happy paths, mistakes, and awkward files.
- "Did you mean" hints for mistyped options (`--detail` → `--details`) and file names (`inptu.txt` → `input.txt`, `input` → `input.txt`).
- Warnings cut lines over 100 characters to an excerpt around the words at fault, and shorten names over 40 characters, so one huge line can't flood the terminal.
- On a terminal, a blank line separates the warnings from the report. `…and N more warnings` points to `--stats`, and `--stats` lists skipped lines one reason per row.
- Tooling: TypeScript 7, Vitest, oxlint, oxfmt, husky + lint-staged pre-commit hook, commitlint, and GitHub Actions CI.
