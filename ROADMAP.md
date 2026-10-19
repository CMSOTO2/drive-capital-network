# Roadmap

Each phase lands as one or more [Conventional Commits](https://www.conventionalcommits.org/). Check off items as they merge, and update README.md and ARCHITECTURE.md in the same commit whenever the code no longer matches them.

## Phase 0: Scaffold (`chore:`)

- [x] Git repo, `package.json`, pnpm
- [x] TypeScript config (`tsconfig.json`, `tsconfig.build.json`)
- [x] oxlint, oxfmt, Vitest config
- [x] Pre-commit hook: husky + lint-staged (lint, format, tests)
- [x] Commit-msg hook: commitlint with the Conventional Commits config
- [x] Node 24 pinned (`.nvmrc`, `engine-strict`), GitHub Actions CI, VS Code format-on-save
- [x] `examples/input.txt` and `examples/expected.txt` from the prompt
- [x] README.md, ARCHITECTURE.md, ROADMAP.md, CLAUDE.md
- [x] `pnpm install` and a passing `pnpm check`

## Phase 1: Parsing (`feat:`)

- [x] `src/schemas/command.ts`: Zod schemas, inferred `Command` union and `ContactType`; constants in `src/constants.ts`
- [x] `src/core/parse.ts`: `parseLine`
- [x] Tests: each command type, invalid contact type, wrong word count, unknown command, non-letter names, blank lines, CRLF, extra whitespace, `#` comments, byte order mark, case-mismatch hints

## Phase 2: Network model (`feat:`)

- [x] `src/core/network.ts`: `Network.apply`, counting at ingest
- [x] Tests: counts across several employees of one company, duplicate declarations, employee redeclared at another company, contacts with unknown employee or partner, forward references, shared names across namespaces

## Phase 3: Analysis and formatting (`feat:`)

- [x] `src/core/analyze.ts`: `rankRelationships`, `strongestPartner`
- [x] `src/core/format.ts`: `formatLine`, `formatTextReport`, `formatJsonReport`
- [x] Tests: tie-breaking, no relationship, company sort order (mixed case), partner with zero contacts, empty network, JSON shape

## Phase 4: CLI (`feat:`)

- [x] `src/core/pipeline.ts`: wires the stages, collects diagnostics with line numbers
- [x] `src/cli/main.ts`: file argument, STDIN (no argument or `-`), exit codes 0/1/2
- [x] `src/cli/args.ts` + `src/schemas/options.ts`: `node:util` `parseArgs`, validated with Zod
- [x] `--format json`, `--strict`, `--quiet`, `--[no-]color`, `--help`, `--version`
- [x] Compiler-style warnings with the offending line, capped at 20, plus summary notes
- [x] Usage error instead of hanging when STDIN is a terminal; quiet exit on `EPIPE`
- [x] Golden tests: `examples/input.txt` and `examples/edge-cases.txt` against their expected output
- [x] Tests: bad input warns on stderr with a clean report on stdout (exit 0); `--strict` exits 1; missing file, directory, unreadable file, and bad options exit 2
- [x] End-to-end tests through a child process

## Phase 5: Polish (`docs:`)

- [x] Remove the _(planned)_ markers from README.md and ARCHITECTURE.md
- [x] README: usage, exit codes, JSON output, LLM usage, what was challenging
- [x] Architecture decision records in `docs/decisions/`
- [x] CONTRIBUTING.md, pull request template, CHANGELOG.md
- [x] Final read of all docs against the code

## Phase 6: Friendlier diagnostics (`feat:`)

- [x] "Did you mean" suggestions for typos in keywords, contact types, and employee, partner, and company names
- [x] Hint when a `Contact` lists the partner before the employee
- [x] Mark the offending word under the echoed line
- [x] Point to a later declaration when a line refers to a name declared further down
- [x] `--company <name>` to report on specific companies, with a suggestion for unknown names
- [x] `--details` to show every partner's strength in text output

## Later (not planned for the submission)

- **Weighted contact types:** a coffee probably says more about a relationship than an email. This would be a weight table in `constants.ts` and one line in `Network`.
- **Keep a raw contact log** next to the counts, to answer the prompt's other questions:
  - "Who do we know who works at ACME?"
  - "Who at Drive can introduce me to the CEO of ACME?" (needs titles and a graph traversal)
- **Recency:** weight recent contacts above old ones. The input would need timestamps.
- **Forward references:** accept a contact before its employee or partner is declared, by buffering unresolved contacts until the end. This costs memory proportional to the unresolved contacts.
- **Publish to npm** so `npx analyze-network` works without cloning.
