import { Readable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { readLines } from '../../src/cli/lines.ts';

/** Collects every line from the given chunks. */
async function linesOf(chunks: (string | Uint8Array)[]): Promise<string[]> {
  const lines: string[] = [];
  for await (const line of readLines(Readable.from(chunks))) {
    lines.push(line);
  }
  return lines;
}

describe('readLines', () => {
  it('splits on \\n and drops the ending', async () => {
    expect(await linesOf(['a\nb\n'])).toEqual(['a', 'b']);
  });

  it('keeps a last line that has no newline', async () => {
    expect(await linesOf(['a\nb'])).toEqual(['a', 'b']);
  });

  it('keeps blank lines', async () => {
    expect(await linesOf(['a\n\n\nb\n'])).toEqual(['a', '', '', 'b']);
  });

  it('reads nothing from an empty stream', async () => {
    expect(await linesOf([])).toEqual([]);
  });

  it('handles Windows \\r\\n endings', async () => {
    expect(await linesOf(['a\r\nb\r\n'])).toEqual(['a', 'b']);
  });

  it('handles old Mac \\r endings', async () => {
    expect(await linesOf(['a\rb\rc'])).toEqual(['a', 'b', 'c']);
  });

  it('stitches lines split across chunks', async () => {
    expect(await linesOf(['Part', 'ner Ch', 'ris\nComp', 'any ACME'])).toEqual([
      'Partner Chris',
      'Company ACME',
    ]);
  });

  it('treats a \\r\\n split across chunks as one ending', async () => {
    expect(await linesOf(['a\r', '\nb'])).toEqual(['a', 'b']);
  });

  it('decodes a multi-byte character split across byte chunks', async () => {
    const bytes = new TextEncoder().encode('Zoë\n');
    const splitInsideE = 3; // "Zo" is 2 bytes, "ë" is 2 more
    expect(
      await linesOf([
        bytes.subarray(0, splitInsideE),
        bytes.subarray(splitInsideE),
      ]),
    ).toEqual(['Zoë']);
  });

  it('reads 50,000 lines from a single chunk', async () => {
    // node:readline's async iterator throws "readline was closed" here.
    const lines = await linesOf(['Partner Chris\n'.repeat(50_000)]);
    expect(lines).toHaveLength(50_000);
    expect(lines.at(-1)).toBe('Partner Chris');
  });
});
