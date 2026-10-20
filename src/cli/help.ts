import {
  COMMAND_SYNTAX,
  EXIT_CODES,
  OUTPUT_FORMATS,
  STDIN_ARG,
} from '../constants.ts';

export const PROGRAM_NAME = 'analyze-network';

const commandUsage = Object.values(COMMAND_SYNTAX)
  .map(({ usage }) => `  ${usage}`)
  .join('\n');

export const HELP_TEXT = `${PROGRAM_NAME}: find the Drive Capital partner closest to each company

Usage
  ${PROGRAM_NAME} [options] [file]
  cat file | ${PROGRAM_NAME} [options]

Reads one command per line from FILE, or from STDIN when FILE is missing
or "${STDIN_ARG}". Prints every company, alphabetically, with the partner
who has had the most contacts with its employees.

Options
  -c, --company <name>      Only report this company; repeat for more
  -d, --details             List every partner's strength, not just the top
  -f, --format <${OUTPUT_FORMATS.join('|')}>  Output format (default: text)
  -s, --stats               Summarize the input on stderr (as JSON with
                            --format json)
      --strict              Stop at the first invalid line and exit ${EXIT_CODES.inputProblem}
  -q, --quiet               Don't print warnings about skipped lines
      --[no-]color          Force colors on or off (default: on for a
                            terminal; NO_COLOR=1 also turns them off)
      --plain               Screen-reader-friendly output: no color, no
                            decoration, ASCII only (automatic with TERM=dumb)
  -h, --help                Show this help
  -v, --version             Show the version

Input commands
${commandUsage}

Exit codes
  ${EXIT_CODES.ok}  Report printed; invalid lines, if any, were skipped with a warning
  ${EXIT_CODES.inputProblem}  Invalid input with --strict, or a --company that isn't in the input
  ${EXIT_CODES.usage}  Bad options, unreadable file, or no input

Examples
  ${PROGRAM_NAME} examples/input.txt
  ${PROGRAM_NAME} --company Globex --details examples/input.txt
  cat examples/input.txt | ${PROGRAM_NAME} --format json
`;

export const USAGE_HINT = `Run "${PROGRAM_NAME} --help" for usage.`;
