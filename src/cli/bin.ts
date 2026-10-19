#!/usr/bin/env node
// Entry point for the `analyze-network` command. Kept separate from main.ts so
// that importing main.ts (in tests, or from ./analyze_network) never starts
// the CLI by accident.
import { runFromProcess } from './main.ts';

await runFromProcess();
