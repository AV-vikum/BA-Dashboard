// Listing, pulling and unpublishing reports.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { FieldValue } from 'firebase-admin/firestore';
import {
  accessSummary,
  COLLECTIONS,
  matchesSearch,
  REPORT_CONTENT_DOC,
  type Group,
  type Report,
  type WithId,
} from '@ba/shared';
import { readReportJson } from './build.js';
import { env } from './env.js';
import { reportFolder } from './paths.js';
import { updateReportJsonFile, writeJson } from './report-folder.js';
import {
  accessBlock,
  connect,
  loadAllReports,
  loadGroups,
  loadReport,
  reportsDir,
  reportUrl,
  resolveReport,
} from './store.js';

export interface ReportListItem {
  id: string;
  status: Report['status'];
  slug: string | null;
  title: string;
  viewers: number;
  external: number;
  expired: number;
  updatedAt: Date | null;
}

export async function listReports(search?: string): Promise<ReportListItem[]> {
  const reports = await loadAllReports();
  return reports
    .filter((r) => !search || matchesSearch(r, search))
    .map((r) => {
      const summary = accessSummary(r);
      return {
        id: r.id,
        status: r.status,
        slug: r.slug,
        title: r.title,
        viewers: summary.internalCount,
        external: summary.externalCount,
        expired: summary.expiredExternal.length,
        updatedAt: r.updatedAt?.toDate() ?? null,
      };
    });
}

export async function listGroups(): Promise<WithId<Group>[]> {
  return (await loadGroups()).sort((a, b) => a.name.localeCompare(b.name));
}

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug.length >= 2 ? slug : `report-${slug || 'x'}`;
}

export interface PullResult {
  id: string;
  slug: string;
  folder: string;
  created: boolean;
}

/**
 * Writes report.json (metadata + live access + id) into reports/<slug>/. For a report
 * with no local source (created in the web app) it also saves the stored HTML to
 * dist/report.html with a README explaining that there is no editable source.
 */
export async function pullReport(id: string, slugOption?: string): Promise<PullResult> {
  const report = await loadReport(id);
  if (!report) throw new Error(`Report ${id} not found`);
  const slug = slugOption ?? report.slug ?? slugify(report.title);
  const folder = reportFolder(reportsDir(), slug);
  const groups = await loadGroups();
  const created = !existsSync(path.join(folder, 'report.json'));

  const reportIds = created ? {} : readReportJson(folder).reportIds;
  const fields = {
    reportIds: { ...reportIds, [env.FIREBASE_PROJECT_ID]: report.id },
    title: report.title,
    description: report.description,
    tags: report.tags,
    status: report.status,
    access: accessBlock(report, groups),
  };

  if (created) {
    mkdirSync(path.join(folder, 'dist'), { recursive: true });
    writeJson(path.join(folder, 'report.json'), fields);
    const db = await connect();
    const content = await db
      .collection(COLLECTIONS.reports)
      .doc(report.id)
      .collection('content')
      .doc(REPORT_CONTENT_DOC)
      .get();
    writeFileSync(path.join(folder, 'dist', 'report.html'), (content.data()?.html as string) ?? '');
    writeFileSync(
      path.join(folder, 'README.txt'),
      [
        `"${report.title}" was pulled from ${reportUrl(report.id)}.`,
        'Its built HTML is in dist/report.html; the original source (report.html, data.json,',
        'build-data.mjs) is not available. To change it, rebuild it from the starter:',
        `npm run report -- new <new-slug> --title "${report.title}"`,
        '',
      ].join('\n'),
    );
  } else {
    updateReportJsonFile(folder, fields);
  }
  return { id: report.id, slug, folder, created };
}

export async function unpublishReport(ref: string): Promise<WithId<Report>> {
  const { report } = await resolveReport(ref);
  const db = await connect();
  await db
    .collection(COLLECTIONS.reports)
    .doc(report.id)
    .update({
      status: 'draft',
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: `cli:${env.PUBLISHER_EMAIL}`,
    });
  return report;
}
