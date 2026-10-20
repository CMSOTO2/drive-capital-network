import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runCli } from '../helpers/cli.ts';

const example = await readFile('examples/input.txt', 'utf8');
const expected = await readFile('examples/expected.txt', 'utf8');

describe('main', () => {
  describe('the prompt example (golden test)', () => {
    it('matches the expected output from a file', async () => {
      expect(await runCli(['examples/input.txt'])).toEqual({
        code: 0,
        stdout: expected,
        stderr: '',
      });
    });

    it('matches the expected output from STDIN', async () => {
      expect(await runCli([], { stdin: example })).toEqual({
        code: 0,
        stdout: expected,
        stderr: '',
      });
    });

    it('treats "-" as STDIN', async () => {
      expect((await runCli(['-'], { stdin: example })).stdout).toBe(expected);
    });

    it('handles Windows line endings', async () => {
      const crlf = example.replaceAll('\n', '\r\n');
      expect(await runCli([], { stdin: crlf })).toMatchObject({
        code: 0,
        stdout: expected,
      });
    });

    it('handles a missing final newline', async () => {
      expect((await runCli([], { stdin: example.trimEnd() })).stdout).toBe(
        expected,
      );
    });
  });

  describe('the edge-case example', () => {
    it('skips invalid lines with warnings and still prints the report', async () => {
      const { code, stdout, stderr } = await runCli([
        'examples/edge-cases.txt',
      ]);
      expect(code).toBe(0);
      expect(stdout).toBe(
        await readFile('examples/edge-cases.expected.txt', 'utf8'),
      );
      expect(stderr.match(/^warning:/gm)).toHaveLength(11);
      expect(stderr).toContain(
        'note: skipped 11 invalid lines; use --strict to fail instead',
      );
    });

    it('hides warnings with --quiet', async () => {
      expect(
        (await runCli(['--quiet', 'examples/edge-cases.txt'])).stderr,
      ).toBe('');
    });

    it('fails at the first bad line with --strict, printing no report', async () => {
      const { code, stdout, stderr } = await runCli([
        '--strict',
        '--quiet',
        'examples/edge-cases.txt',
      ]);
      expect(code).toBe(1);
      expect(stdout).toBe('');
      expect(stderr).toMatch(/^error: line 11: employee "Sarah"/);
      expect(stderr).toContain('stopped at line 11 because of --strict');
    });
  });

  describe('output formats', () => {
    it('prints JSON with --format json', async () => {
      const { code, stdout } = await runCli([
        '--format',
        'json',
        'examples/input.txt',
      ]);
      expect(code).toBe(0);
      expect(JSON.parse(stdout)).toEqual([
        { company: 'ACME', partner: null, strength: 0, partners: [] },
        {
          company: 'Globex',
          partner: 'Chris',
          strength: 2,
          partners: [
            { partner: 'Chris', strength: 2 },
            { partner: 'Molly', strength: 1 },
          ],
        },
        {
          company: 'Hooli',
          partner: 'Molly',
          strength: 1,
          partners: [{ partner: 'Molly', strength: 1 }],
        },
      ]);
    });

    it('colors warnings with FORCE_COLOR and never colors stdout', async () => {
      const { stdout, stderr } = await runCli(['examples/edge-cases.txt'], {
        env: { FORCE_COLOR: '1' },
      });
      expect(stderr).toContain('\u001B[');
      expect(stdout).not.toContain('\u001B[');
    });

    it('keeps warnings plain with --no-color', async () => {
      const { stderr } = await runCli(
        ['--no-color', 'examples/edge-cases.txt'],
        { env: { FORCE_COLOR: '1' } },
      );
      expect(stderr).not.toContain('\u001B[');
    });
  });

  describe('--company and --details', () => {
    it('reports only the requested companies', async () => {
      expect(
        await runCli(['-c', 'Hooli', '-c', 'ACME', 'examples/input.txt']),
      ).toEqual({
        code: 0,
        stdout: 'ACME: No current relationship\nHooli: Molly (1)\n',
        stderr: '',
      });
    });

    it('errors on a company that is not in the input, suggesting a fix', async () => {
      expect(
        await runCli(['-c', 'Globexx', '-c', 'Hooli', 'examples/input.txt']),
      ).toEqual({
        code: 1,
        stdout: 'Hooli: Molly (1)\n',
        stderr:
          'error: company "Globexx" isn\'t in the input (did you mean "Globex"?)\n',
      });
    });

    it('lists every partner with --details', async () => {
      expect((await runCli(['--details', 'examples/input.txt'])).stdout).toBe(
        'ACME: No current relationship\nGlobex: Chris (2), Molly (1)\nHooli: Molly (1)\n',
      );
    });

    it('filters JSON output too', async () => {
      const { stdout } = await runCli([
        '-f',
        'json',
        '-c',
        'Globex',
        'examples/input.txt',
      ]);
      expect(
        (JSON.parse(stdout) as { company: string }[]).map(
          ({ company }) => company,
        ),
      ).toEqual(['Globex']);
    });
  });

  describe('accessibility', () => {
    it('prints plain, ASCII-only warnings with --plain', async () => {
      const { stdout, stderr } = await runCli([
        '--plain',
        'examples/edge-cases.txt',
      ]);
      expect(stderr).toContain('  line 20 reads: Contact Peter Rezzan call\n');
      expect(stderr).toContain('  word at fault: "Rezzan"\n');
      expect(stderr).not.toContain('^');
      expect(stderr).not.toContain(' | ');
      const nonAscii = [...(stderr + stdout)].filter(
        (character) => (character.codePointAt(0) ?? 0) > 127,
      );
      expect(nonAscii).toEqual([]);
    });

    it('switches to plain output when TERM=dumb', async () => {
      const { stderr } = await runCli(['examples/edge-cases.txt'], {
        env: { TERM: 'dumb', FORCE_COLOR: '1' },
      });
      expect(stderr).toContain('reads:');
      expect(stderr).not.toContain('\u001B[');
    });

    it('lists --plain in the help', async () => {
      expect((await runCli(['--help'])).stdout).toContain('--plain');
    });
  });

  describe('untrusted input', () => {
    it('never echoes a terminal escape code from the file', async () => {
      const { stderr } = await runCli([], {
        stdin: 'Company ACME\nPartner Ev\u001b[31mil\n',
        env: { FORCE_COLOR: '0' },
      });
      expect(stderr).not.toContain('\u001b');
      expect(stderr).toContain(String.raw`Ev\u001b[31mil`);
    });
  });

  describe('--company with a partial or ambiguous name', () => {
    const similar =
      'Company Globe\nCompany Globex\nCompany ACME\nCompany Acme\n';

    it('lists every company it could mean instead of guessing', async () => {
      expect(await runCli(['-c', 'Glob'], { stdin: similar })).toEqual({
        code: 1,
        stdout: '',
        stderr:
          'error: company "Glob" isn\'t in the input (did you mean "Globe" or "Globex"?)\n',
      });
    });

    it('never picks one of two companies that differ only by case', async () => {
      const { code, stderr } = await runCli(['-c', 'acme'], { stdin: similar });
      expect(code).toBe(1);
      expect(stderr).toContain('(did you mean "ACME" or "Acme"?)');
    });

    it('still reports the companies that were found', async () => {
      const { code, stdout } = await runCli(['-c', 'Glob', '-c', 'Globe'], {
        stdin: similar,
      });
      expect(code).toBe(1);
      expect(stdout).toBe('Globe: No current relationship\n');
    });
  });

  describe('on a terminal', () => {
    const onTerminal = { outputIsTTY: true, env: { NO_COLOR: '1' } };

    it('puts a blank line between the warnings and the report', async () => {
      const { stdout, stderr } = await runCli(
        ['examples/edge-cases.txt'],
        onTerminal,
      );
      expect(stderr).toMatch(/use --strict to fail instead\n\n$/);
      expect(stdout).toBe(
        await readFile('examples/edge-cases.expected.txt', 'utf8'),
      );
    });

    it('adds no blank line when there is nothing on stderr', async () => {
      expect((await runCli(['examples/input.txt'], onTerminal)).stderr).toBe(
        '',
      );
    });

    it('adds no blank line when the output is redirected', async () => {
      const { stderr } = await runCli(['examples/edge-cases.txt']);
      expect(stderr).toMatch(/use --strict to fail instead\n$/);
      expect(stderr).not.toMatch(/\n\n$/);
    });
  });

  describe('--stats', () => {
    it('prints a summary on stderr and leaves stdout unchanged', async () => {
      const { code, stdout, stderr } = await runCli([
        '--stats',
        'examples/input.txt',
      ]);
      expect(code).toBe(0);
      expect(stdout).toBe(expected);
      expect(stderr).toContain('stats:\n  lines: 13 read, 13 commands');
    });

    it('prints the summary as JSON with --format json', async () => {
      const { stderr } = await runCli([
        '--stats',
        '--format',
        'json',
        'examples/input.txt',
      ]);
      expect(JSON.parse(stderr)).toMatchObject({ partners: 3, employees: 3 });
    });

    it('still prints stats with --quiet', async () => {
      const { stderr } = await runCli(['-q', '-s', 'examples/edge-cases.txt']);
      expect(stderr).not.toContain('warning:');
      expect(stderr).toContain('skipped lines: 11\n    undeclared name: 4\n');
    });
  });

  describe('empty and unusual input', () => {
    it('prints nothing and adds a note for empty input', async () => {
      expect(await runCli([], { stdin: '' })).toEqual({
        code: 0,
        stdout: '',
        stderr:
          'note: the input declares no companies, so there is nothing to report\n',
      });
    });

    it('asks whether it is the right file when nothing parses', async () => {
      const { code, stderr } = await runCli([], {
        stdin: 'name,company\nSarah,ACME\n',
      });
      expect(code).toBe(0);
      expect(stderr).toContain('Is this the right file?');
    });
  });

  describe('help and version', () => {
    it('prints help to stdout', async () => {
      const { code, stdout } = await runCli(['--help']);
      expect(code).toBe(0);
      expect(stdout).toContain('Usage');
      expect(stdout).toContain(
        'Contact <EmployeeName> <PartnerName> <email|call|coffee>',
      );
    });

    it('prints the package version', async () => {
      const { version } = JSON.parse(
        await readFile('package.json', 'utf8'),
      ) as { version: string };
      expect(await runCli(['--version'])).toEqual({
        code: 0,
        stdout: `analyze-network ${version}\n`,
        stderr: '',
      });
    });
  });

  describe('usage and file errors (exit 2)', () => {
    let directory: string;

    beforeAll(async () => {
      directory = await mkdtemp(join(tmpdir(), 'analyze-network-'));
    });

    afterAll(async () => {
      await rm(directory, { recursive: true, force: true });
    });

    it('refuses to wait on an interactive terminal with no input', async () => {
      const { code, stderr } = await runCli([], { stdinIsTTY: true });
      expect(code).toBe(2);
      expect(stderr).toContain('error: no input');
    });

    it('reports a missing file', async () => {
      expect(await runCli(['missing.txt'])).toEqual({
        code: 2,
        stdout: '',
        stderr: 'error: cannot read "missing.txt": no such file\n',
      });
    });

    it('suggests a file with a similar name', async () => {
      expect((await runCli(['examples/inptu.txt'])).stderr).toBe(
        'error: cannot read "examples/inptu.txt": no such file (did you mean "examples/input.txt"?)\n',
      );
    });

    it('suggests the file when the extension is missing', async () => {
      expect((await runCli(['examples/edge-cases'])).stderr).toContain(
        '(did you mean "examples/edge-cases.txt"?)',
      );
    });

    it('gives no file hint when the directory is missing too', async () => {
      expect((await runCli(['nowhere/input.txt'])).stderr).toBe(
        'error: cannot read "nowhere/input.txt": no such file\n',
      );
    });

    it('reports a directory', async () => {
      expect((await runCli([directory])).stderr).toBe(
        `error: cannot read "${directory}": it is a directory\n`,
      );
    });

    it.skipIf(process.getuid?.() === 0)(
      'reports a file without read permission',
      async () => {
        const locked = join(directory, 'locked.txt');
        await writeFile(locked, 'Company ACME\n');
        await chmod(locked, 0o000);
        const { code, stderr } = await runCli([locked]);
        expect(code).toBe(2);
        expect(stderr).toBe(
          `error: cannot read "${locked}": permission denied\n`,
        );
      },
    );

    it('suggests the option that was probably meant', async () => {
      expect((await runCli(['--detail', 'examples/input.txt'])).stderr).toBe(
        'error: unknown option "--detail" (did you mean "--details"?)\nRun "analyze-network --help" for usage.\n',
      );
    });

    it('reports an unknown option with a pointer to --help', async () => {
      expect(await runCli(['--verbose'])).toEqual({
        code: 2,
        stdout: '',
        stderr:
          'error: unknown option "--verbose"\nRun "analyze-network --help" for usage.\n',
      });
    });
  });
});
