# Architecture

> Keep this file in sync with `src/`. If a module, type, or rule below no longer matches the code, update this file in the same commit. Modules marked _(planned)_ don't exist yet.

## Folder structure

```
src/
├── constants.ts        all constants: name pattern, contact types, keyword syntax, output text
├── schemas/            Zod schemas; TypeScript types are inferred from them
│   └── command.ts
├── core/               pure domain logic, no I/O
│   ├── parse.ts        line → command | error | skip
│   ├── network.ts      Network model, contacts counted at ingest
│   ├── analyze.ts      (planned) rank partners per company
│   ├── format.ts       (planned) text and JSON reports
│   └── pipeline.ts     (planned) lines → relationships + diagnostics
├── cli/                the only layer that touches process, files, and streams
│   └── main.ts         (planned) entry point and `bin`
└── utils/
    └── text.ts         small string helpers (list joining, case hints)
test/                   mirrors src/ one-to-one (test/core/parse.test.ts, …)
examples/               sample input from the prompt and its expected output
```

Dependencies point one way: `cli → core → schemas → constants`, and every layer may use `utils`. `core` never imports from `cli`, so the whole domain can be tested without touching the filesystem.

## Data flow

```
input (file or STDIN)
  → read one line at a time                   cli/main.ts
  → parseLine(line) → ok | error | skip       core/parse.ts
  → network.apply(command) → warning?         core/network.ts
  → rank partners per company                 core/analyze.ts
  → render the report                         core/format.ts
  → stdout (report), stderr (warnings)        cli/main.ts
```

`core/pipeline.ts` wires the core stages together. `cli/` is the only layer that does I/O: it resolves the input source, streams lines into the pipeline, writes the results, and sets the exit code.

## Modules

| File                     | Responsibility                                                                                                                                                                                                                                                   | Status      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `src/constants.ts`       | `NAME_PATTERN`, `CONTACT_TYPES`, `COMMAND_KINDS`, `COMMAND_SYNTAX` (keyword → fields and usage string), `KEYWORDS`, the byte order mark, the comment prefix, and the `No current relationship` text                                                              | done        |
| `src/schemas/command.ts` | Zod schemas for the four commands and `ContactType`. The `Command` union is inferred with `z.infer`, so types and runtime checks can't drift apart. Custom error messages turn Zod issues into plain-English warnings                                            | done        |
| `src/core/parse.ts`      | `parseLine(line)` → `{ status: 'ok', command }`, `{ status: 'error', message }`, or `{ status: 'skip' }` for blank and `#` comment lines. Checks the keyword and word count itself (so it can show the usage), then validates with `CommandSchema`. Never throws | done        |
| `src/core/network.ts`    | `Network` class. `apply(command)` updates the model in input order and returns a warning string when a command refers to something undeclared or contradicts an earlier declaration. Exposes `companies` and `strengthsFor(company)`                             | done        |
| `src/core/analyze.ts`    | Ranks partners for each company, with companies sorted                                                                                                                                                                                                           | _(planned)_ |
| `src/core/format.ts`     | Renders the `<Company>: <Partner> (<n>)` / `No current relationship` report                                                                                                                                                                                      | _(planned)_ |
| `src/core/pipeline.ts`   | Wires parse → network → analyze; collects warnings with line numbers                                                                                                                                                                                             | _(planned)_ |
| `src/cli/main.ts`        | argv handling, file vs. STDIN, stdout/stderr, exit codes                                                                                                                                                                                                         | _(planned)_ |
| `src/utils/text.ts`      | `formatList` (`a, b, or c`) and `findCaseMismatch` (powers the "did you mean" hints)                                                                                                                                                                             | done        |

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

Keywords and contact types are case-sensitive, as the prompt writes them. A near miss such as `partner` or `Coffee` is still rejected, but the warning suggests the correct spelling.

## Rules

- **Strongest partner:** highest count; ties go to the alphabetically first partner name.
- **Company order:** case-insensitive alphabetical, then ordinal comparison as a tiebreak so the order is fully deterministic.
- **Processing order:** commands apply in input order. A contact that refers to an employee or partner not yet declared is a warning, not a forward reference.

## Error handling

| Situation                                      | Behavior                                      | Exit code |
| ---------------------------------------------- | --------------------------------------------- | --------- |
| Malformed or invalid line                      | Warning on stderr (`line N: …`), line skipped | 0         |
| Unknown reference (employee, partner, company) | Warning on stderr, line skipped               | 0         |
| File not found or unreadable                   | Error on stderr, no report                    | 1         |
| Bad usage (too many arguments)                 | Usage on stderr                               | 1         |

The stdout report never contains warnings, so `analyze-network file | …` stays safe to pipe.

## Complexity

With L lines, C companies, and P partner/company pairs that have at least one contact:

- Ingest: O(L) time.
- Analysis: O(C log C + P).
- Memory: O(partners + companies + employees + P). Input is streamed, never held whole.

## Tooling

- **TypeScript 7** (`tsconfig.json`): the `@tsconfig/node24` base (ES2024, `nodenext`) plus the Total TypeScript strictness set: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`. `erasableSyntaxOnly` keeps `node src/cli/main.ts` working through Node's type stripping, so no enums or namespaces, and imports use `.ts` extensions that `tsc` rewrites to `.js`.
- **Zod 4** validates parsed commands. It's the only runtime dependency. Zod's error messages are customized so a bad line reads as plain English, e.g. `contact type "Coffee" is not valid (did you mean "coffee"?)`.
- **Vitest** for unit tests in `test/`.
- **oxlint** (`.oxlintrc.json`): `correctness` rules are errors; `suspicious` and `perf` are warnings. Plugins: eslint, typescript, unicorn, oxc, import, node, promise, vitest. Extra rules: `eqeqeq`, `consistent-type-imports`, `no-explicit-any`, `prefer-node-protocol`, `import/no-cycle`, and no focused tests. `pnpm lint` runs with `--deny-warnings`, so any warning fails `pnpm check`. Type-aware rules such as `no-floating-promises` would need `oxlint-tsgolint`, which isn't installed.
- **oxfmt** (`.oxfmtrc.json`): Prettier-compatible settings at an 80-column width, LF line endings, sorted imports, and sorted `package.json`.
- **pnpm** as the package manager.
