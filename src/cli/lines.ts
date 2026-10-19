import { StringDecoder } from 'node:string_decoder';

/**
 * Splits a stream into lines. Line endings can be `\n`, `\r\n`, or a lone
 * `\r` (old Mac files); the ending itself isn't included.
 *
 * This replaces `node:readline`'s async iterator, which throws "readline was
 * closed" and drops the last line when a single chunk holds more than about a
 * thousand lines. Real pipes send small chunks, but an in-memory stream (in
 * tests, or when embedding `main`) can send the whole input at once.
 *
 * Chunks can split a line, a `\r\n` pair, or a multi-byte UTF-8 character
 * anywhere; the decoder and the `pending` buffer stitch them back together.
 */
export async function* readLines(
  input: AsyncIterable<string | Uint8Array>,
): AsyncGenerator<string> {
  const decoder = new StringDecoder('utf8');
  let pending = '';

  for await (const chunk of input) {
    pending += typeof chunk === 'string' ? chunk : decoder.write(chunk);

    // Cut at every `\n` we have so far; keep the unfinished tail for later.
    let start = 0;
    let newline = pending.indexOf('\n', start);
    while (newline !== -1) {
      yield* splitAtLoneCarriageReturns(pending.slice(start, newline));
      start = newline + 1;
      newline = pending.indexOf('\n', start);
    }
    pending = pending.slice(start);
  }

  pending += decoder.end();
  if (pending !== '') {
    yield* splitAtLoneCarriageReturns(pending);
  }
}

/**
 * Everything between two `\n`s: drops the `\r` of a `\r\n` ending, and
 * treats any other `\r` as a line break of its own.
 */
function splitAtLoneCarriageReturns(text: string): string[] {
  const withoutCrlf = text.endsWith('\r') ? text.slice(0, -1) : text;
  return withoutCrlf.includes('\r') ? withoutCrlf.split('\r') : [withoutCrlf];
}
