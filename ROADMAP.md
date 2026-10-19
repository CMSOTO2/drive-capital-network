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

- [ ] `src/core/pipeline.ts`: wires the stages, collects warnings with line numbers
- [ ] `src/cli/main.ts`: file argument, STDIN (no argument or `-`), exit codes
- [ ] Golden test: `examples/input.txt` → `examples/expected.txt`
- [ ] Test: bad-input fixture prints warnings to stderr, a clean report to stdout, exits 0
- [ ] Test: missing file exits 1

## Phase 5: Polish (`docs:`)

- [ ] Remove the _(planned)_ markers from README.md and ARCHITECTURE.md
- [ ] Finish the README sections on LLM usage and what was challenging
- [ ] Final read of all three docs against the code

## Later (not planned for the submission)

- **Weighted contact types:** a coffee probably says more about a relationship than an email.
- **`--strict` mode:** stop at the first bad line with a non-zero exit, for pipelines that want hard failures.
- **Keep a raw contact log** next to the counts, to answer the prompt's other questions:
  - "Who do we know who works at ACME?"
  - "Who at Drive can introduce me to the CEO of ACME?" (needs titles and a graph traversal)
- **Recency:** weight recent contacts above old ones.
- **`--format json`** for other tools to consume.
