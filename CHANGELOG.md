# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `analyze-network` CLI: reads Partner, Company, Employee, and Contact commands from a file or STDIN and prints the partner with the strongest relationship to each company, alphabetically.
- Input validation with Zod. Invalid lines are skipped with a compiler-style warning that shows the line number and the line, with "did you mean" hints for case mistakes.
- `--strict` to stop at the first invalid line (exit 1), `--format json` for machine-readable output with the full partner ranking, `--quiet`, `--[no-]color` with `NO_COLOR` / `FORCE_COLOR` support, `--help`, and `--version`.
- Exit codes: 0 for success, 1 for invalid input with `--strict`, 2 for usage or file errors.
- Example inputs with expected output: the prompt's example and an edge-case file.
- Tooling: TypeScript 7, Vitest, oxlint, oxfmt, husky + lint-staged pre-commit hook, commitlint, and GitHub Actions CI.
