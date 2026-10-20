import { describe, expect, it } from 'vitest';

import {
  rankRelationships,
  selectCompanies,
  strongestPartner,
} from '../../src/core/analyze.ts';
import { Network } from '../../src/core/network.ts';
import { networkFrom } from '../helpers/network.ts';

describe('rankRelationships', () => {
  it('ranks the prompt example', () => {
    const network = networkFrom([
      'Partner Chris',
      'Partner Molly',
      'Company Globex',
      'Company ACME',
      'Employee Laurie Globex',
      'Company Hooli',
      'Employee Abdi Hooli',
      'Employee Jamie Globex',
      'Contact Laurie Chris email',
      'Contact Laurie Molly call',
      'Partner Rezzan',
      'Contact Abdi Molly email',
      'Contact Laurie Chris coffee',
    ]);
    expect(rankRelationships(network)).toEqual([
      { company: 'ACME', partners: [] },
      {
        company: 'Globex',
        partners: [
          { partner: 'Chris', strength: 2 },
          { partner: 'Molly', strength: 1 },
        ],
      },
      { company: 'Hooli', partners: [{ partner: 'Molly', strength: 1 }] },
    ]);
  });

  it('breaks a tie in favour of the alphabetically first partner', () => {
    const network = networkFrom([
      'Partner Zoe',
      'Partner Adam',
      'Company ACME',
      'Employee Sam ACME',
      'Contact Sam Zoe email',
      'Contact Sam Adam call',
    ]);
    const [acme] = rankRelationships(network);
    expect(acme?.partners.map(({ partner }) => partner)).toEqual([
      'Adam',
      'Zoe',
    ]);
  });

  it('sorts companies case-insensitively, regardless of declaration order', () => {
    const network = networkFrom([
      'Company hooli',
      'Company Globex',
      'Company ACME',
      'Company apple',
    ]);
    expect(rankRelationships(network).map(({ company }) => company)).toEqual([
      'ACME',
      'apple',
      'Globex',
      'hooli',
    ]);
  });

  it('leaves out partners who never contacted the company', () => {
    const network = networkFrom([
      'Partner Chris',
      'Partner Rezzan',
      'Company ACME',
      'Employee Sam ACME',
      'Contact Sam Chris call',
    ]);
    expect(rankRelationships(network)[0]?.partners).toEqual([
      { partner: 'Chris', strength: 1 },
    ]);
  });

  it('returns an empty list for an empty network', () => {
    expect(rankRelationships(new Network())).toEqual([]);
  });
});

describe('strongestPartner', () => {
  it('returns the first ranked partner', () => {
    expect(
      strongestPartner({
        company: 'ACME',
        partners: [
          { partner: 'Chris', strength: 3 },
          { partner: 'Molly', strength: 1 },
        ],
      }),
    ).toEqual({ partner: 'Chris', strength: 3 });
  });

  it('returns undefined when nobody has a relationship', () => {
    expect(strongestPartner({ company: 'ACME', partners: [] })).toBeUndefined();
  });
});

describe('selectCompanies', () => {
  const report = [
    { company: 'ACME', partners: [] },
    { company: 'Globex', partners: [{ partner: 'Chris', strength: 2 }] },
    { company: 'Hooli', partners: [] },
  ];

  it('selects every company when none are requested', () => {
    expect(selectCompanies(report, [])).toEqual({
      selected: report,
      missing: [],
    });
  });

  it('keeps report order and drops duplicates', () => {
    const { selected } = selectCompanies(report, ['Hooli', 'ACME', 'Hooli']);
    expect(selected.map(({ company }) => company)).toEqual(['ACME', 'Hooli']);
  });

  it('reports missing names with a suggestion when one is close', () => {
    expect(selectCompanies(report, ['Globexx', 'Initech', 'ACME'])).toEqual({
      selected: [report[0]],
      missing: [
        { name: 'Globexx', matches: ['Globex'] },
        { name: 'Initech', matches: [] },
      ],
    });
  });

  it('matches names exactly, suggesting the right case', () => {
    expect(selectCompanies(report, ['acme']).missing).toEqual([
      { name: 'acme', matches: ['ACME'] },
    ]);
  });

  it('lists every company a partial or ambiguous name could mean', () => {
    const similar = [
      { company: 'ACME', partners: [] },
      { company: 'Acme', partners: [] },
      { company: 'Globe', partners: [] },
      { company: 'Globex', partners: [] },
    ];
    expect(selectCompanies(similar, ['Glob', 'acme']).missing).toEqual([
      { name: 'Glob', matches: ['Globe', 'Globex'] },
      { name: 'acme', matches: ['ACME', 'Acme'] },
    ]);
  });
});
