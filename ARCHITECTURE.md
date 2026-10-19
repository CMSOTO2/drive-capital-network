# Architecture

> Keep this file in sync with `src/`. If a module, type, or rule below no longer matches the code, update it in the same commit. The reasoning behind the bigger choices is in [`docs/decisions/`](./docs/decisions/).

## Folder structure

```text
src/
├── constants.ts        every constant: name pattern, contact types, keyword syntax, exit codes, limits
├── schemas/            Zod schemas; TypeScript types are inferred from them
│   ├── command.ts      the four input commands
│   └── options.ts      validated command-line options
├── core/               pure domain logic, no I/O
│   ├── parse.ts        line → command | error | skip
│   ├── network.ts      Network model, contacts counted at ingest
│   ├── analyze.ts      rank partners per company
│   ├── format.ts       text and JSON reports
│   ├── stats.ts        --stats summary (counts only)
│   └── pipeline.ts     lines → report + diagnostics
├── cli/                the only layer that touches process, files, and streams
│   ├── bin.ts          entry point for the `analyze-network` command
│   ├── main.ts         `main(io)`: reads input, writes output, returns the exit code
│   ├── args.ts         argv → validated options
│   ├── help.ts         --help text
│   └── render.ts       warnings, notes, and color
└── utils/
    ├── suggest.ts      "did you mean" suggestions (edit distance)
    └── text.ts         small string helpers (list joining, name order)
analyze_network         runs src/cli/main.ts from source, no build (Node type stripping)
test/                   mirrors src/ (test/core/parse.test.ts, …), plus helpers/
examples/               the prompt's example and an edge-case file, each with expected output
docs/decisions/         architecture decision records
```

Dependencies point one way: `cli → core → schemas → constants`, and any layer may use `utils`. `core` never imports from `cli`, so the whole domain can be tested without touching the filesystem.

## Data flow

```text
input (file or STDIN)
  → read one line at a time                   cli/main.ts (node:readline)
  → parseLine(line) → ok | error | skip       core/parse.ts
  → network.apply(command) → problem?         core/network.ts
  → rankRelationships(network)                core/analyze.ts
  → formatTextReport / formatJsonReport       core/format.ts
  → stdout (report), stderr (diagnostics)     cli/main.ts, cli/render.ts
```

`core/pipeline.ts` runs parse → network → analyze over any iterable of lines and returns the report plus a `Diagnostic` for every skipped line: the line number, the line's text, the message, a `reason` code, the positions of the words at fault, and any notes found later in the file. It accepts an async iterable, so the CLI streams a file of any size through it, and tests pass a plain array.

## Modules

| File                     | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/constants.ts`       | `NAME_PATTERN`, `CONTACT_TYPES`, `COMMAND_KINDS`, `COMMAND_SYNTAX` (keyword → fields and usage string), `KEYWORDS`, the byte order mark, the comment prefix, the `No current relationship` text, `OUTPUT_FORMATS`, `EXIT_CODES` (`ok`, `inputProblem`, `usage`), `SKIP_REASONS` (reason code → label), `MAX_PRINTED_DIAGNOSTICS`, and `STDIN_ARG`                                                                                         |
| `src/schemas/command.ts` | Zod schemas for the four commands and `ContactType`. The `Command` union is inferred with `z.infer`, so types and runtime checks can't drift apart. Custom error messages turn Zod issues into plain-English warnings                                                                                                                                                                                                                     |
| `src/schemas/options.ts` | `CliOptionsSchema`: defaults for every flag, `--format` limited to `text` or `json`, `--company` names checked with the same letters-only rule as the input, and a non-empty file path                                                                                                                                                                                                                                                    |
| `src/core/parse.ts`      | `parseLine(line)` → `{ status: 'ok', command }`, `{ status: 'error', message, words }`, or `{ status: 'skip' }` for blank and `#` comment lines. `words` holds the positions of the words at fault. Checks the keyword and word count itself (so it can show the usage), then validates with `CommandSchema`. Never throws. `wordPositionOf(kind, field)` maps a command field to its word on the line                                    |
| `src/core/network.ts`    | `Network` class. `apply(command)` updates the model in input order and returns a `Problem` when a command refers to something undeclared or contradicts an earlier declaration: a message (with a "did you mean" hint where one fits), the `fields` at fault, and the `undeclared` names. Exposes `companies` and `strengthsFor(company)`. `counts` reports partners, companies, companies with contacts, employees, and contacts by type |
| `src/core/analyze.ts`    | `rankRelationships(network)` → `CompanyRelationships[]`: companies sorted by name, each with every partner who has contact, strongest first. `strongestPartner` picks the first. Keeping the full ranking costs little and powers `--format json`. `selectCompanies(report, names)` narrows the report for `--company` and lists missing names with a suggestion                                                                          |
| `src/core/format.ts`     | `formatLine` and `formatTextReport` render the prompt's `<Company>: <Partner> (<n>)` / `No current relationship` lines. `formatJsonReport` renders the same data as JSON: `company`, `partner` (or `null`), `strength`, and the full `partners` ranking. With `{ details: true }`, text lines list every partner: `Globex: Chris (2), Molly (1)`                                                                                          |
| `src/core/stats.ts`      | `summarize(result)` → `RunStats`: lines read, commands, skipped, and ignored; partners, companies (with and without a relationship), employees; contacts by type; skipped lines per reason, most common first. Counts only, never names                                                                                                                                                                                                   |
| `src/core/pipeline.ts`   | `analyzeLines(lines, { strict })` → `{ report, diagnostics, commandCount, aborted }`. Keeps diagnostics that are waiting on an undeclared name; when that name is declared later, it adds a note with the line number. With `strict`, stops at the first diagnostic and returns an empty report. Also returns `lineCount`, `ignoredLineCount`, and the network's `counts` for `--stats`                                                   |
| `src/cli/bin.ts`         | The `bin` entry point: calls `runFromProcess()`. Kept apart from `main.ts` so importing `main.ts` never starts the CLI                                                                                                                                                                                                                                                                                                                    |
| `src/cli/main.ts`        | `main(io)`: the whole CLI as a function of injected streams, argv, and env, returning an exit code. Opens the input (checking for a missing file, a directory, or a permission problem first), streams it through the pipeline, and writes the report and diagnostics. `runFromProcess()` wires in the real `process` and exits quietly on `EPIPE`                                                                                        |
| `src/cli/args.ts`        | `parseCliArgs(argv)`: tokenizes with `node:util` `parseArgs`, shortens Node's error messages, rejects extra positional arguments, and validates with `CliOptionsSchema`                                                                                                                                                                                                                                                                   |
| `src/cli/help.ts`        | The `--help` text, built from `COMMAND_SYNTAX`, `OUTPUT_FORMATS`, and `EXIT_CODES` so it can't fall out of date                                                                                                                                                                                                                                                                                                                           |
| `src/cli/render.ts`      | Compiler-style diagnostics: `warning: line N: …`, the line itself, a row of `^` under the words at fault (`underlineWords`), and `= note:` lines. Also the summary notes, the `MAX_PRINTED_DIAGNOSTICS` cap, and color via `node:util` `styleText`. `shouldUseColor` honors `--color`/`--no-color`, `NO_COLOR`, `FORCE_COLOR`, and whether stderr is a terminal. `renderStats` prints the `--stats` summary                               |
| `src/utils/suggest.ts`   | `suggest(word, candidates)` finds the closest candidate for a "did you mean" hint, ignoring case and allowing 0, 1, or 2 edits depending on word length (`SUGGESTION_EDIT_LIMITS`). `editDistance` counts insertions, deletions, replacements, and swapped neighbours. `didYouMean` formats the hint                                                                                                                                      |
| `src/utils/text.ts`      | `formatList` (`a or b`, `a, b, or c`) and `compareNames` (case-insensitive order with a code-unit tiebreak)                                                                                                                                                                                                                                                                                                                               |

## Data model

```ts
partners: Set<string>;
companies: Set<string>;
employeeCompany: Map<employee, company>; // employee names are globally unique
strength: Map<company, Map<partner, number>>; // contacts per company/partner pair
```

A `Contact Laurie Chris email` looks up `employeeCompany.get("Laurie")` → `Globex` and increments `strength[Globex][Chris]`.

### Why count at ingest

- Analysis becomes one pass over the counts, with no join between contacts and employees.
- Memory is O(companies × partners that contacted them) instead of O(contacts). Contacts are by far the largest part of a real network file.
- **Cost:** the per-contact detail (which employee, which type) is gone once counted. That's fine for this question. Questions like "who at ACME do we know?" or weighted contact types would need a raw contact log next to the counts (see ROADMAP).

## Validation

Parsing happens in two steps. `parse.ts` first checks the structure: is the first word a known keyword, and is the word count right? Those errors need the usage string, which Zod doesn't know about. Then the words go through `CommandSchema`, a Zod discriminated union, which checks that names are letters only and that the contact type is one of the three allowed values. All issues on a line are reported together, not only the first one.

Keywords and contact types are case-sensitive, as the prompt writes them. A near miss is still rejected, but the warning suggests the likely fix.

## Hints

Every warning tries to say how to fix the line, not just what's wrong with it, and marks the words at fault with `^`:

| Mistake                                                               | Example                                        | Hint                                     |
| --------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| Keyword typo or wrong case                                            | `Contcat`, `partner`                           | `did you mean "Contact"?`                |
| Contact type typo or wrong case                                       | `cofee`, `Coffee`                              | `did you mean "coffee"?`                 |
| Undeclared employee, partner, or company with a similar declared name | `Lauri`, `Chriss`, `Globexx`                   | `did you mean "Laurie"?`                 |
| Employee and partner swapped in a `Contact`                           | `Contact Chris Sarah call`                     | `the order is Contact Sarah Chris call`  |
| Name used before its declaration                                      | `Contact Peter Rezzan call` … `Partner Rezzan` | `"Rezzan" is declared later, on line 21` |
| Unknown keyword with no close match                                   | `Investor`                                     | lists the four valid commands            |
| Wrong number of words                                                 | `Employee Bob`                                 | shows the command's usage                |

Suggestions use `suggest` in `src/utils/suggest.ts`: case is ignored, and the allowed number of edits grows with word length (none for 1–2 letters, one for 3–4, two for longer words), so short names don't get unrelated suggestions.

## Rules

- **Strongest partner:** highest count; ties go to the alphabetically first partner name (same order as companies). Partners with no contact with a company aren't ranked for it.
- **Company order:** case-insensitive alphabetical, then ordinal comparison as a tiebreak so the order is fully deterministic.
- **Processing order:** commands apply in input order. A contact that refers to an employee or partner not yet declared is a warning, not a forward reference.

## Error handling

| Situation                                       | Behavior                                                                                                                      | Exit code |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------- |
| Malformed or invalid line                       | `warning: line N: …` and the line itself on stderr; line skipped                                                              | 0         |
| Unknown reference (employee, partner, company)  | Same as above                                                                                                                 | 0         |
| Any invalid line with `--strict`                | `error: line N: …` on stderr; stops reading; no report                                                                        | 1         |
| Empty input or no companies                     | Empty report, `note:` on stderr explaining why                                                                                | 0         |
| No line was a valid command                     | Warnings plus a note asking whether it's the right file                                                                       | 0         |
| More than 20 invalid lines                      | First 20 shown, then `…and N more warnings`                                                                                   | 0         |
| `--company` name not in the input               | `error: company "…" isn't in the input`, with a suggestion when one is close; the companies that were found are still printed | 1         |
| File missing, a directory, or unreadable        | `error: cannot read "…": no such file` (or `it is a directory`, `permission denied`)                                          | 2         |
| Unknown option, bad `--format`, extra arguments | `error: …` plus a pointer to `--help`                                                                                         | 2         |
| No file and STDIN is a terminal                 | `error: no input …` instead of waiting for keyboard input                                                                     | 2         |
| stdout closed early (`\| head -1`)              | Exits quietly                                                                                                                 | 0         |

The stdout report never contains diagnostics or color codes, so `analyze-network file | …` is always safe to pipe. Warnings are colored only when stderr is a terminal, unless `NO_COLOR`, `FORCE_COLOR`, or `--[no-]color` says otherwise.

## Testing

| Level           | Where                                                     | What it covers                                                                                                           |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Unit            | `test/core/`, `test/schemas/`, `test/utils/`              | Each rule in isolation with plain values                                                                                 |
| CLI, in process | `test/cli/main.test.ts`, `args.test.ts`, `render.test.ts` | `main(io)` with fake streams: golden output for both examples, STDIN, CRLF, every exit code, formats, color, file errors |
| End to end      | `test/cli/e2e.test.ts`                                    | `src/cli/bin.ts` and `./analyze_network` in a child process: real pipes and process exit codes                           |

The golden tests compare against `examples/*.expected.txt`, the same files a reviewer would use by hand.

## Complexity

With L lines, C companies, and P partner/company pairs that have at least one contact:

- Ingest: O(L) time.
- Analysis: O(C log C + P log P), from sorting companies and ranking each company's partners.
- Memory: O(partners + companies + employees + P). Input is streamed, never held whole.
- Hints: a "did you mean" lookup scans the declared names of one kind, skipping any whose length is too different, so it costs O(names) per invalid reference and nothing for valid lines.

## Tooling

- **TypeScript 7** (`tsconfig.json`): the `@tsconfig/node24` base (ES2024, `nodenext`) plus the Total TypeScript strictness set: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`. `erasableSyntaxOnly` keeps `./analyze_network` and `node src/cli/bin.ts` working through Node's type stripping, so no enums or namespaces, and imports use `.ts` extensions that `tsc` rewrites to `.js`.
- **Zod 4** validates parsed commands and CLI options. It's the only runtime dependency; argument parsing (`parseArgs`), line reading (`readline`), and color (`styleText`) come from Node itself. Zod's error messages are customized so a bad line reads as plain English, e.g. `contact type "Coffee" is not valid (did you mean "coffee"?)`.
- **Vitest** for unit, in-process CLI, and end-to-end tests in `test/`.
- **oxlint** (`.oxlintrc.json`): `correctness` rules are errors; `suspicious` and `perf` are warnings. Plugins: eslint, typescript, unicorn, oxc, import, node, promise, vitest. Extra rules: `eqeqeq`, `consistent-type-imports`, `no-explicit-any`, `prefer-node-protocol`, `import/no-cycle`, and no focused tests. `pnpm lint` runs with `--deny-warnings`, so any warning fails `pnpm check`. Type-aware rules such as `no-floating-promises` would need `oxlint-tsgolint`, which isn't installed.
- **oxfmt** (`.oxfmtrc.json`): Prettier-compatible settings at an 80-column width, LF line endings, sorted imports, and sorted `package.json`.
- **pnpm** as the package manager.
