import { describe, expect, it } from 'vitest';

import type { CompanyRelationships } from '../../src/core/analyze.ts';
import {
  formatJsonReport,
  formatLine,
  formatTextReport,
} from '../../src/core/format.ts';

const report: CompanyRelationships[] = [
  { company: 'ACME', partners: [] },
  {
    company: 'Globex',
    partners: [
      { partner: 'Chris', strength: 2 },
      { partner: 'Molly', strength: 1 },
    ],
  },
];

describe('formatLine', () => {
  it('names the strongest partner and their strength', () => {
    expect(formatLine(report[1]!)).toBe('Globex: Chris (2)');
  });

  it('says when there is no relationship', () => {
    expect(formatLine(report[0]!)).toBe('ACME: No current relationship');
  });
});

describe('formatTextReport', () => {
  it('prints one newline-terminated line per company', () => {
    expect(formatTextReport(report)).toBe(
      'ACME: No current relationship\nGlobex: Chris (2)\n',
    );
  });

  it('prints nothing for an empty report', () => {
    expect(formatTextReport([])).toBe('');
  });
});

describe('formatJsonReport', () => {
  it('mirrors the text report and includes the full ranking', () => {
    expect(JSON.parse(formatJsonReport(report))).toEqual([
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
    ]);
  });

  it('prints an empty array for an empty report', () => {
    expect(formatJsonReport([])).toBe('[]\n');
  });
});
