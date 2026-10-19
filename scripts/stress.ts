/**
 * Generates a long, messy, but reproducible input file, together with the
 * report it must produce.
 *
 * The expected report comes from a deliberately simple reference model that
 * shares no code with `src/`: it records which contacts are valid while
 * generating them, then counts them at the end. Comparing the real program
 * against it (differential testing) checks inputs far too long to verify by
 * hand.
 *
 * Usage:
 *
 *   node scripts/stress.ts --contacts 1000000 --seed 7 --out /tmp/stress
 *
 * writes /tmp/stress/stress.txt and /tmp/stress/stress.expected.txt.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

export interface StressOptions {
  /** Same seed, same file. */
  seed: number;
  /** Roughly how many Contact lines to generate. */
  contacts: number;
}

export interface StressInput {
  /** The file contents, exactly as written to disk. */
  text: string;
  /** The report the program must print. */
  expected: string;
  /** Lines the program must report as invalid. */
  invalidLineCount: number;
  /** Contacts the program must count. */
  validContactCount: number;
}

const CONTACT_TYPES = ['email', 'call', 'coffee'] as const;

/** Lines that are never valid commands, whatever came before them. */
const INVALID_LINES = [
  'Contact Sam Chris text',
  'Contact Sam Chris Coffee',
  'Partner',
  'Company',
  'Partner Chris Smith',
  'Employee Bob',
  'Contact Sam Chris',
  'Contact Sam Chris call today',
  'Compnay Initech',
  'partner Zed',
  'Investor Bob',
  'Partner Zoë',
  'Company Acme-Co',
  "Partner O'Brien",
  'name,company,type',
  'Sarah,ACME,email',
  '💥 boom',
  'Partner Chris\u0000',
  'x '.repeat(5000).trim(),
];

/** Lines the program must skip without a warning. */
const IGNORED_LINES = ['', '   ', '\t', '# comment', '#Partner Hidden'];

/** A small, fast, seedable random number generator (mulberry32). */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** `index` written in letters only: 0 → A, 25 → Z, 26 → BA, … */
function lettersFor(index: number): string {
  let letters = '';
  let rest = index;
  do {
    letters = String.fromCharCode(65 + (rest % 26)) + letters;
    rest = Math.floor(rest / 26);
  } while (rest > 0);
  return letters;
}

/** The reference ordering: case-insensitive, then plain code-unit order. */
function referenceCompare(a: string, b: string): number {
  const keyA = [a.toLowerCase(), a];
  const keyB = [b.toLowerCase(), b];
  for (let i = 0; i < keyA.length; i += 1) {
    const left = keyA[i] ?? '';
    const right = keyB[i] ?? '';
    if (left < right) return -1;
    if (left > right) return 1;
  }
  return 0;
}

export function generateStress({ seed, contacts }: StressOptions): StressInput {
  const random = createRandom(seed);
  const pick = <T>(items: readonly T[]): T => {
    const item = items[Math.floor(random() * items.length)];
    if (item === undefined) throw new Error('pick from an empty list');
    return item;
  };
  const chance = (probability: number): boolean => random() < probability;

  // --- The reference model: what the program should end up knowing. ---
  const declaredPartners = new Set<string>();
  const declaredCompanies = new Set<string>();
  const employeeCompany = new Map<string, string>();
  const validContacts: { company: string; partner: string }[] = [];
  let invalidLineCount = 0;

  // --- The lines, before whitespace and line-ending noise is added. ---
  const lines: string[] = [];
  const emit = (line: string): void => {
    lines.push(line);
  };
  const emitInvalid = (line: string): void => {
    invalidLineCount += 1;
    emit(line);
  };
  const sprinkleNoise = (): void => {
    if (chance(0.03)) emitInvalid(pick(INVALID_LINES));
    if (chance(0.03)) emit(pick(IGNORED_LINES));
  };

  const declarePartner = (name: string): void => {
    declaredPartners.add(name);
    emit(`Partner ${name}`);
  };
  const declareCompany = (name: string): void => {
    declaredCompanies.add(name);
    emit(`Company ${name}`);
  };
  const declareEmployee = (name: string, company: string): void => {
    const valid =
      declaredCompanies.has(company) &&
      (!employeeCompany.has(name) || employeeCompany.get(name) === company);
    if (!valid) {
      invalidLineCount += 1;
    } else if (!employeeCompany.has(name)) {
      employeeCompany.set(name, company);
    }
    emit(`Employee ${name} ${company}`);
  };
  const addContact = (employee: string, partner: string): void => {
    const company = employeeCompany.get(employee);
    if (company !== undefined && declaredPartners.has(partner)) {
      validContacts.push({ company, partner });
    } else {
      invalidLineCount += 1;
    }
    emit(`Contact ${employee} ${partner} ${pick(CONTACT_TYPES)}`);
  };

  // --- Partners: most now, some only after contacts already use them. ---
  const partnerCount = 60;
  const partners = Array.from(
    { length: partnerCount },
    (_, index) => `P${lettersFor(index)}`,
  );
  const latePartners = new Set(partners.filter((_, index) => index % 5 === 0));
  emit('# Stress test: generated by scripts/stress.ts');
  for (const partner of partners) {
    if (!latePartners.has(partner)) declarePartner(partner);
  }
  declarePartner(`Long${'A'.repeat(100_000)}`);
  declarePartner(partners[1] ?? 'PB'); // a repeated declaration is a no-op

  // --- Companies, including three that differ only by letter case. ---
  const companyCount = Math.max(10, Math.floor(contacts / 25));
  const companies = Array.from(
    { length: companyCount },
    (_, index) => `Co${lettersFor(index)}`,
  );
  const caseTwins = ['Acme', 'ACME', 'acme'];
  for (const company of [...companies, ...caseTwins]) declareCompany(company);
  const hubCompany = companies[0] ?? 'CoA';

  // --- Employees: a few per company; some names match partner names. ---
  const employees: string[] = [];
  for (const [index, company] of [...companies, ...caseTwins].entries()) {
    const perCompany = company === hubCompany ? 20 : 1 + (index % 3);
    for (let n = 0; n < perCompany; n += 1) {
      const name =
        employees.length % 40 === 0
          ? `P${lettersFor(employees.length % partnerCount)}`
          : `E${lettersFor(employees.length)}`;
      declareEmployee(name, company);
      employees.push(name);
    }
    sprinkleNoise();
  }

  // An employee at a company that's only declared at the very end: invalid,
  // and so are its contacts.
  declareEmployee('Orphan', 'LateCo');
  // An employee declared again somewhere else: the first company wins.
  const movedEmployee = employees[1] ?? 'EB';
  declareEmployee(movedEmployee, 'Acme');

  const hubEmployees = employees.slice(0, 20);

  // --- Contacts: a busy hub company, typos, swaps, and late partners. ---
  for (let n = 0; n < contacts; n += 1) {
    if (n === Math.floor(contacts / 2)) {
      for (const partner of latePartners) declarePartner(partner);
    }

    const employee = chance(0.3) ? pick(hubEmployees) : pick(employees);
    const partner = pick(partners);

    if (chance(0.01)) {
      addContact(`${employee}x`, partner); // undeclared employee (typo)
    } else if (chance(0.005)) {
      addContact(partner, employee); // swapped arguments
    } else if (chance(0.002)) {
      addContact('Orphan', partner);
    } else {
      addContact(employee, partner);
    }
    sprinkleNoise();
  }

  declareCompany('LateCo');
  declareCompany(hubCompany); // a repeated declaration is a no-op

  // --- Expected report, computed the simple way. ---
  const counts = new Map<string, Map<string, number>>();
  for (const { company, partner } of validContacts) {
    const byPartner = counts.get(company) ?? new Map<string, number>();
    byPartner.set(partner, (byPartner.get(partner) ?? 0) + 1);
    counts.set(company, byPartner);
  }
  const expected = [...declaredCompanies]
    .toSorted(referenceCompare)
    .map((company) => {
      let best: { partner: string; count: number } | undefined;
      for (const [partner, count] of counts.get(company) ?? []) {
        const better =
          best === undefined ||
          count > best.count ||
          (count === best.count && referenceCompare(partner, best.partner) < 0);
        if (better) best = { partner, count };
      }
      return best === undefined
        ? `${company}: No current relationship\n`
        : `${company}: ${best.partner} (${best.count})\n`;
    })
    .join('');

  // --- Text noise: BOM, tabs, extra spaces, CRLF, no final newline. ---
  const separators = [' ', ' ', ' ', '  ', '\t', ' \t '];
  const rendered = lines.map((line) => {
    const words = line.startsWith('#') ? [line] : line.split(' ');
    let text = words.join(pick(separators));
    if (chance(0.05)) text = `  ${text}`;
    if (chance(0.05)) text = `${text}\t`;
    return chance(0.1) ? `${text}\r` : text;
  });
  const text = `﻿${rendered.join('\n')}`;

  return {
    text,
    expected,
    invalidLineCount,
    validContactCount: validContacts.length,
  };
}

/** `node scripts/stress.ts --contacts N --seed S --out DIR` */
function runFromCommandLine(): void {
  const { values } = parseArgs({
    options: {
      contacts: { type: 'string', default: '100000' },
      seed: { type: 'string', default: '2026' },
      out: { type: 'string', default: '.' },
    },
  });
  const contacts = Number(values.contacts);
  const seed = Number(values.seed);
  if (!Number.isInteger(contacts) || contacts < 1) {
    throw new Error('--contacts must be a positive whole number');
  }
  if (!Number.isInteger(seed)) {
    throw new Error('--seed must be a whole number');
  }

  const stress = generateStress({ seed, contacts });
  mkdirSync(values.out, { recursive: true });
  writeFileSync(join(values.out, 'stress.txt'), stress.text);
  writeFileSync(join(values.out, 'stress.expected.txt'), stress.expected);
  process.stderr.write(
    `wrote ${join(values.out, 'stress.txt')}: ${stress.text.split('\n').length.toLocaleString('en-US')} lines, ` +
      `${stress.validContactCount.toLocaleString('en-US')} valid contacts, ` +
      `${stress.invalidLineCount.toLocaleString('en-US')} invalid lines\n`,
  );
}

if (process.argv[1]?.endsWith('stress.ts')) {
  runFromCommandLine();
}
