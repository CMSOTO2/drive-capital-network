import { Network } from '../../src/core/network.ts';
import { parseLine } from '../../src/core/parse.ts';

/** Builds a Network from input lines, failing loudly on any bad line. */
export function networkFrom(lines: readonly string[]): Network {
  const network = new Network();
  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed.status === 'error') throw new Error(parsed.message);
    if (parsed.status === 'skip') continue;
    const warning = network.apply(parsed.command);
    if (warning) throw new Error(warning);
  }
  return network;
}
