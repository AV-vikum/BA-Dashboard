// Publishes a local report folder to Firestore (create or update).
// Ownership rules (architecture.md §A7): report.json owns content + title/description/tags;
// access is applied from report.json only when the report is first created.
import { FieldValue } from 'firebase-admin/firestore';
import {
  applyAccessChange,
  COLLECTIONS,
  expiryDateToDate,
  REPORT_CONTENT_DOC,
  type Report,
} from '@ba/shared';
import { buildReportFolder } from './build.js';
import { env, targetLabel } from './env.js';
import {
  connect,
  loadAccessConfig,
  loadGroups,
  loadReport,
  publishedId,
  reportsDir,
  reportUrl,
  resolveGroupIds,
  toFirestoreExpiry,
} from './store.js';
import { reportFolder } from './paths.js';
import { updateReportJsonFile } from './report-folder.js';

export interface PublishResult {
  id: string;
  url: string;
  title: string;
  status: Report['status'];
  bytes: number;
  viewerCount: number;
  externalCount: number;
  created: boolean;
  warnings: string[];
}

const EMPTY_ACCESS = { directEmails: [], groupIds: [], externalEmails: [], externalExpiry: {} };

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export async function publishReport(
  slug: string,
  options: { draft?: boolean } = {},
): Promise<PublishResult> {
  const folder = reportFolder(reportsDir(), slug);
  const built = buildReportFolder(folder);
  const { reportJson } = built;
  const warnings = [...built.warnings];
  const status: Report['status'] = options.draft ? 'draft' : reportJson.status;
  const updatedBy = `cli:${env.PUBLISHER_EMAIL}`;
  const now = FieldValue.serverTimestamp();

  const db = await connect();
  const existingId = publishedId(reportJson);

  if (!existingId) {
    const [accessConfig, groups] = await Promise.all([loadAccessConfig(), loadGroups()]);
    const access = applyAccessChange(
      EMPTY_ACCESS,
      {
        addEmails: reportJson.access.emails,
        addGroupIds: resolveGroupIds(reportJson.access.groups, groups),
        addExternal: reportJson.access.external.map((e) => ({
          email: e.email,
          expires: e.expires ? expiryDateToDate(e.expires) : null,
        })),
      },
      groups,
      accessConfig.allowedDomains,
    );
    warnings.push(...access.warnings);
    if (access.externalEmails.length && !accessConfig.allowExternalSharing) {
      warnings.push('external sharing is turned off in Settings — external people cannot open it');
    }

    const ref = db.collection(COLLECTIONS.reports).doc();
    const batch = db.batch();
    batch.set(ref, {
      title: reportJson.title,
      description: reportJson.description,
      tags: reportJson.tags,
      slug,
      status,
      directEmails: access.directEmails,
      groupIds: access.groupIds,
      viewerEmails: access.viewerEmails,
      externalEmails: access.externalEmails,
      externalExpiry: toFirestoreExpiry(access.externalExpiry),
      sizeBytes: built.bytes,
      createdAt: now,
      updatedAt: now,
      publishedAt: status === 'published' ? now : null,
      createdBy: updatedBy,
      updatedBy,
    });
    batch.set(ref.collection('content').doc(REPORT_CONTENT_DOC), {
      html: built.html,
      updatedAt: now,
    });
    await batch.commit();

    updateReportJsonFile(folder, {
      reportIds: { ...reportJson.reportIds, [env.FIREBASE_PROJECT_ID]: ref.id },
    });

    return {
      id: ref.id,
      url: reportUrl(ref.id),
      title: reportJson.title,
      status,
      bytes: built.bytes,
      viewerCount: access.viewerEmails.length,
      externalCount: access.externalEmails.length,
      created: true,
      warnings,
    };
  }

  const existing = await loadReport(existingId);
  if (!existing) {
    throw new Error(
      `Report ${existingId} not found in ${targetLabel()}. If it was deleted, remove ` +
        `"${env.FIREBASE_PROJECT_ID}" from reportIds in reports/${slug}/report.json to create it again.`,
    );
  }

  const editedInWeb = !existing.updatedBy.startsWith('cli:');
  if (editedInWeb) {
    if (existing.title !== reportJson.title) {
      warnings.push(
        `title was edited in the web app and is overwritten: "${existing.title}" → "${reportJson.title}"`,
      );
    }
    if (existing.description !== reportJson.description) {
      warnings.push('description was edited in the web app and is overwritten from report.json');
    }
    if (!sameList(existing.tags, reportJson.tags)) {
      warnings.push(
        `tags were edited in the web app and are overwritten: ${existing.tags.join(', ') || '(none)'} → ${reportJson.tags.join(', ') || '(none)'}`,
      );
    }
  }

  const ref = db.collection(COLLECTIONS.reports).doc(existingId);
  const batch = db.batch();
  batch.update(ref, {
    title: reportJson.title,
    description: reportJson.description,
    tags: reportJson.tags,
    slug,
    status,
    sizeBytes: built.bytes,
    updatedAt: now,
    updatedBy,
    ...(status === 'published' ? { publishedAt: now } : {}),
  });
  batch.set(ref.collection('content').doc(REPORT_CONTENT_DOC), {
    html: built.html,
    updatedAt: now,
  });
  await batch.commit();

  return {
    id: existingId,
    url: reportUrl(existingId),
    title: reportJson.title,
    status,
    bytes: built.bytes,
    viewerCount: existing.viewerEmails.length,
    externalCount: existing.externalEmails.length,
    created: false,
    warnings,
  };
}
