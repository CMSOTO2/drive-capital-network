import { describe, expect, it } from 'vitest';

import { parseLine } from '../src/parse.ts';

const errorOf = (line: string): string => {
  const result = parseLine(line);
  if (result.status !== 'error') {
    throw new Error(`expected an error for ${JSON.stringify(line)}`);
  }
  return result.message;
};

describe('parseLine', () => {
  describe('valid commands', () => {
    it('parses Partner', () => {
      expect(parseLine('Partner Chris')).toEqual({
        status: 'ok',
        command: { kind: 'partner', name: 'Chris' },
      });
    });

    it('parses Company', () => {
      expect(parseLine('Company ACME')).toEqual({
        status: 'ok',
        command: { kind: 'company', name: 'ACME' },
      });
    });

    it('parses Employee', () => {
      expect(parseLine('Employee Laurie Globex')).toEqual({
        status: 'ok',
        command: { kind: 'employee', name: 'Laurie', company: 'Globex' },
      });
    });

    it.each(['email', 'call', 'coffee'] as const)(
      'parses Contact with type %s',
      (type) => {
        expect(parseLine(`Contact Ollie Masha ${type}`)).toEqual({
          status: 'ok',
          command: {
            kind: 'contact',
            employee: 'Ollie',
            partner: 'Masha',
            type,
          },
        });
      },
    );
  });

  describe('whitespace and line endings', () => {
    it('ignores a trailing carriage return (CRLF input)', () => {
      expect(parseLine('Partner Chris\r')).toEqual(parseLine('Partner Chris'));
    });

    it('tolerates leading, trailing, and repeated spaces and tabs', () => {
      expect(parseLine('  Employee\t Laurie   Globex  ')).toEqual({
        status: 'ok',
        command: { kind: 'employee', name: 'Laurie', company: 'Globex' },
      });
    });

    it('strips a UTF-8 byte order mark at the start of the line', () => {
      expect(parseLine('﻿Partner Chris')).toEqual(parseLine('Partner Chris'));
    });
  });

  describe('skipped lines', () => {
    it.each(['', '   ', '\t', '\r'])('skips blank line %j', (line) => {
      expect(parseLine(line)).toEqual({ status: 'skip' });
    });

    it('skips # comment lines, like the one in the prompt example', () => {
      expect(parseLine('# input.txt - NOTE: demonstration only')).toEqual({
        status: 'skip',
      });
    });
  });

  describe('invalid commands', () => {
    it('rejects an unknown command and lists the valid ones', () => {
      expect(errorOf('Investor Chris')).toBe(
        'unknown command "Investor"; expected Partner, Company, Employee, or Contact',
      );
    });

    it('suggests the right keyword when only the case is wrong', () => {
      expect(errorOf('partner Chris')).toBe(
        'unknown command "partner" (did you mean "Partner"?)',
      );
    });

    it('rejects too few words and shows the usage', () => {
      expect(errorOf('Contact Laurie Chris')).toBe(
        'Contact expects 3 arguments but got 2 (usage: Contact <EmployeeName> <PartnerName> <email|call|coffee>)',
      );
    });

    it('rejects too many words', () => {
      expect(errorOf('Partner Chris Smith')).toBe(
        'Partner expects 1 argument but got 2 (usage: Partner <Name>)',
      );
    });

    it('rejects a keyword with no arguments', () => {
      expect(errorOf('Company')).toMatch(
        /^Company expects 1 argument but got 0/,
      );
    });

    it('rejects a contact type outside email, call, coffee', () => {
      expect(errorOf('Contact Laurie Chris text')).toBe(
        'contact type "text" is not one of email, call, or coffee',
      );
    });

    it('suggests the right contact type when only the case is wrong', () => {
      expect(errorOf('Contact Laurie Chris Coffee')).toBe(
        'contact type "Coffee" is not valid (did you mean "coffee"?)',
      );
    });

    it.each([
      ['Partner Chris2', 'partner name "Chris2"'],
      ['Company Acme-Co', 'company name "Acme-Co"'],
      ['Employee Laurie Glo_bex', 'company name "Glo_bex"'],
      ['Contact Laur1e Chris call', 'employee name "Laur1e"'],
      ['Partner Zoë', 'partner name "Zoë"'],
    ])('rejects non-letter characters in %j', (line, subject) => {
      expect(errorOf(line)).toBe(
        `${subject} must contain only letters A-Z or a-z`,
      );
    });

    it('reports every invalid field on the line', () => {
      expect(errorOf('Contact L4urie Chr1s text')).toBe(
        [
          'employee name "L4urie" must contain only letters A-Z or a-z',
          'partner name "Chr1s" must contain only letters A-Z or a-z',
          'contact type "text" is not one of email, call, or coffee',
        ].join('; '),
      );
    });

    it('does not treat prototype keys as keywords', () => {
      expect(errorOf('constructor Chris')).toMatch(/^unknown command/);
      expect(errorOf('__proto__ Chris')).toMatch(/^unknown command/);
    });
  });
});
