# Drive Capital Network Analyzer

[![CI](https://github.com/CMSOTO2/drive-capital-network/actions/workflows/ci.yml/badge.svg)](https://github.com/CMSOTO2/drive-capital-network/actions/workflows/ci.yml)

A command-line tool that reads Herbie's network file (partners, companies, employees, and contacts) and prints, for each company, the Drive Capital partner with the strongest relationship to it.

```console
$ ./analyze_network examples/input.txt
ACME: No current relationship
Globex: Chris (2)
Hooli: Molly (1)
```

> **For reviewers**
>
> - **Run it:** `pnpm install`, then `./analyze_network examples/input.txt` (Node 22.18+, no build step). `pnpm test` runs the tests.
> - **The core logic** is under 500 lines in [`src/core/`](./src/core/): [`parse.ts`](./src/core/parse.ts) → [`network.ts`](./src/core/network.ts) → [`analyze.ts`](./src/core/analyze.ts) → [`format.ts`](./src/core/format.ts). Everything else is the CLI around it.
> - **31 ready-made inputs** (happy paths, mistakes, awkward files) are in [`examples/scenarios/`](./examples/scenarios/), each with its expected output.
> - **The prompt** is kept verbatim in [`docs/prompt.md`](./docs/prompt.md). [How each requirement is met](#how-each-requirement-is-met) maps it to the code, interpretations are in [Assumptions and edge cases](#assumptions-and-edge-cases), and the bigger design choices are in [`docs/decisions/`](./docs/decisions/).

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Usage](#usage)
- [Development](#development)
- [Performance and stress testing](#performance-and-stress-testing)
- [Approach](#approach)
  - [How each requirement is met](#how-each-requirement-is-met)
- [Assumptions and edge cases](#assumptions-and-edge-cases)
- [Accessibility](#accessibility)
- [How I used LLMs](#how-i-used-llms)
- [What was challenging](#what-was-challenging)
- Further reading: [the prompt](./docs/prompt.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [ROADMAP.md](./ROADMAP.md), [decision records](./docs/decisions/), [CONTRIBUTING.md](./CONTRIBUTING.md), [CHANGELOG.md](./CHANGELOG.md)

## Features

**What the prompt asks for**

- Reads `Partner`, `Company`, `Employee`, and `Contact` commands from a file or STDIN.
- Prints every company alphabetically with its strongest partner, in exactly the prompt's format: `Globex: Chris (2)` or `ACME: No current relationship`.
- Accepts only the `email`, `call`, and `coffee` contact types.
- Streams the input line by line: a million contacts take about 2 seconds.

**Asking questions**

- `--company <name>` reports on specific companies (repeatable). A typo, a partial name (`Glob`), or the wrong case gets a hint, and when several companies match, all of them are listed instead of one being guessed.
- `--details` shows every partner's strength, not just the strongest.
- `--format json` gives a machine-readable report with the full ranking.
- `--stats` summarizes the input: lines read and skipped, partners, companies, employees, contacts by type, and skipped lines by reason. Text or JSON, counts only, never names.

**Handling bad input**

- Lenient by default: a bad line gets a warning, is skipped, and the rest of the report still prints. `--strict` stops at the first bad line instead.
- Compiler-style warnings: the line number, the line itself, and `^` markers under the words at fault.
- "Did you mean" hints for typos in keywords, contact types, declared names, `--company` names, options, and file names.
- Recognizes a `Contact` with the employee and partner swapped, and shows the corrected line.
- A full name where one word belongs (`Partner Chris Smith`) gets a hint that names are one word: `did you mean "Partner ChrisSmith"?`
- When a name is used before it's declared, points to the line that declares it.
- Stays readable on huge or broken files: the first 20 warnings are shown and the rest counted, long lines and names are cut down, and a file where nothing parses gets "Is this the right file?"
- Tolerates Windows and old Mac line endings, a byte order mark, tabs, extra spaces, a missing final newline, blank lines, and `#` comments.
- Clear errors for a missing file, a directory, or a permission problem. With no input it explains how to give some instead of waiting on the keyboard, and it exits quietly when piped into `head`.

**Output and accessibility**

- The report goes to stdout and everything else to stderr, so the output is always safe to pipe.
- Color only on a terminal, following `NO_COLOR`, `FORCE_COLOR`, and `--[no-]color`. Color is never the only signal, and information is never dimmed.
- `--plain` says everything in words for screen readers, ASCII only; it turns on automatically with `TERM=dumb`.
- `--quiet`, `--help`, `--version`, and documented exit codes: 0 success, 1 input problem, 2 usage or file error.

**Running it**

- `./analyze_network` runs the TypeScript source directly on Node 22.18+, with no build step.
- `pnpm build` compiles to `dist/`, and `pnpm link --global` puts `analyze-network` on your `PATH`.

**Quality**

- Tests at every level: unit tests per module, the CLI in process and as a real child process, 31 scenario files with hand-worked expected output plus a 12,000-line generated one, the prompt's own example read straight from [`docs/prompt.md`](./docs/prompt.md), and differential stress tests against an independent reference model.
- `pnpm -s stress` generates long, messy inputs along with the output they must produce.
- TypeScript 7 in strict mode, Zod as the only runtime dependency, oxlint with warnings as errors, and oxfmt.
- A pre-commit hook that lints, formats, and runs the tests; commitlint for Conventional Commits; and CI on Node 22.18 and 24.
- Docs kept in sync with the code: [ARCHITECTURE.md](./ARCHITECTURE.md), [ROADMAP.md](./ROADMAP.md), eight [decision records](./docs/decisions/), [CONTRIBUTING.md](./CONTRIBUTING.md), [CHANGELOG.md](./CHANGELOG.md), and a pull request template.

## Quick start

Requires **Node 22.18 or newer** and **pnpm 10**. CI tests Node 22.18 and 24; `.nvmrc` pins 24 for development (`nvm use`).

```bash
pnpm install
./analyze_network examples/input.txt          # from a file
cat examples/input.txt | ./analyze_network    # from STDIN
```

`./analyze_network` runs the TypeScript source directly (Node strips the types itself), so there's no build step. Other ways to run it:

| Command                                     | What it does                                                                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm build && node dist/cli/bin.js <file>` | Compiles to `dist/` and runs the compiled CLI                                                                                     |
| `pnpm -s analyze <file>`                    | Same as above, after `pnpm build`. Keep `-s`: without it, pnpm prints its own header lines into the output                        |
| `pnpm -s dev <file>`                        | Runs the source, like `./analyze_network`                                                                                         |
| `pnpm link --global`                        | Puts `analyze-network` on your `PATH`, as in the examples below (run `pnpm setup` once first if pnpm has no global bin directory) |

On Windows, use `node analyze_network examples/input.txt`.

## Usage

```text
analyze-network [options] [file]
cat file | analyze-network [options]
```

Input comes from `file`, or from STDIN when `file` is missing or `-`. The report goes to **stdout**, and warnings go to **stderr**, so the report stays clean when piped.

| Option                      | Description                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `-c`, `--company <name>`    | Only report this company. Repeat for more. Exits 1 if a name isn't in the input                                                        |
| `-d`, `--details`           | List every partner's strength, not just the strongest                                                                                  |
| `-f`, `--format text\|json` | Output format. `text` (default) is the format the prompt asks for                                                                      |
| `-s`, `--stats`             | Summarize the input on stderr: counts of everything declared, contacts by type, and skipped lines by reason. JSON with `--format json` |
| `--strict`                  | Stop at the first invalid line and exit 1, printing no report                                                                          |
| `-q`, `--quiet`             | Don't print warnings about skipped lines                                                                                               |
| `--color`, `--no-color`     | Force color on or off for warnings. By default color is on only when stderr is a terminal; `NO_COLOR=1` and `FORCE_COLOR=1` work too   |
| `--plain`                   | Screen-reader-friendly output: no color, no decoration, ASCII only. Automatic when `TERM=dumb`                                         |
| `-h`, `--help`              | Show help                                                                                                                              |
| `-v`, `--version`           | Show the version                                                                                                                       |

| Exit code | Meaning                                                                    |
| --------- | -------------------------------------------------------------------------- |
| `0`       | Report printed. Invalid lines, if any, were skipped with a warning         |
| `1`       | Invalid input with `--strict`, or a `--company` that isn't in the input    |
| `2`       | Bad options, unreadable file, or no input (e.g. run with nothing piped in) |

### Invalid input

By default a bad line is reported and skipped, and the rest of the file is still analyzed. Like a compiler error, each warning names the line, shows it, marks the words at fault, and suggests a fix where it can:

```console
$ analyze-network examples/edge-cases.txt
…
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

[`examples/edge-cases.txt`](./examples/edge-cases.txt) exercises the rules in the [edge-case table](#assumptions-and-edge-cases), and its expected output is in [`examples/edge-cases.expected.txt`](./examples/edge-cases.expected.txt). For one scenario per file, see [`examples/scenarios/`](./examples/scenarios/): 31 inputs covering happy paths, every kind of mistake, and awkward files (CRLF, byte order mark, tabs, no final newline), with a guide to what each shows.

### Asking about specific companies

`--company` answers the prompt's question "who is the person we know best at ACME?" directly, and `--details` shows the full ranking behind the answer:

```console
$ analyze-network --company Globex --details examples/input.txt
Globex: Chris (2), Molly (1)

$ analyze-network --company Globexx examples/input.txt
error: company "Globexx" isn't in the input (did you mean "Globex"?)

$ analyze-network --quiet --company Glob examples/scenarios/30-full-and-partial-names.txt
error: company "Glob" isn't in the input (did you mean "Globe" or "Globex"?)
```

### Stats

`--stats` summarizes what the file contains and what went wrong, without touching the report on stdout:

```console
$ analyze-network --stats --quiet examples/edge-cases.txt
stats:
  lines: 28 read, 15 commands, 11 skipped, 2 blank or comments
  partners: 4
  companies: 4 (2 with a relationship, 2 without)
  employees: 3
  contacts: 4 (1 email, 1 call, 2 coffee)
  skipped lines: 11
    undeclared name: 4
    unknown command: 2
    employee redeclared: 1
    invalid contact type: 1
    invalid name: 1
    swapped contact arguments: 1
    wrong word count: 1

ACME: Adam (1)
…
```

With `--format json`, the same summary is printed to stderr as JSON. Stats hold counts only, never names, so they're safe to log or share. [Decision record 0007](./docs/decisions/0007-usage-telemetry.md) explains how this would feed product analytics in a real deployment.

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

### Accessibility

- **Color is never the only signal.** Every message starts with a word (`error:`, `warning:`, `note:`), and color only reinforces it. Color is off when output isn't a terminal, with `NO_COLOR` set, or with `--no-color`.
- **Informational text is never dimmed**, since dim text is hard to read on many terminal themes. Only decoration (the `|` gutter) is dimmed.
- **`--plain` for screen readers.** The default warning layout draws a gutter and `^` markers, which a screen reader reads out as noise ("caret caret caret"). `--plain` says the same thing in words, uses ASCII only, and turns on automatically when `TERM=dumb`:

  ```console
  $ analyze-network --plain examples/edge-cases.txt
  warning: line 20: contact skipped: partner "Rezzan" hasn't been declared
    line 20 reads: Contact Peter Rezzan call
    word at fault: "Rezzan"
    note: "Rezzan" is declared later, on line 21; declarations must come before the lines that use them
  ```

- **Plain-language messages.** Every warning names the line and the value at fault in words and suggests a fix, so the markers are a convenience, not a requirement. `--help` and the exit codes are written the same way.

See [decision record 0008](./docs/decisions/0008-accessible-output.md).

## Development

| Command                                 | What it does                                                        |
| --------------------------------------- | ------------------------------------------------------------------- |
| `pnpm test`                             | Vitest unit and end-to-end tests                                    |
| `pnpm test:watch`                       | Tests in watch mode                                                 |
| `pnpm lint`                             | oxlint; warnings fail the run                                       |
| `pnpm format`                           | oxfmt, rewriting files in place                                     |
| `pnpm typecheck`                        | `tsc --noEmit`                                                      |
| `pnpm check`                            | Typecheck, lint, format check, and tests. CI runs exactly this      |
| `pnpm -s stress --contacts N --out DIR` | Writes a generated stress input and its expected output (see below) |

Git hooks install with `pnpm install`:

- **pre-commit** lints and formats the staged files (`oxlint --fix`, oxfmt), re-stages them, then runs the test suite. A lint error or a failing test blocks the commit.
- **commit-msg** runs commitlint, which rejects any message that isn't a [Conventional Commit](https://www.conventionalcommits.org/).

GitHub Actions runs `pnpm check` on every push to `main` and on every pull request. VS Code picks up the recommended extensions and format-on-save from `.vscode/`. [CONTRIBUTING.md](./CONTRIBUTING.md) has the full workflow.

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

Measured on an Apple Silicon laptop, Node 24. `test/scripts/stress.test.ts` runs the comparison on 25 seeds and on 200,000 contacts piped through the CLI, and [`examples/scenarios/90-stress-10k-contacts.txt`](./examples/scenarios/90-stress-10k-contacts.txt) is a committed 12,000-line sample.

The stress test found three real problems, all fixed: "did you mean" lookups made a file with 30,000 bad lines take 40 seconds (now 0.5), every skipped line was kept in memory (556 MB at a million contacts, now 295), and `node:readline` dropped lines when a stream delivered more than about a thousand lines in one chunk (replaced by `src/cli/lines.ts`).

## Approach

The program is a pipeline: read lines, parse each into a typed command, apply it to an in-memory network model, rank partners per company, and format the result.

```mermaid
flowchart LR
  input["input.txt or STDIN"] --> parse["Parse each line<br/>(Zod schemas)"]
  parse -->|valid command| network["Network model<br/>counts contacts per<br/>company and partner"]
  parse -->|invalid line| warnings["Warnings<br/>line skipped"]
  network -->|undeclared name,<br/>employee redeclared| warnings
  network --> rank["Rank partners<br/>per company"]
  rank --> format["Format<br/>text or JSON"]
  format --> stdout["stdout:<br/>the report"]
  warnings --> stderr["stderr:<br/>warnings, notes, --stats"]
```

The code is split into layers: constants and Zod schemas at the bottom, pure domain logic in `src/core/`, and all I/O in `src/cli/`. Tests mirror that layout. Nothing in `core` touches the filesystem or `process`, so every rule can be tested with plain strings. [ARCHITECTURE.md](./ARCHITECTURE.md) has the full module map.

### Design decisions

Each of these has a short decision record in [`docs/decisions/`](./docs/decisions/).

- **TypeScript on Node 22.18+.** It's the language I'm most fluent in. `tsc` builds to `dist/`, and `./analyze_network` runs the source directly through Node's built-in type stripping, so reviewers can skip the build.
- **Zod at the input boundary.** Command shapes are defined once as Zod schemas, and the TypeScript types are inferred from them, so compile-time types and runtime checks can't drift apart. Every line is validated before it reaches the network model. The CLI options use the same approach.
- **Count contacts as they're read.** Each `Contact` adds one to its company/partner pair immediately instead of being stored. Memory grows with the number of company/partner pairs, not the number of contacts, and ranking is a single pass. The cost is that per-contact detail (type, employee) isn't kept; [ROADMAP.md](./ROADMAP.md) covers when that would change.
- **Lenient by default, strict on request.** The prompt says input is well formed, but a real data feed won't always be. One bad line shouldn't hide the answer for every other company, so the tool warns and keeps going. `--strict` is there for pipelines that would rather fail.
- **Deterministic output.** Ties and sort order follow fixed rules (below), so the same input always gives the same output.
- **A CLI, not a web UI.** The input is a file and the output is a few lines of text that people will pipe, diff, and script. A web front end would add a server, a build, and a second way to run the code without making the answer clearer. The effort went into the command line instead: helpful errors, `--help`, exit codes, JSON output, and color that turns itself off when piped.

### How each requirement is met

| Requirement in [the prompt](./docs/prompt.md)                                          | Where                                                                                                                                                                              |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Four commands, one per line, of space-separated words made of letters                  | `COMMAND_SYNTAX` and `NAME_PATTERN` in [`src/constants.ts`](./src/constants.ts), checked by [`src/core/parse.ts`](./src/core/parse.ts) and the Zod schemas                         |
| An employee works at a previously declared company; employee names are globally unique | [`src/core/network.ts`](./src/core/network.ts): an undeclared company or a second company for the same employee is a warning                                                       |
| Only accept the contact types `email`, `call`, `coffee`                                | `CONTACT_TYPES` in [`src/constants.ts`](./src/constants.ts); anything else is rejected with a warning                                                                              |
| Run from the command line, with a file name or STDIN                                   | `./analyze_network input.txt` or `cat input.txt \| ./analyze_network` ([Quick start](#quick-start))                                                                                |
| Print the output to the console                                                        | The report goes to stdout; warnings go to stderr so they never mix into it                                                                                                         |
| All companies, sorted alphabetically                                                   | `rankRelationships` in [`src/core/analyze.ts`](./src/core/analyze.ts), ordered by `compareNames`                                                                                   |
| Strength is the total contacts between a partner and all of a company's employees      | Counted per company and partner as contacts are read, in [`src/core/network.ts`](./src/core/network.ts)                                                                            |
| `<CompanyName>: <PartnerName> (<RelationshipStrength>)` or `No current relationship`   | `formatLine` in [`src/core/format.ts`](./src/core/format.ts)                                                                                                                       |
| The example input gives the example output                                             | [`test/docs/prompt.test.ts`](./test/docs/prompt.test.ts) runs the example straight from `docs/prompt.md`, comment line included                                                    |
| README: build, run, and test; approach; LLM use; assumptions; what was challenging     | [Quick start](#quick-start), [Approach](#approach), [How I used LLMs](#how-i-used-llms), [Assumptions](#assumptions-and-edge-cases), [What was challenging](#what-was-challenging) |

## Assumptions and edge cases

| Case                                                                                                     | Behavior                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What counts as a letter                                                                                  | `A`–`Z` and `a`–`z` only. "Upper- and lowercase characters A thru z" reads as the letters, not the ASCII range from `A` to `z`, which also contains `[`, `\`, `]`, `^`, `_`, and `` ` ``. Accented letters (`Zoë`) and digits are rejected with a warning. |
| Two partners tie for strongest                                                                           | The alphabetically first partner wins. The prompt doesn't say; I picked a deterministic rule.                                                                                                                                                              |
| Company sort order                                                                                       | Case-insensitive alphabetical, with an ordinal tiebreak. Matches the example (`ACME`, `Globex`, `Hooli`).                                                                                                                                                  |
| Contact type other than `email`, `call`, `coffee`                                                        | Rejected with a warning ("should only accept" those three).                                                                                                                                                                                                |
| Contact type weighting                                                                                   | None. Every contact counts as 1, since strength is the "total amount of Contacts".                                                                                                                                                                         |
| Contact names an undeclared employee or partner                                                          | Warning, line skipped. Commands are processed in order, so a contact can't refer forward to a later declaration. If the name is declared further down, the warning says on which line, since moving it up is the usual fix.                                |
| Employee names an undeclared company                                                                     | Warning, line skipped. The prompt says this won't happen; the check is cheap.                                                                                                                                                                              |
| Same partner or company declared twice                                                                   | Ignored, no warning.                                                                                                                                                                                                                                       |
| Employee declared again at a different company                                                           | Warning, first declaration kept (employee names are globally unique).                                                                                                                                                                                      |
| Identical `Contact` lines repeated                                                                       | Each one counts. They're separate interactions.                                                                                                                                                                                                            |
| Blank lines, Windows line endings, extra spaces or tabs                                                  | Tolerated.                                                                                                                                                                                                                                                 |
| No newline at the end of the file                                                                        | Tolerated.                                                                                                                                                                                                                                                 |
| Old Mac line endings (a lone `\r`)                                                                       | Treated as line breaks, like `\n` and `\r\n`.                                                                                                                                                                                                              |
| Lines starting with `#`                                                                                  | Skipped as comments. The prompt says real input won't have them, but its example does, so pasting the example as-is works.                                                                                                                                 |
| UTF-8 byte order mark at the start of the file                                                           | Stripped. Some Windows editors add one.                                                                                                                                                                                                                    |
| Typo or wrong case in a keyword or contact type (`Contcat`, `partner`, `cofee`)                          | Rejected, since the prompt defines exact words, but the warning suggests the fix: `did you mean "Contact"?`                                                                                                                                                |
| Undeclared name close to a declared one (`Lauri` vs `Laurie`)                                            | Warning, line skipped, with `did you mean "Laurie"?`                                                                                                                                                                                                       |
| Employee and partner swapped in a `Contact`                                                              | Warning, line skipped, showing the corrected line                                                                                                                                                                                                          |
| Unknown command, wrong number of words, non-letter characters                                            | Warning, line skipped. The warning lists the valid commands or shows the expected usage.                                                                                                                                                                   |
| A full name where one word belongs (`Partner Chris Smith`)                                               | Warning, line skipped. For `Partner` and `Company`, the warning suggests the name as one word (`ChrisSmith`). Not for `Employee` or `Contact`, where an extra word might not be part of a name.                                                            |
| `--company` name that matches several companies (`Glob`, or `acme` with both `ACME` and `Acme` declared) | Exit 1, listing every match: `did you mean "Globe" or "Globex"?`. The tool never picks one, since a script would silently get the wrong company's answer. It also doesn't stop to ask, which would hang scripts and pipes.                                 |
| Partner with no contacts                                                                                 | Never appears in the output.                                                                                                                                                                                                                               |
| Same name used for a partner and an employee                                                             | Allowed. Partners and employees are separate namespaces.                                                                                                                                                                                                   |
| Empty input, or no companies declared                                                                    | Empty report, plus a note on stderr explaining why.                                                                                                                                                                                                        |
| No line in the file is a valid command                                                                   | Warnings, plus a note asking whether it's the right file.                                                                                                                                                                                                  |
| Thousands of invalid lines                                                                               | The first 20 warnings are shown, then "…and N more", so a wrong file doesn't flood the terminal.                                                                                                                                                           |
| Run with no file and nothing piped in                                                                    | Exits 2 with a usage hint instead of silently waiting for keyboard input.                                                                                                                                                                                  |
| Output piped into a command that exits early (`\| head -1`)                                              | Exits quietly with code 0 instead of printing a stack trace.                                                                                                                                                                                               |
| Large input                                                                                              | Streamed line by line. A million contacts (1.2 million lines, 46 MB) with 150,000 bad lines runs in about 2 seconds and 300 MB. See [Performance and stress testing](#performance-and-stress-testing).                                                     |

## How I used LLMs

I used Claude Code throughout, and treated its output like a teammate's work: plan first, then tests, git hooks, and CI on every change.

- **Planning:** I gave it the prompt and asked for a plan before any code. It proposed the pipeline, the data model, and the edge-case rules above (ties, lenient error handling, counting at ingest), and I approved the plan before any code was written.
- **Tooling:** it set up TypeScript, oxlint, oxfmt, Vitest, husky, commitlint, and CI. When it was unsure of current versions or options, it checked the installed packages' schemas and the official docs, and it tested that each hook actually blocks a bad commit.
- **Code and tests:** it implemented each roadmap phase as small Conventional Commits, writing tests alongside the code. I directed the work and steered it along the way: the folder layout, splitting out schemas and constants, Zod for validation, rewriting dense code (the edit-distance function) to read plainly, and pushing on user experience, accessibility, and analytics.
- **Product questions:** I used it as a sounding board, not just a code generator. When I asked about a web UI, it argued for putting the effort into the CLI instead. When I asked for analytics, it pointed out that sending usage data from a tool full of people's names would be a privacy problem, so we built local `--stats` and wrote down how opt-in telemetry would work instead. I agreed with both calls.
- **Verification:** it checked its own claims instead of asserting them. Node 22 support was proven by running the full test suite under Node 22 via `npx`, not assumed, and each feature was run against the example files before being committed.
- **Where it slipped:** a couple of times, a script that edited the docs stopped partway and the commit went in with half-updated docs, once leaving a stray `\1` in a table. It caught both on review and amended the commits before anything was pushed. That's the reason docs and code are now checked together on every commit.
- **Docs:** it drafted this README, ARCHITECTURE.md, ROADMAP.md, and the decision records. A rule in [CLAUDE.md](./CLAUDE.md) requires them to change in the same commit as the code they describe, which kept them accurate as the design changed.

## What was challenging

- **Reading between the lines of the spec.** Most of the work was deciding what to do where the prompt is silent: ties, forward references, bad contact types, the `#` comment in the example. I treated each one as a product decision, picked something deterministic, and wrote it down instead of guessing silently.
- **Leniency versus correctness.** Skipping bad lines is friendlier, but silently wrong output is worse than a crash. The answer was to stay lenient and make every skip visible (line number, the line itself, a summary), and to add `--strict` for callers that would rather fail.
- **Good error messages from a schema library.** Zod's default messages are written for developers. Getting from a generic enum error to `contact type "Coffee" is not valid (did you mean "coffee"?)` meant checking structure (keyword, word count) before Zod, and customizing Zod's messages for the rest.
- **Analytics without surveillance.** Usage data would make the tool better, but the input is people's names and who talked to whom. The answer was to give users the numbers locally (`--stats`, counts only, never names) and to write down the rules opt-in telemetry would have to follow before anyone builds it.
- **Compiler-style output versus screen readers.** The `^` markers and gutter that make warnings easy to scan visually are noise to a screen reader. Instead of dropping them, `--plain` says the same thing in sentences and turns on automatically for dumb terminals.
- **New tooling.** TypeScript 7, oxlint, and oxfmt are recent, so some common advice didn't apply. For example, VS Code's `typescript.tsdk` setting doesn't work with TypeScript 7. Each config was checked against the installed version instead of copied from older examples.

See [ROADMAP.md](./ROADMAP.md) for what I'd build next.
