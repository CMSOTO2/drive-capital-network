# Scenarios

Input files covering the happy paths, the mistakes the tool should catch, and inputs that are awkward to parse. Each `<name>.txt` has a `<name>.expected.txt` with the exact stdout, and every scenario exits 0 (warnings go to stderr). `test/cli/scenarios.test.ts` runs them all.

Try any of them:

```bash
./analyze_network examples/scenarios/22-undeclared-names.txt
```

The expected outputs were worked out by hand from the rules in the main README (or, for the stress file, by an independent reference model), not copied from the tool's output, so the tests check the behaviour rather than repeat it.

## Happy paths

| File                                   | What it shows                                                                                  | Also try                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------- |
| `01-prompt-example`                    | The example from the prompt                                                                    | `--format json`, `--stats`       |
| `02-single-contact`                    | The smallest useful network                                                                    |                                  |
| `03-strength-across-employees`         | Strength adds up contacts with every employee of a company (Chris 3, Molly 2)                  | `--details`                      |
| `04-tie-goes-alphabetical`             | Adam and Zoe tie at 2; Adam wins alphabetically                                                | `--details`                      |
| `05-mixed-case-sorting`                | `ACME`, `acme`, `apple`, `Beta`, `zeta`: case-insensitive order, uppercase first on exact ties |                                  |
| `06-no-contacts`                       | Every company prints `No current relationship`                                                 |                                  |
| `07-duplicates`                        | Repeated declarations are harmless; repeated contacts each count                               |                                  |
| `08-contact-types-count-equally`       | Three emails and calls beat two coffees: types aren't weighted                                 | `--stats`                        |
| `09-partner-and-employee-share-a-name` | `Alex` is both a partner and an employee                                                       |                                  |
| `10-late-declarations-that-are-unused` | Like `Rezzan` in the prompt: declared late, never used, no warning                             |                                  |
| `11-empty-file`                        | Empty input: empty report and a note                                                           |                                  |
| `12-comments-and-blank-lines`          | `#` comments, blank lines, and a whitespace-only line are skipped                              |                                  |
| `13-no-companies`                      | Partners but no companies: empty report and a note                                             |                                  |
| `14-ranking-for-details`               | Several partners per company, with a tie                                                       | `--details`, `--company Initech` |

## Mistakes the tool catches

Each of these prints warnings on stderr, skips the bad lines, and still reports on the rest.

| File                                    | What it shows                                                                              | Also try             |
| --------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------- |
| `20-invalid-contact-types`              | `text`, `meeting` rejected; `Email` and `cofee` get "did you mean" hints                   | `--strict`           |
| `21-keyword-typos`                      | `Compnay`, `employee`, `Contcat`, `PARTNER` get hints; `Investor` lists the valid commands |                      |
| `22-undeclared-names`                   | `Lauri`, `Chriss`, `Globexx` get hints for the names that do exist                         | `--plain`            |
| `23-used-before-declared`               | A contact before its employee and partner exist: notes point at the later declarations     |                      |
| `24-swapped-contact-arguments`          | `Contact Chris Sam`: the warning shows the corrected line                                  |                      |
| `25-employee-declared-at-two-companies` | Sarah stays at her first company                                                           |                      |
| `26-wrong-word-counts`                  | Too few and too many words for every command, with usage                                   |                      |
| `27-invalid-names`                      | Digits, hyphens, underscores, apostrophes, and accented letters (`Zoë`, `José`)            |                      |
| `28-wrong-file-csv`                     | A CSV file: nothing parses, so the tool asks whether it's the right file                   |                      |
| `29-many-errors`                        | 25 bad lines: the first 20 are shown, then "…and 5 more warnings"                          | `--quiet`, `--stats` |

## Awkward inputs

| File                        | What it shows                                                                     | Also try                         |
| --------------------------- | --------------------------------------------------------------------------------- | -------------------------------- |
| `40-windows-line-endings`   | The prompt example with CRLF line endings                                         |                                  |
| `41-bom-tabs-and-spaces`    | A byte order mark, tabs between words, and leading and trailing spaces            |                                  |
| `42-no-final-newline`       | The last line has no newline                                                      |                                  |
| `43-double-digit-strengths` | Molly's 10 beats Chris's 9: strengths compare as numbers, not text                | `--details`                      |
| `44-keywords-used-as-names` | A partner named `Contact`, a company named `Partner`, an employee named `Company` |                                  |
| `45-everything-at-once`     | A realistic messy export mixing most of the above                                 | `--stats`, `--strict`, `--plain` |

## Stress

| File                     | What it shows                                                                                                                                                                                                                                                                                            | Also try                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `90-stress-10k-contacts` | 12,000 generated lines mixing almost every case above: 404 companies, 806 employees, 1,509 bad lines, a 100,000-letter name, a NUL byte, and a hub company with thousands of contacts. Generated by `scripts/stress.ts --contacts 10000 --seed 2026`; the expected output comes from its reference model | `--stats -q`, `--company CoA --details` |

It contains a NUL byte and a 100,000-character line on purpose, so some editors and web viewers may struggle to display it; the tool reads it fine.

`.gitattributes` keeps these files byte-exact, so git never "fixes" their line endings.

## Flags worth trying on any file

| Flag               | Effect                                               |
| ------------------ | ---------------------------------------------------- |
| `--strict`         | Stops at the first bad line and exits 1              |
| `--company <name>` | One company; a typo gets a "did you mean" and exit 1 |
| `--details`        | Every partner's strength, not just the strongest     |
| `--stats`          | Counts of everything, and skipped lines by reason    |
| `--format json`    | Machine-readable report                              |
| `--plain`          | Screen-reader-friendly warnings                      |
| `--quiet`          | Hides warnings                                       |
