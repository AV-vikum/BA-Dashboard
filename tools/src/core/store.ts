// Firestore reads shared by publish/access/list commands (Admin SDK — rules are bypassed,
// the tools act as an admin).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  CONFIG_DOCS,
  normalizeEmail,
  type Group,
  type Report,
  type ReportJson,
  type TimestampLike,
  type WithId,
} from '@ba/shared';
import { readReportJson } from './build.js';
import { env, targetLabel } from './env.js';
import { assertEmulatorRunning, getDb } from './firebase.js';
import { reportFolder, resolveReportsDir } from './paths.js';

export interface AccessSettings {
  allowedDomains: string[];
  allowExternalSharing: boolean;
}

/** Call before any Firestore work: fails fast if the emulator isn't running. */
export async function connect() {
  await assertEmulatorRunning();
  return getDb();
}

export async function loadAccessConfig(): Promise<AccessSettings> {
  const db = await connect();
  const snap = await db.collection(COLLECTIONS.config).doc(CONFIG_DOCS.access).get();
  if (!snap.exists) {
    throw new Error(
      `config/access not found in ${targetLabel()} — run \`npm run setup\` (or \`npm run seed\` on the emulator)`,
    );
  }
  const data = snap.data() as Partial<AccessSettings>;
  return {
    allowedDomains: data.allowedDomains ?? [],
    allowExternalSharing: data.allowExternalSharing ?? false,
  };
}

export async function loadGroups(): Promise<WithId<Group>[]> {
  const db = await connect();
  const snap = await db.collection(COLLECTIONS.groups).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Group) }));
}

export async function loadReport(id: string): Promise<WithId<Report> | null> {
  const db = await connect();
  const snap = await db.collection(COLLECTIONS.reports).doc(id).get();
  return snap.exists ? { id: snap.id, ...(snap.data() as Report) } : null;
}

export async function loadAllReports(): Promise<WithId<Report>[]> {
  const db = await connect();
  const snap = await db.collection(COLLECTIONS.reports).orderBy('updatedAt', 'desc').get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Report) }));
}

/** Group names → ids (case-insensitive). Unknown names throw, listing the available groups. */
export function resolveGroupIds(names: string[], groups: WithId<Group>[]): string[] {
  return names.map((name) => {
    const match = groups.find((g) => g.name.toLowerCase() === name.trim().toLowerCase());
    if (!match) {
      const available = groups.map((g) => g.name).join(', ') || '(none)';
      throw new Error(`Unknown group "${name}". Available groups: ${available}`);
    }
    return match.id;
  });
}

export function groupNames(ids: string[], groups: WithId<Group>[]): string[] {
  return ids.map((id) => groups.find((g) => g.id === id)?.name ?? id);
}

/** applyAccessChange returns plain { toDate } objects; Firestore needs real Timestamps. */
export function toFirestoreExpiry(
  expiry: Record<string, TimestampLike | null>,
): Record<string, Timestamp | null> {
  return Object.fromEntries(
    Object.entries(expiry).map(([email, value]) => [
      email,
      value ? Timestamp.fromDate(value.toDate()) : null,
    ]),
  );
}

/** Local calendar date (YYYY-MM-DD) — expiry is "end of that day" in local time. */
export function toDateString(value: TimestampLike | null | undefined): string | null {
  if (!value) return null;
  const d = value.toDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The access block written to report.json by pull / after access changes. */
export function accessBlock(report: Report, groups: WithId<Group>[]): ReportJson['access'] {
  return {
    emails: [...report.directEmails].map(normalizeEmail).sort(),
    groups: groupNames(report.groupIds, groups),
    external: report.externalEmails.map((email) => ({
      email,
      expires: toDateString(report.externalExpiry[email]),
    })),
  };
}

export function reportUrl(id: string): string {
  return `${env.APP_URL.replace(/\/$/, '')}/r/${id}`;
}

export function reportsDir(): string {
  return resolveReportsDir(env);
}

/** The Firestore id this folder was published under for the current project, if any. */
export function publishedId(reportJson: ReportJson): string | null {
  return reportJson.reportIds[env.FIREBASE_PROJECT_ID] ?? null;
}

export interface ResolvedReport {
  report: WithId<Report>;
  /** Local folder, when the report has one in reports/. */
  folder: string | null;
}

/**
 * Accepts a folder slug (reports/<slug>/ with a published id for this project)
 * or a Firestore report id.
 */
export async function resolveReport(ref: string): Promise<ResolvedReport> {
  const trimmed = ref.trim();
  let folder: string | null = null;
  try {
    const candidate = reportFolder(reportsDir(), trimmed);
    if (existsSync(path.join(candidate, 'report.json'))) folder = candidate;
  } catch {
    // Not a valid slug — treat it as an id below.
  }

  if (folder) {
    const id = publishedId(readReportJson(folder));
    if (!id) {
      throw new Error(
        `reports/${trimmed} has not been published to ${targetLabel()} yet — publish it first`,
      );
    }
    const report = await loadReport(id);
    if (!report) throw new Error(`Report ${id} (reports/${trimmed}) not found in ${targetLabel()}`);
    return { report, folder };
  }

  const report = await loadReport(trimmed);
  if (!report) throw new Error(`No report folder or report id "${trimmed}" in ${targetLabel()}`);
  if (report.slug) {
    try {
      const candidate = reportFolder(reportsDir(), report.slug);
      if (existsSync(path.join(candidate, 'report.json'))) folder = candidate;
    } catch {
      // Stored slug isn't a valid folder name any more — no local folder.
    }
  }
  return { report, folder };
}
