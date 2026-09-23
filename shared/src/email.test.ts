import { describe, expect, it } from 'vitest';
import {
  domainOf,
  isInternalEmail,
  isValidDomain,
  isValidEmail,
  normalizeDomain,
  normalizeEmail,
  parseEmailList,
} from './email.js';

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Alice@Example.com  ')).toBe('alice@example.com');
  });
});

describe('isValidEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidEmail('alice@example.com')).toBe(true);
  });

  it('accepts upper-case and surrounding spaces', () => {
    expect(isValidEmail('  Alice@Example.com  ')).toBe(true);
  });

  it('rejects missing @ or domain', () => {
    expect(isValidEmail('alice')).toBe(false);
    expect(isValidEmail('alice@example')).toBe(false);
    expect(isValidEmail('alice example.com')).toBe(false);
  });
});

describe('domainOf', () => {
  it('returns the part after the last @, normalized', () => {
    expect(domainOf('Alice@Example.COM')).toBe('example.com');
  });
});

describe('normalizeDomain', () => {
  it('trims, lower-cases, and strips a leading @', () => {
    expect(normalizeDomain('  @Example.com  ')).toBe('example.com');
  });
});

describe('isValidDomain', () => {
  it('accepts a normal domain', () => {
    expect(isValidDomain('example.com')).toBe(true);
  });

  it('accepts an @-prefixed domain', () => {
    expect(isValidDomain('@example.com')).toBe(true);
  });

  it('rejects a bare word with no dot', () => {
    expect(isValidDomain('example')).toBe(false);
  });
});

describe('isInternalEmail', () => {
  const allowedDomains = ['example.com'];

  it('matches an exact domain', () => {
    expect(isInternalEmail('alice@example.com', allowedDomains)).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(isInternalEmail('Alice@Example.com', allowedDomains)).toBe(true);
  });

  it('rejects a different domain', () => {
    expect(isInternalEmail('alice@gmail.com', allowedDomains)).toBe(false);
  });

  // Sub-domain matching would let anyone who controls DNS for a sub-domain
  // of an allowed domain gain access — exact match only.
  it('rejects a sub-domain of an allowed domain', () => {
    expect(isInternalEmail('alice@mail.example.com', allowedDomains)).toBe(false);
  });
});

describe('parseEmailList', () => {
  it('normalizes, de-duplicates, and separates invalid entries', () => {
    const result = parseEmailList('a@x.com, b@y.com\nc@z.com\nA@X.COM\nnot-an-email');
    expect(result.emails).toEqual(['a@x.com', 'b@y.com', 'c@z.com']);
    expect(result.invalid).toEqual(['not-an-email']);
  });

  it('ignores blank lines and extra whitespace', () => {
    const result = parseEmailList('a@x.com,\n\n  b@y.com  ,,');
    expect(result.emails).toEqual(['a@x.com', 'b@y.com']);
    expect(result.invalid).toEqual([]);
  });

  it('returns empty lists for empty input', () => {
    expect(parseEmailList('')).toEqual({ emails: [], invalid: [] });
  });
});
