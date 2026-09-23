import { describe, expect, it } from 'vitest';
import { expiryDateToDate, parseReportJson } from './report-json.js';

const valid = {
  reportId: null,
  title: 'Sales Overview Q3 2026',
  description: 'Revenue, orders and top products for Q3.',
  tags: ['sales', 'quarterly'],
  status: 'published',
  access: {
    emails: ['alice@example.com'],
    groups: ['Finance'],
    external: [{ email: 'partner@outside.test', expires: '2026-12-31' }],
  },
};

describe('parseReportJson', () => {
  it('parses a valid file', () => {
    const parsed = parseReportJson(JSON.stringify(valid));
    expect(parsed.title).toBe('Sales Overview Q3 2026');
    expect(parsed.access.external[0]).toEqual({
      email: 'partner@outside.test',
      expires: '2026-12-31',
    });
  });

  it('fills defaults for optional fields', () => {
    const parsed = parseReportJson(JSON.stringify({ title: 'Minimal' }));
    expect(parsed).toMatchObject({
      reportId: null,
      description: '',
      tags: [],
      status: 'published',
      access: { emails: [], groups: [], external: [] },
    });
  });

  it('rejects a missing title with its path', () => {
    const rest: Partial<typeof valid> = { ...valid };
    delete rest.title;
    expect(() => parseReportJson(JSON.stringify(rest))).toThrow(/title/);
  });

  it('rejects a bad email', () => {
    const bad = { ...valid, access: { ...valid.access, emails: ['not-an-email'] } };
    expect(() => parseReportJson(JSON.stringify(bad))).toThrow(/access\.emails\.0/);
  });

  it('rejects a bad date', () => {
    const bad = {
      ...valid,
      access: { ...valid.access, external: [{ email: 'a@b.com', expires: '31/12/2026' }] },
    };
    expect(() => parseReportJson(JSON.stringify(bad))).toThrow(/YYYY-MM-DD/);
  });

  it('normalizes upper-case tags and emails', () => {
    const parsed = parseReportJson(
      JSON.stringify({
        ...valid,
        tags: ['Sales', 'SALES'],
        access: { emails: ['Bob@Example.com'] },
      }),
    );
    expect(parsed.tags).toEqual(['sales']);
    expect(parsed.access.emails).toEqual(['bob@example.com']);
  });

  it('reports invalid JSON clearly', () => {
    expect(() => parseReportJson('{ nope')).toThrow(/not valid JSON/);
  });
});

describe('expiryDateToDate', () => {
  it('returns the end of the local day', () => {
    const date = expiryDateToDate('2026-12-31');
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([
      2026, 11, 31, 23,
    ]);
  });
});
