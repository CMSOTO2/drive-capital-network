# Development

How the project is checked and tested. [ARCHITECTURE.md](../ARCHITECTURE.md) covers the code itself.

## Commands

| Command                                 | What it does                                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `pnpm test`                             | Vitest unit and end-to-end tests                                                                                      |
| `pnpm test:watch`                       | Tests in watch mode                                                                                                   |
| `pnpm lint`                             | oxlint; warnings fail the run                                                                                         |
| `pnpm format`                           | oxfmt, rewriting files in place                                                                                       |
| `pnpm typecheck`                        | `tsc --noEmit`                                                                                                        |
| `pnpm check`                            | Typecheck, lint, format check, and tests. CI runs exactly this                                                        |
| `pnpm -s demo [name…]`                  | Runs one labelled example of every flag, or only those named (see the [usage guide](./usage.md#one-example-per-flag)) |
| `pnpm -s stress --contacts N --out DIR` | Writes a generated stress input and its expected output (see below)                                                   |

Requires Node 22.18 or newer and pnpm 10. CI tests Node 22.18 and 24; `.nvmrc` pins 24 for development (`nvm use`).

## Hooks and CI

Git hooks install with `pnpm install`:

- **pre-commit** lints and formats the staged files (`oxlint --fix`, oxfmt), re-stages them, then runs the test suite. A lint error or a failing test blocks the commit.
- **commit-msg** runs commitlint, which rejects any message that isn't a [Conventional Commit](https://www.conventionalcommits.org/).

GitHub Actions runs `pnpm check` on every push to `main` and on every pull request. VS Code picks up the recommended extensions and format-on-save from `.vscode/`. [CONTRIBUTING.md](../CONTRIBUTING.md) has the full workflow.

## Performance and stress testing

`scripts/stress.ts` generates long, messy, reproducible inputs: a byte order mark, CRLF and lone-`\r` noise, tabs, comments, typos, junk lines (CSV, emoji, a NUL byte, a 10,000-character line), names used before they're declared, swapped arguments, companies that differ only by case, a 100,000-letter partner name, and a "hub" company with thousands of contacts.

It also computes the report each input must produce, using a deliberately simple reference model that shares no code with `src/`. Comparing the program against that model (differential testing) checks inputs far too long to verify by hand:

```bash
pnpm -s stress --contacts 1000000 --seed 7 --out /tmp/stress
./analyze_network -q /tmp/stress/stress.txt | diff - /tmp/stress/stress.expected.txt && echo match
```

| Input                                             | Time  | Peak memory |
| ------------------------------------------------- | ----- | ----------- |
| 200,000 contacts (237k lines, 30k bad)            | 0.5 s | 156 MB      |
| 1,000,000 contacts (1.18M lines, 46 MB, 148k bad) | 2.1 s | 295 MB      |

Measured on an Apple Silicon laptop, Node 24. `test/scripts/stress.test.ts` runs the comparison on 25 seeds and on 200,000 contacts piped through the CLI, and [`examples/scenarios/90-stress-10k-contacts.txt`](../examples/scenarios/90-stress-10k-contacts.txt) is a committed 12,000-line sample.

The stress test found three real problems, all fixed: "did you mean" lookups made a file with 30,000 bad lines take 40 seconds (now 0.5), every skipped line was kept in memory (556 MB at a million contacts, now 295), and `node:readline` dropped lines when a stream delivered more than about a thousand lines in one chunk (replaced by `src/cli/lines.ts`).
