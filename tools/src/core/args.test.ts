import { describe, expect, it } from 'vitest';
import { collectList, parseExternal } from './args.js';
import { formatDate, formatBytes, plural } from './output.js';
import { groupLines, publishLines, reportListLines } from './format.js';

describe('collectList', () => {
  it('splits commas, trims, and accumulates repeated options', () => {
    expect(collectList('c@x.com', collectList(' a@x.com, b@x.com ,'))).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com',
    ]);
  });
});

describe('parseExternal', () => {
  it('reads an optional expiry date', () => {
    expect(parseExternal('p@out.test:2026-12-31')).toEqual({
      email: 'p@out.test',
      expires: '2026-12-31',
    });
    expect(parseExternal('p@out.test')).toEqual({ email: 'p@out.test', expires: null });
  });
});

describe('output helpers', () => {
  it('formats sizes, local dates and plurals', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(214_000)).toBe('209 KB');
    expect(formatDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(formatDate(null)).toBe('-');
    expect(plural(1, 'viewer')).toBe('1 viewer');
    expect(plural(2, 'viewer')).toBe('2 viewers');
  });
});

describe('format lines', () => {
  it('publish: created vs updated, warnings as "!" lines', () => {
    const base = {
      id: 'abc',
      url: 'http://x/r/abc',
      title: 'T',
      status: 'published' as const,
      bytes: 2048,
      viewerCount: 2,
      externalCount: 1,
      warnings: ['careful'],
    };
    expect(publishLines({ ...base, created: true })).toEqual([
      '✓ Created "T" (published) → http://x/r/abc · 2 KB · 2 viewers, 1 external',
      '! careful',
    ]);
    expect(publishLines({ ...base, created: false })[0]).toBe(
      '✓ Updated "T" (published) → http://x/r/abc · 2 KB',
    );
  });

  it('report list caps its output and says how many more', () => {
    const item = {
      id: 'a',
      status: 'draft' as const,
      slug: null,
      title: 'A',
      viewers: 1,
      external: 0,
      expired: 0,
      updatedAt: null,
    };
    const lines = reportListLines([item, { ...item, id: 'b' }, { ...item, id: 'c' }], 2);
    expect(lines).toHaveLength(3);
    expect(lines[2]).toMatch(/1 more/);
    expect(reportListLines([])).toEqual(['(no reports)']);
  });

  it('groups truncate long member lists', () => {
    const members = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((n) => `${n}@x.com`);
    const [line] = groupLines([
      { id: 'g', name: 'Big', description: '', memberEmails: members } as never,
    ]);
    expect(line).toBe('Big (7 members): a@x.com, b@x.com, c@x.com, d@x.com, e@x.com +2 more');
  });
});
