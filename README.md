# Drive Capital Network Analyzer

A command-line tool that reads Herbie's network file (partners, companies, employees, and contacts) and prints, for each company, the Drive Capital partner with the strongest relationship to it.

> **Status:** scaffolding. The tooling and docs are in place; the analyzer is built phase by phase in [ROADMAP.md](./ROADMAP.md). Commands below marked _(planned)_ don't work yet.

## Quick start

Requires Node 24+ and pnpm 10. `.nvmrc` pins Node 24 (`nvm use`), and `pnpm install` refuses to run on an older Node (`engine-strict`).

```bash
pnpm install
pnpm build                              # (planned) compile TypeScript to dist/
pnpm analyze examples/input.txt         # (planned) read from a file
cat examples/input.txt | pnpm analyze   # (planned) read from STDIN
pnpm dev examples/input.txt             # (planned) run from source, no build step
```

Expected output for the example input:

```
ACME: No current relationship
Globex: Chris (2)
Hooli: Molly (1)
```

### Tests and checks

```bash
pnpm test          # Vitest unit tests
pnpm lint          # oxlint
pnpm format        # oxfmt (write)
pnpm typecheck     # tsc --noEmit
pnpm check         # all of the above, read-only
```

A pre-commit hook (husky + lint-staged) runs automatically after `pnpm install`. It lints the staged files with `oxlint --fix`, formats them with oxfmt and re-stages the result, then runs the full test suite. A lint error or a failing test blocks the commit. A `commit-msg` hook runs commitlint, which rejects any message that isn't a [Conventional Commit](https://www.conventionalcommits.org/). GitHub Actions (`.github/workflows/ci.yml`) runs `pnpm check` on every push to `main` and on pull requests.

VS Code users: the repo recommends the Oxc extension and formats on save with oxfmt (`.vscode/`).

## Approach

The program works as a pipeline: read lines, parse each into a typed command, apply it to an in-memory network model, then analyze and format the result. Only the CLI entry point touches I/O. Everything else is a pure function or a small class, so each stage has its own unit tests.

Relationship strength is counted while the input is read rather than afterwards. Each `Contact` looks up its employee's company and adds one to that company/partner pair, so analysis is a single pass over the counts. [ARCHITECTURE.md](./ARCHITECTURE.md) covers the module layout, data model, and tradeoffs.

### Design decisions

- **TypeScript on Node 24.** It's the language I'm most fluent in. `tsc` builds to `dist/`, and `pnpm dev` runs the source directly through Node's built-in type stripping.
- **File or STDIN.** A file path argument is read from disk. With no argument (or `-`), input comes from STDIN.
- **Lenient on bad input, but loud about it.** The prompt says input is well formed. I still treat this as a product: a bad line prints a warning with its line number to stderr and is skipped, and the report on stdout stays clean so it can be piped.
- **Deterministic output.** Ties and sort order follow fixed rules (below), so the same input always gives the same output.

## Assumptions and edge cases

| Case                                                          | Behavior                                                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Two partners tie for strongest                                | The alphabetically first partner wins. The prompt doesn't say; I picked a deterministic rule.             |
| Company sort order                                            | Case-insensitive alphabetical, with an ordinal tiebreak. Matches the example (`ACME`, `Globex`, `Hooli`). |
| Contact type other than `email`, `call`, `coffee`             | Rejected with a warning ("should only accept" those three).                                               |
| Contact type weighting                                        | None. Every contact counts as 1, since strength is the "total amount of Contacts".                        |
| Contact names an undeclared employee or partner               | Warning, line skipped. Commands are processed in order.                                                   |
| Employee names an undeclared company                          | Warning, line skipped. The prompt says this won't happen; the check is cheap.                             |
| Same partner or company declared twice                        | Ignored, no warning.                                                                                      |
| Employee declared again at a different company                | Warning, first declaration kept (employee names are globally unique).                                     |
| Identical `Contact` lines repeated                            | Each one counts. They're separate interactions.                                                           |
| Blank lines, Windows line endings, extra spaces               | Tolerated.                                                                                                |
| Unknown command, wrong number of words, non-letter characters | Warning, line skipped.                                                                                    |
| Partner with no contacts                                      | Never appears in the output.                                                                              |
| No companies declared                                         | Empty output.                                                                                             |
| A partner and an employee share a name                        | Allowed. Partners and employees are separate namespaces.                                                  |

## How I used LLMs

I used Claude Code throughout, with the same review bar I'd apply to a teammate's PR.

- **Planning:** I gave it the prompt and asked for a plan before any code. We agreed on the pipeline, the data model, and the edge-case table above. The design calls (ties, lenient error handling, counting at ingest) were reviewed and decided by me.
- **Scaffolding and docs:** it generated the project config and the first drafts of this README, ARCHITECTURE.md, and ROADMAP.md, which I edited.
- **Code and tests:** _to be filled in as each roadmap phase lands._

## What was challenging

_To be filled in at the end._ See [ROADMAP.md](./ROADMAP.md) for what's next.
