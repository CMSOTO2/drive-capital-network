import { describe, expect, it } from 'vitest';

import { parseLine, wordPositionOf } from '../../src/core/parse.ts';

const errorOf = (line: string): string => {
  const result = parseLine(line);
  if (result.status !== 'error') {
    throw new Error(`expected an error for ${JSON.stringify(line)}`);
  }
  return result.message;
};

const wordsOf = (line: string): number[] => {
  const result = parseLine(line);
  return result.status === 'error' ? result.words : [];
};

const reasonOf = (line: string) => {
  const result = parseLine(line);
  return result.status === 'error' ? result.reason : undefined;
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
      expect(parseLine('\uFEFFPartner Chris')).toEqual(
        parseLine('Partner Chris'),
      );
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

  describe('word positions of errors', () => {
    it('points at the keyword when it is unknown', () => {
      expect(wordsOf('Investor Chris')).toEqual([0]);
    });

    it('points at the keyword when words are missing', () => {
      expect(wordsOf('Contact Laurie Chris')).toEqual([0]);
    });

    it('points at the extra words when there are too many', () => {
      expect(wordsOf('Partner Chris Van Dyke')).toEqual([2, 3]);
    });

    it('gives each error a reason', () => {
      expect(reasonOf('Investor Chris')).toBe('unknownCommand');
      expect(reasonOf('Partner')).toBe('wrongWordCount');
      expect(reasonOf('Partner Chris2')).toBe('invalidName');
      expect(reasonOf('Contact Laurie Chris text')).toBe('invalidContactType');
    });

    it('points at every invalid field', () => {
      expect(wordsOf('Contact L4urie Chris text')).toEqual([1, 3]);
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

    it('suggests the right keyword for a typo', () => {
      expect(errorOf('Contcat Laurie Chris call')).toBe(
        'unknown command "Contcat" (did you mean "Contact"?)',
      );
    });

    it('rejects too few words and shows the usage', () => {
      expect(errorOf('Contact Laurie Chris')).toBe(
        'Contact expects 3 arguments but got 2 (usage: Contact <EmployeeName> <PartnerName> <email|call|coffee>)',
      );
    });

    it('rejects too many words', () => {
      expect(errorOf('Partner Chris Smith2')).toBe(
        'Partner expects 1 argument but got 2 (usage: Partner <Name>)',
      );
    });

    it('suggests one word when a partner or company gets a full name', () => {
      expect(errorOf('Partner Chris Smith')).toBe(
        'Partner expects 1 argument but got 2 (usage: Partner <Name>); names are a single word (did you mean "Partner ChrisSmith"?)',
      );
      expect(errorOf('Company Acme Holdings Inc')).toMatch(
        /\(did you mean "Company AcmeHoldingsInc"\?\)$/,
      );
    });

    it('gives no full-name hint where the extra word may not be a name', () => {
      expect(errorOf('Contact Sam Chris call today')).not.toContain(
        'single word',
      );
      expect(errorOf('Employee Sarah Connor ACME')).not.toContain(
        'single word',
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

    it('suggests the right contact type for a typo', () => {
      expect(errorOf('Contact Laurie Chris cofee')).toBe(
        'contact type "cofee" is not valid (did you mean "coffee"?)',
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

describe('wordPositionOf', () => {
  it('finds where a field sits on its line', () => {
    expect(wordPositionOf('contact', 'employee')).toBe(1);
    expect(wordPositionOf('contact', 'type')).toBe(3);
    expect(wordPositionOf('employee', 'company')).toBe(2);
  });

  it('returns undefined for a field the command does not have', () => {
    expect(wordPositionOf('partner', 'company')).toBeUndefined();
  });
});
