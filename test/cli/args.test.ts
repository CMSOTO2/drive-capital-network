import { describe, expect, it } from 'vitest';

import { parseCliArgs } from '../../src/cli/args.ts';

const optionsOf = (argv: string[]) => {
  const result = parseCliArgs(argv);
  if (!result.ok) throw new Error(result.message);
  return result.options;
};

const errorOf = (argv: string[]) => {
  const result = parseCliArgs(argv);
  if (result.ok) throw new Error(`expected ${argv.join(' ')} to fail`);
  return result.message;
};

describe('parseCliArgs', () => {
  it('defaults to text output from STDIN', () => {
    expect(optionsOf([])).toEqual({
      help: false,
      version: false,
      strict: false,
      quiet: false,
      format: 'text',
      company: [],
      details: false,
      stats: false,
      plain: false,
    });
  });

  it('collects repeated --company flags and --details', () => {
    const options = optionsOf(['-c', 'ACME', '--company', 'Hooli', '-d']);
    expect(options.company).toEqual(['ACME', 'Hooli']);
    expect(options.details).toBe(true);
  });

  it('reads --plain', () => {
    expect(optionsOf(['--plain']).plain).toBe(true);
  });

  it('reads --stats and -s', () => {
    expect(optionsOf(['--stats']).stats).toBe(true);
    expect(optionsOf(['-s']).stats).toBe(true);
  });

  it('rejects a --company name with non-letters', () => {
    expect(errorOf(['--company', 'ACME Co'])).toBe(
      '--company "ACME Co" must contain only letters A-Z or a-z',
    );
  });

  it('takes a file path', () => {
    expect(optionsOf(['input.txt']).file).toBe('input.txt');
  });

  it('treats "-" as STDIN', () => {
    expect(optionsOf(['-']).file).toBeUndefined();
  });

  it('reads every flag, long and short', () => {
    expect(
      optionsOf(['-f', 'json', '--strict', '-q', '--no-color', 'in.txt']),
    ).toEqual({
      help: false,
      version: false,
      strict: true,
      quiet: true,
      color: false,
      format: 'json',
      company: [],
      details: false,
      stats: false,
      plain: false,
      file: 'in.txt',
    });
    expect(optionsOf(['--format=json']).format).toBe('json');
    expect(optionsOf(['-h']).help).toBe(true);
    expect(optionsOf(['-v']).version).toBe(true);
    expect(optionsOf(['--color']).color).toBe(true);
  });

  it('rejects an unknown option', () => {
    expect(errorOf(['--verbose'])).toBe('unknown option "--verbose"');
  });

  it('rejects an unsupported format', () => {
    expect(errorOf(['--format', 'xml'])).toBe(
      '--format must be text or json, got "xml"',
    );
  });

  it('rejects --format without a value', () => {
    expect(errorOf(['--format'])).toMatch(/needs a value/);
  });

  it('rejects more than one input file', () => {
    expect(errorOf(['a.txt', 'b.txt'])).toBe(
      'expected at most one input file, got 2: a.txt b.txt',
    );
  });

  it('rejects an empty file path', () => {
    expect(errorOf([''])).toBe('input file path is empty');
  });
});
