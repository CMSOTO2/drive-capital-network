# Drive Capital Network Analyzer

[![CI](https://github.com/CMSOTO2/drive-capital-network/actions/workflows/ci.yml/badge.svg)](https://github.com/CMSOTO2/drive-capital-network/actions/workflows/ci.yml)

A command-line tool that reads Herbie's network file (partners, companies, employees, and contacts) and prints, for each company, the Drive Capital partner with the strongest relationship to it.

```console
$ analyze-network examples/input.txt
ACME: No current relationship
Globex: Chris (2)
Hooli: Molly (1)
```

## Contents

- [Quick start](#quick-start)
- [Usage](#usage)
- [Development](#development)
- [Approach](#approach)
- [Assumptions and edge cases](#assumptions-and-edge-cases)
- [How I used LLMs](#how-i-used-llms)
- [What was challenging](#what-was-challenging)
- Further reading: [ARCHITECTURE.md](./ARCHITECTURE.md), [ROADMAP.md](./ROADMAP.md), [decision records](./docs/decisions/), [CONTRIBUTING.md](./CONTRIBUTING.md), [CHANGELOG.md](./CHANGELOG.md)

## Quick start

Requires **Node 24+** and **pnpm 10**. `.nvmrc` pins Node 24 (`nvm use`), and `pnpm install` refuses to run on an older Node.

```bash
pnpm install
pnpm build

# From a file
node dist/cli/main.js examples/input.txt

# From STDIN
cat examples/input.txt | node dist/cli/main.js
```

Shortcuts:

| Command               | What it does                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm analyze <file>` | Runs the built CLI (`node dist/cli/main.js`)                                                                                      |
| `pnpm dev <file>`     | Runs the TypeScript source directly, no build step                                                                                |
| `pnpm link --global`  | Puts `analyze-network` on your `PATH`, as in the examples below (run `pnpm setup` once first if pnpm has no global bin directory) |

## Usage

```text
analyze-network [options] [file]
cat file | analyze-network [options]
```

Input comes from `file`, or from STDIN when `file` is missing or `-`. The report goes to **stdout**, and warnings go to **stderr**, so the report stays clean when piped.

| Option                      | Description                                                                     |
| --------------------------- | ------------------------------------------------------------------------------- |
| `-c`, `--company <name>`    | Only report this company. Repeat for more. Exits 1 if a name isn't in the input |
| `-d`, `--details`           | List every partner's strength, not just the strongest                           |
| `-f`, `--format text\|json` | Output format. `text` (default) is the format the prompt asks for               |
| `--strict`                  | Stop at the first invalid line and exit 1, printing no report                   |
| `-q`, `--quiet`             | Don't print warnings about skipped lines                                        |
| `--no-color`                | Plain warnings. `NO_COLOR=1` works too; `FORCE_COLOR=1` forces color            |
| `-h`, `--help`              | Show help                                                                       |
| `-v`, `--version`           | Show the version                                                                |

| Exit code | Meaning                                                                    |
| --------- | -------------------------------------------------------------------------- |
| `0`       | Report printed. Invalid lines, if any, were skipped with a warning         |
| `1`       | Invalid input with `--strict`, or a `--company` that isn't in the input    |
| `2`       | Bad options, unreadable file, or no input (e.g. run with nothing piped in) |

### Invalid input

By default a bad line is reported and skipped, and the rest of the file is still analyzed. Like a compiler error, each warning names the line, shows it, marks the words at fault, and suggests a fix where it can:

```console
$ analyze-network examples/edge-cases.txt
warning: line 18: contact type "Coffee" is not valid (did you mean "coffee"?)
  18 | Contact Jamie Chris Coffee
     |                     ^^^^^^
warning: line 20: contact skipped: partner "Rezzan" hasn't been declared
  20 | Contact Peter Rezzan call
     |               ^^^^^^
     = note: "Rezzan" is declared later, on line 21; declarations must come before the lines that use them
warning: line 27: contact skipped: "Chris" is a partner and "Sarah" is an employee; the order is Contact Sarah Chris call
  27 | Contact Chris Sarah call
     |         ^^^^^ ^^^^^
…
note: skipped 11 invalid lines; use --strict to fail instead
ACME: Adam (1)
Globex: Molly (2)
hooli: No current relationship
Initech: No current relationship
```

[`examples/edge-cases.txt`](./examples/edge-cases.txt) exercises the rules in the [edge-case table](#assumptions-and-edge-cases), and its expected output is in [`examples/edge-cases.expected.txt`](./examples/edge-cases.expected.txt).

### Asking about specific companies

`--company` answers the prompt's question "who is the person we know best at ACME?" directly, and `--details` shows the full ranking behind the answer:

```console
$ analyze-network --company Globex --details examples/input.txt
Globex: Chris (2), Molly (1)

$ analyze-network --company Globexx examples/input.txt
error: company "Globexx" isn't in the input (did you mean "Globex"?)
```

### JSON output

`--format json` prints the same report as JSON, plus the full ranking of partners behind each answer, for scripts and other tools:

```console
$ analyze-network --format json examples/input.txt
[
  { "company": "ACME", "partner": null, "strength": 0, "partners": [] },
  {
    "company": "Globex",
    "partner": "Chris",
    "strength": 2,
    "partners": [
      { "partner": "Chris", "strength": 2 },
      { "partner": "Molly", "strength": 1 }
    ]
  },
  …
]
```

(Compacted here; the real output puts one key per line.)

## Development

| Command           | What it does                                                   |
| ----------------- | -------------------------------------------------------------- |
| `pnpm test`       | Vitest unit and end-to-end tests                               |
| `pnpm test:watch` | Tests in watch mode                                            |
| `pnpm lint`       | oxlint; warnings fail the run                                  |
| `pnpm format`     | oxfmt, rewriting files in place                                |
| `pnpm typecheck`  | `tsc --noEmit`                                                 |
| `pnpm check`      | Typecheck, lint, format check, and tests. CI runs exactly this |

Git hooks install with `pnpm install`:

- **pre-commit** lints and formats the staged files (`oxlint --fix`, oxfmt), re-stages them, then runs the test suite. A lint error or a failing test blocks the commit.
- **commit-msg** runs commitlint, which rejects any message that isn't a [Conventional Commit](https://www.conventionalcommits.org/).

GitHub Actions runs `pnpm check` on every push to `main` and on every pull request. VS Code picks up the recommended extensions and format-on-save from `.vscode/`. [CONTRIBUTING.md](./CONTRIBUTING.md) has the full workflow.

## Approach

The program is a pipeline: read lines, parse each into a typed command, apply it to an in-memory network model, rank partners per company, and format the result.

```text
file / STDIN → parse (Zod) → network model → rank → format → stdout
                    └──────────── warnings ──────────────────→ stderr
```

The code is split into layers: constants and Zod schemas at the bottom, pure domain logic in `src/core/`, and all I/O in `src/cli/`. Tests mirror that layout. Nothing in `core` touches the filesystem or `process`, so every rule can be tested with plain strings. [ARCHITECTURE.md](./ARCHITECTURE.md) has the full module map.

### Design decisions

Each of these has a short decision record in [`docs/decisions/`](./docs/decisions/).

- **TypeScript on Node 24.** It's the language I'm most fluent in. `tsc` builds to `dist/`, and `pnpm dev` runs the source directly through Node's built-in type stripping.
- **Zod at the input boundary.** Command shapes are defined once as Zod schemas, and the TypeScript types are inferred from them, so compile-time types and runtime checks can't drift apart. Every line is validated before it reaches the network model. The CLI options use the same approach.
- **Count contacts as they're read.** Each `Contact` adds one to its company/partner pair immediately instead of being stored. Memory grows with the number of company/partner pairs, not the number of contacts, and ranking is a single pass. The cost is that per-contact detail (type, employee) isn't kept; [ROADMAP.md](./ROADMAP.md) covers when that would change.
- **Lenient by default, strict on request.** The prompt says input is well formed, but a real data feed won't always be. One bad line shouldn't hide the answer for every other company, so the tool warns and keeps going. `--strict` is there for pipelines that would rather fail.
- **Deterministic output.** Ties and sort order follow fixed rules (below), so the same input always gives the same output.
- **A CLI, not a web UI.** The input is a file and the output is a few lines of text that people will pipe, diff, and script. A web front end would add a server, a build, and a second way to run the code without making the answer clearer. The effort went into the command line instead: helpful errors, `--help`, exit codes, JSON output, and color that turns itself off when piped.

## Assumptions and edge cases

| Case                                                                            | Behavior                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two partners tie for strongest                                                  | The alphabetically first partner wins. The prompt doesn't say; I picked a deterministic rule.                                                                                                                               |
| Company sort order                                                              | Case-insensitive alphabetical, with an ordinal tiebreak. Matches the example (`ACME`, `Globex`, `Hooli`).                                                                                                                   |
| Contact type other than `email`, `call`, `coffee`                               | Rejected with a warning ("should only accept" those three).                                                                                                                                                                 |
| Contact type weighting                                                          | None. Every contact counts as 1, since strength is the "total amount of Contacts".                                                                                                                                          |
| Contact names an undeclared employee or partner                                 | Warning, line skipped. Commands are processed in order, so a contact can't refer forward to a later declaration. If the name is declared further down, the warning says on which line, since moving it up is the usual fix. |
| Employee names an undeclared company                                            | Warning, line skipped. The prompt says this won't happen; the check is cheap.                                                                                                                                               |
| Same partner or company declared twice                                          | Ignored, no warning.                                                                                                                                                                                                        |
| Employee declared again at a different company                                  | Warning, first declaration kept (employee names are globally unique).                                                                                                                                                       |
| Identical `Contact` lines repeated                                              | Each one counts. They're separate interactions.                                                                                                                                                                             |
| Blank lines, Windows line endings, extra spaces or tabs                         | Tolerated.                                                                                                                                                                                                                  |
| No newline at the end of the file                                               | Tolerated.                                                                                                                                                                                                                  |
| Lines starting with `#`                                                         | Skipped as comments. The prompt says real input won't have them, but its example does, so pasting the example as-is works.                                                                                                  |
| UTF-8 byte order mark at the start of the file                                  | Stripped. Some Windows editors add one.                                                                                                                                                                                     |
| Typo or wrong case in a keyword or contact type (`Contcat`, `partner`, `cofee`) | Rejected, since the prompt defines exact words, but the warning suggests the fix: `did you mean "Contact"?`                                                                                                                 |
| Undeclared name close to a declared one (`Lauri` vs `Laurie`)                   | Warning, line skipped, with `did you mean "Laurie"?`                                                                                                                                                                        |
| Employee and partner swapped in a `Contact`                                     | Warning, line skipped, showing the corrected line                                                                                                                                                                           |
| Unknown command, wrong number of words, non-letter characters                   | Warning, line skipped. The warning lists the valid commands or shows the expected usage.                                                                                                                                    |
| Partner with no contacts                                                        | Never appears in the output.                                                                                                                                                                                                |
| Same name used for a partner and an employee                                    | Allowed. Partners and employees are separate namespaces.                                                                                                                                                                    |
| Empty input, or no companies declared                                           | Empty report, plus a note on stderr explaining why.                                                                                                                                                                         |
| No line in the file is a valid command                                          | Warnings, plus a note asking whether it's the right file.                                                                                                                                                                   |
| Thousands of invalid lines                                                      | The first 20 warnings are shown, then "…and N more", so a wrong file doesn't flood the terminal.                                                                                                                            |
| Run with no file and nothing piped in                                           | Exits 2 with a usage hint instead of silently waiting for keyboard input.                                                                                                                                                   |
| Output piped into a command that exits early (`\| head -1`)                     | Exits quietly with code 0 instead of printing a stack trace.                                                                                                                                                                |
| Large input                                                                     | Streamed line by line. A 200,000-line file runs in about 0.3 seconds.                                                                                                                                                       |

## How I used LLMs

I used Claude Code throughout, with the same review bar I'd apply to a teammate's PR.

- **Planning:** I gave it the prompt and asked for a plan before any code. We agreed on the pipeline, the data model, and the edge-case table above. I made the design calls: ties, lenient error handling, counting at ingest, and a CLI over a web UI.
- **Tooling:** it set up TypeScript, oxlint, oxfmt, Vitest, husky, commitlint, and CI. When it was unsure of current versions or options, it checked the installed packages' schemas and the official docs, and it tested that each hook actually blocks a bad commit.
- **Code and tests:** it implemented each roadmap phase as small Conventional Commits, writing tests alongside the code. I reviewed the diffs and steered along the way, e.g. the folder layout, splitting out schemas and constants, and using Zod for validation.
- **Docs:** it drafted this README, ARCHITECTURE.md, ROADMAP.md, and the decision records. A rule in [CLAUDE.md](./CLAUDE.md) requires them to change in the same commit as the code they describe, which kept them accurate as the design changed.

## What was challenging

- **Reading between the lines of the spec.** Most of the work was deciding what to do where the prompt is silent: ties, forward references, bad contact types, the `#` comment in the example. I treated each one as a product decision, picked something deterministic, and wrote it down instead of guessing silently.
- **Leniency versus correctness.** Skipping bad lines is friendlier, but silently wrong output is worse than a crash. The answer was to stay lenient and make every skip visible (line number, the line itself, a summary), and to add `--strict` for callers that would rather fail.
- **Good error messages from a schema library.** Zod's default messages are written for developers. Getting from a generic enum error to `contact type "Coffee" is not valid (did you mean "coffee"?)` meant checking structure (keyword, word count) before Zod, and customizing Zod's messages for the rest.
- **New tooling.** TypeScript 7, oxlint, and oxfmt are recent, so some common advice didn't apply. For example, VS Code's `typescript.tsdk` setting doesn't work with TypeScript 7. Each config was checked against the installed version instead of copied from older examples.

See [ROADMAP.md](./ROADMAP.md) for what I'd build next.
