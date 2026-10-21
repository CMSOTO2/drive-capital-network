import {
  applyCommand,
  createNetwork,
  type Network,
} from '../../src/core/network.ts';
import { parseLine } from '../../src/core/parse.ts';

/** Builds a Network from input lines, failing loudly on any bad line. */
export function networkFrom(lines: readonly string[]): Network {
  const network = createNetwork();
  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed.status === 'error') throw new Error(parsed.message);
    if (parsed.status === 'skip') continue;
    const problem = applyCommand(network, parsed.command);
    if (problem) throw new Error(problem.message);
  }
  return network;
}
