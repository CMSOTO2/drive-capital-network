# Architecture

> Keep this file in sync with `src/`. If a module, type, or rule below no longer matches the code, update this file in the same commit. Modules marked _(planned)_ don't exist yet.

## Data flow

```
input (file or STDIN)
  → readline, one line at a time            cli.ts
  → parseLine(line) → Command | ParseError  parse.ts
  → network.apply(command) → warnings       network.ts
  → strongestRelationships(network)         analyze.ts
  → formatReport(results)                   format.ts
  → stdout (report), stderr (warnings)      cli.ts
```

`run.ts` wires these stages together and returns `{ output, warnings }`. `cli.ts` is the only module that does I/O: it resolves the input source, streams lines into `run`, writes the results, and sets the exit code. Every other module is pure, so tests call it directly with strings and plain objects.

## Modules

| File              | Responsibility                                                                                                                                                                            | Status      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `src/commands.ts` | `Command` discriminated union (`partner`, `company`, `employee`, `contact`) and `ContactType = "email" \| "call" \| "coffee"`                                                             | _(planned)_ |
| `src/parse.ts`    | `parseLine(line)`: splits on whitespace, validates the command name, word count, `[A-Za-z]+` names, and the contact type. Returns a `Command`, a `ParseError`, or `null` for a blank line | _(planned)_ |
| `src/network.ts`  | `Network` class: holds the declared entities and the relationship counts; `apply(command)` returns any warnings                                                                           | _(planned)_ |
| `src/analyze.ts`  | `strongestRelationships(network)` → `CompanyRelationship[]`, sorted by company                                                                                                            | _(planned)_ |
| `src/format.ts`   | `formatLine` / `formatReport`: produce the `<Company>: <Partner> (<n>)` and `No current relationship` lines                                                                               | _(planned)_ |
| `src/run.ts`      | Wires parse → network → analyze → format; collects warnings with line numbers                                                                                                             | _(planned)_ |
| `src/cli.ts`      | argv handling, file vs. STDIN, stdout/stderr, exit codes                                                                                                                                  | _(planned)_ |

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

- **TypeScript 7** (`tsconfig.json`): the `@tsconfig/node24` base (ES2024, `nodenext`) plus the Total TypeScript strictness set: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`. `erasableSyntaxOnly` keeps `node src/cli.ts` working through Node's type stripping, so no enums or namespaces, and imports use `.ts` extensions that `tsc` rewrites to `.js`.
- **Vitest** for unit tests in `test/`.
- **oxlint** (`.oxlintrc.json`): `correctness` rules are errors; `suspicious` and `perf` are warnings. Plugins: eslint, typescript, unicorn, oxc, import, node, promise, vitest. Extra rules: `eqeqeq`, `consistent-type-imports`, `no-explicit-any`, `prefer-node-protocol`, `import/no-cycle`, and no focused tests. `pnpm lint` runs with `--deny-warnings`, so any warning fails `pnpm check`. Type-aware rules such as `no-floating-promises` would need `oxlint-tsgolint`, which isn't installed.
- **oxfmt** (`.oxfmtrc.json`): Prettier-compatible settings at an 80-column width, LF line endings, sorted imports, and sorted `package.json`.
- **pnpm** as the package manager.
