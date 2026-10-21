# Usage guide

Everything the CLI does, with example output. The [README](../README.md) covers the basics; this is the full reference.

- [Ways to run it](#ways-to-run-it)
- [Options and exit codes](#options-and-exit-codes)
- [One example per flag](#one-example-per-flag)
- [Invalid input](#invalid-input)
- [Asking about specific companies](#asking-about-specific-companies)
- [Stats](#stats)
- [JSON output](#json-output)
- [Accessibility](#accessibility)
- [Every feature](#every-feature)
- [Every edge case](#every-edge-case)

## Ways to run it

`./analyze_network` runs the TypeScript source directly (Node 22.18+ strips the types itself), so there's no build step.

| Command                                     | What it does                                                                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `./analyze_network <file>`                  | Runs the source. On Windows, use `node analyze_network <file>`                                                                    |
| `cat <file> \| ./analyze_network`           | Reads from STDIN (also with `-` as the file name)                                                                                 |
| `pnpm build && node dist/cli/bin.js <file>` | Compiles to `dist/` and runs the compiled CLI                                                                                     |
| `pnpm -s analyze <file>`                    | Same as above, after `pnpm build`. Keep `-s`: without it, pnpm prints its own header lines into the output                        |
| `pnpm -s dev <file>`                        | Runs the source, like `./analyze_network`                                                                                         |
| `pnpm link --global`                        | Puts `analyze-network` on your `PATH`, as in the examples below (run `pnpm setup` once first if pnpm has no global bin directory) |

## Options and exit codes

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

## One example per flag

`pnpm -s demo` runs every example below and prints a labelled header, the command, its output, and its exit code. Pass names to run only some:

```bash
pnpm -s demo                  # every example
pnpm -s demo strict json      # only the examples whose name contains "strict" or "json"
pnpm -s demo --list           # names and descriptions only
```

Each example states the exit code it should end with, and the run fails if one doesn't, so the demo stays accurate (`test/scripts/demo.test.ts` checks the same thing). The examples live in [`scripts/demo.ts`](../scripts/demo.ts).

| Name                | Command                                                                                   | What it shows                                                 |
| ------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `basic`             | `analyze-network examples/input.txt`                                                      | The prompt's example: every company and its strongest partner |
| `stdin`             | `cat examples/input.txt \| analyze-network`                                               | The same input piped in on STDIN                              |
| `details`           | `analyze-network --details examples/input.txt`                                            | --details (-d): every partner's strength, not just the top    |
| `company`           | `analyze-network --company Globex -c Hooli examples/input.txt`                            | --company (-c): only the companies you ask for                |
| `company-typo`      | `analyze-network --company Globexx examples/input.txt`                                    | --company with a typo: a hint, and exit 1                     |
| `company-ambiguous` | `analyze-network --quiet --company Glob examples/scenarios/30-full-and-partial-names.txt` | --company with a partial name: every match is listed          |
| `json`              | `analyze-network --format json examples/input.txt`                                        | --format json (-f json): the report as JSON, with rankings    |
| `warnings`          | `analyze-network examples/edge-cases.txt`                                                 | Bad lines: a warning each on stderr; the report still prints  |
| `quiet`             | `analyze-network --quiet examples/edge-cases.txt`                                         | --quiet (-q): the same file without the warnings              |
| `strict`            | `analyze-network --strict examples/edge-cases.txt`                                        | --strict: stop at the first bad line, no report, exit 1       |
| `stats`             | `analyze-network --stats --quiet examples/edge-cases.txt`                                 | --stats (-s): counts of everything, and skips by reason       |
| `stats-json`        | `analyze-network --stats --format json --quiet examples/input.txt`                        | --stats with --format json: both as JSON                      |
| `plain`             | `analyze-network --plain examples/edge-cases.txt`                                         | --plain: warnings in words for screen readers, ASCII only     |
| `no-color`          | `analyze-network --no-color examples/edge-cases.txt`                                      | --no-color: warnings without color (NO_COLOR=1 works too)     |
| `file-typo`         | `analyze-network examples/inptu.txt`                                                      | A mistyped file name: a hint, and exit 2                      |
| `option-typo`       | `analyze-network --detail examples/input.txt`                                             | A mistyped option: a hint, and exit 2                         |
| `version`           | `analyze-network --version`                                                               | --version (-v)                                                |
| `help`              | `analyze-network --help`                                                                  | --help (-h): every option                                     |

## Invalid input

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

[`examples/edge-cases.txt`](../examples/edge-cases.txt) exercises the rules in the [edge-case table](#every-edge-case), and its expected output is in [`examples/edge-cases.expected.txt`](../examples/edge-cases.expected.txt). For one scenario per file, see [`examples/scenarios/`](../examples/scenarios/): 31 inputs covering happy paths, every kind of mistake, and awkward files (CRLF, byte order mark, tabs, no final newline), with a guide to what each shows.

## Asking about specific companies

`--company` answers the prompt's question "who is the person we know best at ACME?" directly, and `--details` shows the full ranking behind the answer:

```console
$ analyze-network --company Globex --details examples/input.txt
Globex: Chris (2), Molly (1)

$ analyze-network --company Globexx examples/input.txt
error: company "Globexx" isn't in the input (did you mean "Globex"?)

$ analyze-network --quiet --company Glob examples/scenarios/30-full-and-partial-names.txt
error: company "Glob" isn't in the input (did you mean "Globe" or "Globex"?)
```

## Stats

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

With `--format json`, the same summary is printed to stderr as JSON. Stats hold counts only, never names, so they're safe to log or share. [Decision record 0007](./decisions/0007-usage-telemetry.md) explains how this would feed product analytics in a real deployment.

## JSON output

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

## Accessibility

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

See [decision record 0008](./decisions/0008-accessible-output.md).

## Every feature

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
- Never echoes raw control characters: a terminal escape code or an invisible space in a bad line is shown as `\u001b` or `\u00a0`.
- Stays readable on huge or broken files: the first 20 warnings are shown and the rest counted, long lines and names are cut down, and a file where nothing parses gets "Is this the right file?"
- Tolerates Windows and old Mac line endings, a byte order mark, tabs, extra spaces, a missing final newline, blank lines, and `#` comments.
- Clear errors for a missing file, a directory, or a permission problem. With no input it explains how to give some instead of waiting on the keyboard, and it exits quietly when piped into `head`.

**Output and accessibility**

- The report goes to stdout and everything else to stderr, so the output is always safe to pipe.
- Color only on a terminal, following `NO_COLOR`, `FORCE_COLOR`, and `--[no-]color`. Color is never the only signal, and information is never dimmed.
- `--plain` says everything in words for screen readers, ASCII only; it turns on automatically with `TERM=dumb`.
- `--quiet`, `--help`, `--version`, and documented exit codes: 0 success, 1 input problem, 2 usage or file error.

**Quality**

- Tests at every level: unit tests per module, the CLI in process and as a real child process, 31 scenario files with hand-worked expected output plus a 12,000-line generated one, the prompt's own example read straight from [`prompt.md`](./prompt.md), and differential stress tests against an independent reference model. See [development.md](./development.md).
- TypeScript 7 in strict mode, Zod as the only runtime dependency, oxlint with warnings as errors, and oxfmt.
- A pre-commit hook that lints, formats, and runs the tests; commitlint for Conventional Commits; and CI on Node 22.18 and 24.

## Every edge case

The README lists the interpretations of the prompt. This is the complete list, including how the tool handles messy files.

| Case                                                                                                       | Behavior                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What counts as a letter                                                                                    | `A`–`Z` and `a`–`z` only. "Upper- and lowercase characters A thru z" reads as the letters, not the ASCII range from `A` to `z`, which also contains `[`, `\`, `]`, `^`, `_`, and `` ` ``. Accented letters (`Zoë`) and digits are rejected with a warning.                                                                                                          |
| Two partners tie for strongest                                                                             | The alphabetically first partner wins. The prompt doesn't say; I picked a deterministic rule.                                                                                                                                                                                                                                                                       |
| Company sort order                                                                                         | Case-insensitive alphabetical, with an ordinal tiebreak. Matches the example (`ACME`, `Globex`, `Hooli`).                                                                                                                                                                                                                                                           |
| Names that differ only in case (`Chris` and `chris`, `ACME` and `acme`)                                    | Treated as different names, since the prompt treats names as exact words and merging by case could silently combine two real entities. A contact or employee line that uses the wrong case for a declared name is skipped with a hint (`did you mean "Chris"?`). If a file declares both `ACME` and `acme`, both are kept as separate companies, without a warning. |
| Contact type other than `email`, `call`, `coffee`                                                          | Rejected with a warning ("should only accept" those three).                                                                                                                                                                                                                                                                                                         |
| Contact type weighting                                                                                     | None. Every contact counts as 1, since strength is the "total amount of Contacts".                                                                                                                                                                                                                                                                                  |
| Contact names an undeclared employee or partner                                                            | Warning, line skipped. Commands are processed in order, so a contact can't refer forward to a later declaration. If the name is declared further down, the warning says on which line, since moving it up is the usual fix.                                                                                                                                         |
| Employee names an undeclared company                                                                       | Warning, line skipped. The prompt says this won't happen; the check is cheap.                                                                                                                                                                                                                                                                                       |
| Same partner or company declared twice                                                                     | Ignored, no warning.                                                                                                                                                                                                                                                                                                                                                |
| Employee declared again at a different company                                                             | Warning, first declaration kept (employee names are globally unique).                                                                                                                                                                                                                                                                                               |
| Identical `Contact` lines repeated                                                                         | Each one counts. They're separate interactions.                                                                                                                                                                                                                                                                                                                     |
| Blank lines, Windows line endings, extra spaces or tabs                                                    | Tolerated.                                                                                                                                                                                                                                                                                                                                                          |
| No newline at the end of the file                                                                          | Tolerated.                                                                                                                                                                                                                                                                                                                                                          |
| Old Mac line endings (a lone `\r`)                                                                         | Treated as line breaks, like `\n` and `\r\n`.                                                                                                                                                                                                                                                                                                                       |
| Lines starting with `#`                                                                                    | Skipped as comments. The prompt says real input won't have them, but its example does, so pasting the example as-is works.                                                                                                                                                                                                                                          |
| UTF-8 byte order mark at the start of the file                                                             | Stripped. Some Windows editors add one.                                                                                                                                                                                                                                                                                                                             |
| Typo or wrong case in a keyword or contact type (`Contcat`, `partner`, `cofee`)                            | Rejected, since the prompt defines exact words, but the warning suggests the fix: `did you mean "Contact"?`                                                                                                                                                                                                                                                         |
| Undeclared name close to a declared one (`Lauri` vs `Laurie`)                                              | Warning, line skipped, with `did you mean "Laurie"?`                                                                                                                                                                                                                                                                                                                |
| Employee and partner swapped in a `Contact`                                                                | Warning, line skipped, showing the corrected line                                                                                                                                                                                                                                                                                                                   |
| Unknown command, wrong number of words, non-letter characters                                              | Warning, line skipped. The warning lists the valid commands or shows the expected usage.                                                                                                                                                                                                                                                                            |
| A full name where one word belongs (`Partner Chris Smith`)                                                 | Warning, line skipped. For `Partner` and `Company`, the warning suggests the name as one word (`ChrisSmith`). Not for `Employee` or `Contact`, where an extra word might not be part of a name.                                                                                                                                                                     |
| `--company` name that matches several companies (`Glob`, or `acme` with both `ACME` and `Acme` declared)   | Exit 1, listing every match: `did you mean "Globe" or "Globex"?`. The tool never picks one, since a script would silently get the wrong company's answer. It also doesn't stop to ask, which would hang scripts and pipes.                                                                                                                                          |
| Partner with no contacts                                                                                   | Never appears in the output.                                                                                                                                                                                                                                                                                                                                        |
| Same name used for a partner and an employee                                                               | Allowed. Partners and employees are separate namespaces.                                                                                                                                                                                                                                                                                                            |
| Empty input, or no companies declared                                                                      | Empty report, plus a note on stderr explaining why.                                                                                                                                                                                                                                                                                                                 |
| No line in the file is a valid command                                                                     | Warnings, plus a note asking whether it's the right file.                                                                                                                                                                                                                                                                                                           |
| Thousands of invalid lines                                                                                 | The first 20 warnings are shown, then "…and N more", so a wrong file doesn't flood the terminal.                                                                                                                                                                                                                                                                    |
| A name longer than 40 letters                                                                              | No close-spelling hint for it; comparing very long names would take too long. Matching the start of a `--company` name still works.                                                                                                                                                                                                                                 |
| Invisible or terminal-control characters (a non-breaking space, a zero-width space, a terminal color code) | Shown escaped in warnings (`\u00a0`, `\u200b`, `\u001b[31m`), so a file can't change your terminal and an invisible cause is visible.                                                                                                                                                                                                                               |
| Run with no file and nothing piped in                                                                      | Exits 2 with a usage hint instead of silently waiting for keyboard input.                                                                                                                                                                                                                                                                                           |
| Output piped into a command that exits early (`\| head -1`)                                                | Exits quietly with code 0 instead of printing a stack trace.                                                                                                                                                                                                                                                                                                        |
| Large input                                                                                                | Streamed line by line. A million contacts (1.2 million lines, 46 MB) with 150,000 bad lines runs in about 2 seconds and 300 MB. See [development.md](./development.md#performance-and-stress-testing).                                                                                                                                                              |
