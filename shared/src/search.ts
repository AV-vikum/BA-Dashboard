// Client-side search/filter over reports already loaded from Firestore
// (the "My reports" list and admin reports page) — not a Firestore query.
import type { Report } from './types.js';

type SearchableReport = Pick<Report, 'title' | 'description' | 'tags'>;

export function matchesSearch(report: SearchableReport, query: string): boolean {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const haystack = [report.title, report.description, ...report.tags].join(' ').toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export interface ReportFilter {
  query?: string;
  tags?: string[]; // report must have ALL of these
  status?: Report['status'];
}

export function filterReports<T extends SearchableReport & Pick<Report, 'status' | 'tags'>>(
  reports: T[],
  filter: ReportFilter,
): T[] {
  return reports.filter((report) => {
    if (filter.status && report.status !== filter.status) return false;
    if (filter.tags && !filter.tags.every((tag) => report.tags.includes(tag))) return false;
    if (filter.query && !matchesSearch(report, filter.query)) return false;
    return true;
  });
}

export function collectTags(reports: Pick<Report, 'tags'>[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const report of reports) {
    for (const tag of report.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}
