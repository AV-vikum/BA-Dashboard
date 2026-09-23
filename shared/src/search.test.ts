import { describe, expect, it } from 'vitest';
import { collectTags, filterReports, matchesSearch } from './search.js';
import type { Report } from './types.js';

type TestReport = Pick<Report, 'title' | 'description' | 'tags' | 'status'>;

function report(overrides: Partial<TestReport> = {}): TestReport {
  return {
    title: 'Sales Overview',
    description: 'Quarterly sales by region',
    tags: ['sales', 'quarterly'],
    status: 'published',
    ...overrides,
  };
}

describe('matchesSearch', () => {
  it('matches a single word in the title, case-insensitively', () => {
    expect(matchesSearch(report(), 'SALES')).toBe(true);
  });

  it('matches a word in the description', () => {
    expect(matchesSearch(report(), 'region')).toBe(true);
  });

  it('matches a word in tags', () => {
    expect(matchesSearch(report(), 'quarterly')).toBe(true);
  });

  it('requires every word to match (AND, multi-word)', () => {
    expect(matchesSearch(report(), 'sales region')).toBe(true);
    expect(matchesSearch(report(), 'sales missing')).toBe(false);
  });

  it('returns true for an empty query', () => {
    expect(matchesSearch(report(), '')).toBe(true);
    expect(matchesSearch(report(), '   ')).toBe(true);
  });

  it('returns false when no word matches', () => {
    expect(matchesSearch(report(), 'nonexistent')).toBe(false);
  });
});

describe('filterReports', () => {
  const reports: TestReport[] = [
    report({ title: 'Sales Overview', tags: ['sales', 'quarterly'], status: 'published' }),
    report({ title: 'HR Headcount', tags: ['hr'], status: 'published' }),
    report({ title: 'Budget Draft', tags: ['finance', 'quarterly'], status: 'draft' }),
  ];

  it('returns all reports for an empty filter', () => {
    expect(filterReports(reports, {})).toHaveLength(3);
  });

  it('filters by status', () => {
    expect(filterReports(reports, { status: 'draft' }).map((r) => r.title)).toEqual([
      'Budget Draft',
    ]);
  });

  it('filters by query', () => {
    expect(filterReports(reports, { query: 'hr' }).map((r) => r.title)).toEqual(['HR Headcount']);
  });

  it('filters by tags with AND semantics', () => {
    const result = filterReports(reports, { tags: ['quarterly'] });
    expect(result.map((r) => r.title).sort()).toEqual(['Budget Draft', 'Sales Overview']);

    const both = filterReports(reports, { tags: ['quarterly', 'sales'] });
    expect(both.map((r) => r.title)).toEqual(['Sales Overview']);
  });

  it('combines query, tags, and status', () => {
    const result = filterReports(reports, { query: 'budget', tags: ['finance'], status: 'draft' });
    expect(result.map((r) => r.title)).toEqual(['Budget Draft']);
  });
});

describe('collectTags', () => {
  it('returns sorted unique tags with counts', () => {
    const reports = [{ tags: ['sales', 'quarterly'] }, { tags: ['sales'] }, { tags: ['hr'] }];
    expect(collectTags(reports)).toEqual([
      { tag: 'hr', count: 1 },
      { tag: 'quarterly', count: 1 },
      { tag: 'sales', count: 2 },
    ]);
  });

  it('returns an empty list for no reports', () => {
    expect(collectTags([])).toEqual([]);
  });
});
