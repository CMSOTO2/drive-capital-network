/**
 * Runs one labelled example of every flag, so you can see what each does
 * without reading the docs first.
 *
 * Usage:
 *
 *   pnpm -s demo                 every example
 *   pnpm -s demo company json    only examples whose name contains a word
 *   pnpm -s demo --list          names and descriptions only
 *
 * Each example states the exit code it should end with, and the run fails if
 * one doesn't, so this doubles as a smoke test of the real CLI.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { styleText } from 'node:util';

export interface Demo {
  /** Short name for filtering: `pnpm -s demo <name>`. */
  name: string;
  /** What the example shows. */
  description: string;
  /** Arguments after `analyze-network`. */
  args: string[];
  /** A file piped in on STDIN instead of named as an argument. */
  stdinFile?: string;
  /** The exit code the CLI should return. */
  exitCode: number;
}

const INPUT = 'examples/input.txt';
const EDGE_CASES = 'examples/edge-cases.txt';
const SIMILAR_NAMES = 'examples/scenarios/30-full-and-partial-names.txt';

/** Column width for `--list`, wide enough for the longest name. */
const NAME_WIDTH = 20;

export const DEMOS: Demo[] = [
  {
    name: 'basic',
    description:
      "The prompt's example: every company and its strongest partner",
    args: [INPUT],
    exitCode: 0,
  },
  {
    name: 'stdin',
    description: 'The same input piped in on STDIN',
    args: [],
    stdinFile: INPUT,
    exitCode: 0,
  },
  {
    name: 'details',
    description: "--details (-d): every partner's strength, not just the top",
    args: ['--details', INPUT],
    exitCode: 0,
  },
  {
    name: 'company',
    description: '--company (-c): only the companies you ask for',
    args: ['--company', 'Globex', '-c', 'Hooli', INPUT],
    exitCode: 0,
  },
  {
    name: 'company-typo',
    description: '--company with a typo: a hint, and exit 1',
    args: ['--company', 'Globexx', INPUT],
    exitCode: 1,
  },
  {
    name: 'company-ambiguous',
    description: '--company with a partial name: every match is listed',
    args: ['--quiet', '--company', 'Glob', SIMILAR_NAMES],
    exitCode: 1,
  },
  {
    name: 'json',
    description: '--format json (-f json): the report as JSON, with rankings',
    args: ['--format', 'json', INPUT],
    exitCode: 0,
  },
  {
    name: 'warnings',
    description: 'Bad lines: a warning each on stderr; the report still prints',
    args: [EDGE_CASES],
    exitCode: 0,
  },
  {
    name: 'quiet',
    description: '--quiet (-q): the same file without the warnings',
    args: ['--quiet', EDGE_CASES],
    exitCode: 0,
  },
  {
    name: 'strict',
    description: '--strict: stop at the first bad line, no report, exit 1',
    args: ['--strict', EDGE_CASES],
    exitCode: 1,
  },
  {
    name: 'stats',
    description: '--stats (-s): counts of everything, and skips by reason',
    args: ['--stats', '--quiet', EDGE_CASES],
    exitCode: 0,
  },
  {
    name: 'stats-json',
    description: '--stats with --format json: both as JSON',
    args: ['--stats', '--format', 'json', '--quiet', INPUT],
    exitCode: 0,
  },
  {
    name: 'plain',
    description: '--plain: warnings in words for screen readers, ASCII only',
    args: ['--plain', EDGE_CASES],
    exitCode: 0,
  },
  {
    name: 'no-color',
    description: '--no-color: warnings without color (NO_COLOR=1 works too)',
    args: ['--no-color', EDGE_CASES],
    exitCode: 0,
  },
  {
    name: 'file-typo',
    description: 'A mistyped file name: a hint, and exit 2',
    args: ['examples/inptu.txt'],
    exitCode: 2,
  },
  {
    name: 'option-typo',
    description: 'A mistyped option: a hint, and exit 2',
    args: ['--detail', INPUT],
    exitCode: 2,
  },
  {
    name: 'version',
    description: '--version (-v)',
    args: ['--version'],
    exitCode: 0,
  },
  {
    name: 'help',
    description: '--help (-h): every option',
    args: ['--help'],
    exitCode: 0,
  },
];

/** The command as you'd type it, e.g. `cat x.txt | analyze-network -d`. */
export function commandLine({ args, stdinFile }: Demo): string {
  const command = ['analyze-network', ...args].join(' ');
  return stdinFile === undefined ? command : `cat ${stdinFile} | ${command}`;
}

/** Runs one example through `./analyze_network`; returns its exit code. */
function run(demo: Demo): number {
  const result = spawnSync(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', 'analyze_network', ...demo.args],
    {
      input: demo.stdinFile === undefined ? '' : readFileSync(demo.stdinFile),
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  );
  return result.status ?? 1;
}

function runFromCommandLine(): void {
  const filters = process.argv.slice(2).filter((arg) => arg !== '--list');
  const listOnly = process.argv.includes('--list');
  const chosen = DEMOS.filter(
    (demo) =>
      filters.length === 0 ||
      filters.some((filter) => demo.name.includes(filter)),
  );

  if (chosen.length === 0) {
    const names = DEMOS.map(({ name }) => name).join(', ');
    process.stderr.write(`no example matches; try one of: ${names}\n`);
    process.exitCode = 2;
    return;
  }

  if (listOnly) {
    for (const { name, description } of chosen) {
      process.stdout.write(`${name.padEnd(NAME_WIDTH)}${description}\n`);
    }
    return;
  }

  let failures = 0;
  for (const demo of chosen) {
    process.stdout.write(
      `\n${styleText('bold', `${demo.name}: ${demo.description}`)}\n`,
    );

    process.stdout.write(`$ ${commandLine(demo)}\n`);
    const exitCode = run(demo);
    const expected = exitCode === demo.exitCode;
    if (!expected) failures += 1;
    process.stdout.write(
      expected
        ? `(exit ${exitCode})\n`
        : `(exit ${exitCode}, expected ${demo.exitCode})\n`,
    );
  }

  if (failures > 0) {
    process.stderr.write(
      `\n${failures} example(s) ended with the wrong exit code\n`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('demo.ts')) {
  runFromCommandLine();
}
