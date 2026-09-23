// Changing and showing who can view a report (CLI `report access`, MCP set_access / get_access).
import { FieldValue } from 'firebase-admin/firestore';
import {
  applyAccessChange,
  COLLECTIONS,
  expiryDateToDate,
  isExternalActive,
  normalizeEmail,
  type Group,
  type Report,
  type WithId,
} from '@ba/shared';
import { env } from './env.js';
import { updateReportJsonFile } from './report-folder.js';
import {
  accessBlock,
  connect,
  groupNames,
  loadAccessConfig,
  loadGroups,
  loadReport,
  resolveGroupIds,
  resolveReport,
  toDateString,
  toFirestoreExpiry,
} from './store.js';

export interface AccessInput {
  addEmails?: string[];
  removeEmails?: string[];
  addGroups?: string[]; // group names
  removeGroups?: string[];
  addExternal?: { email: string; expires?: string | null }[]; // expires: YYYY-MM-DD
  removeExternal?: string[];
}

export interface AccessView {
  id: string;
  title: string;
  status: Report['status'];
  direct: string[];
  groups: { name: string; members: number }[];
  external: { email: string; expires: string | null; active: boolean }[];
  viewerCount: number;
  externalSharingOn: boolean;
}

function view(
  report: WithId<Report>,
  groups: WithId<Group>[],
  externalSharingOn: boolean,
): AccessView {
  return {
    id: report.id,
    title: report.title,
    status: report.status,
    direct: report.directEmails,
    groups: report.groupIds.map((id) => ({
      name: groupNames([id], groups)[0] ?? id,
      members: groups.find((g) => g.id === id)?.memberEmails.length ?? 0,
    })),
    external: report.externalEmails.map((email) => ({
      email,
      expires: toDateString(report.externalExpiry[email]),
      active: isExternalActive(report, email),
    })),
    viewerCount: report.viewerEmails.length,
    externalSharingOn,
  };
}

export async function getAccess(ref: string): Promise<AccessView> {
  const [{ report }, groups, config] = await Promise.all([
    resolveReport(ref),
    loadGroups(),
    loadAccessConfig(),
  ]);
  return view(report, groups, config.allowExternalSharing);
}

export interface AccessChangeResult {
  view: AccessView;
  added: number;
  removed: number;
  warnings: string[];
}

export async function updateAccess(ref: string, input: AccessInput): Promise<AccessChangeResult> {
  const { report, folder } = await resolveReport(ref);
  const [groups, config] = await Promise.all([loadGroups(), loadAccessConfig()]);

  const result = applyAccessChange(
    report,
    {
      addEmails: input.addEmails,
      removeEmails: input.removeEmails,
      addGroupIds: resolveGroupIds(input.addGroups ?? [], groups),
      removeGroupIds: resolveGroupIds(input.removeGroups ?? [], groups),
      addExternal: (input.addExternal ?? []).map((e) => ({
        email: e.email,
        expires: e.expires ? expiryDateToDate(e.expires) : null,
      })),
      removeExternal: input.removeExternal,
    },
    groups,
    config.allowedDomains,
  );
  const warnings = [...result.warnings];
  for (const email of input.removeEmails ?? []) {
    const normalized = normalizeEmail(email);
    if (!report.directEmails.includes(normalized) && result.viewerEmails.includes(normalized)) {
      warnings.push(
        `${normalized} still has access through a group — remove them from the group instead`,
      );
    }
  }
  for (const e of input.addExternal ?? []) {
    if (e.expires && expiryDateToDate(e.expires) < new Date()) {
      warnings.push(
        `${normalizeEmail(e.email)}: expiry ${e.expires} is in the past — they cannot open it`,
      );
    }
  }
  if (input.addExternal?.length && !config.allowExternalSharing) {
    warnings.push('external sharing is turned off in Settings — external people cannot open it');
  }

  const db = await connect();
  await db
    .collection(COLLECTIONS.reports)
    .doc(report.id)
    .update({
      directEmails: result.directEmails,
      groupIds: result.groupIds,
      viewerEmails: result.viewerEmails,
      externalEmails: result.externalEmails,
      externalExpiry: toFirestoreExpiry(result.externalExpiry),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: `cli:${env.PUBLISHER_EMAIL}`,
    });

  const updated = (await loadReport(report.id)) ?? report;
  // Keep the local folder's report.json in step with what is live.
  if (folder) updateReportJsonFile(folder, { access: accessBlock(updated, groups) });

  const before = new Set([...report.viewerEmails, ...report.externalEmails]);
  const after = new Set([...updated.viewerEmails, ...updated.externalEmails]);
  return {
    view: view(updated, groups, config.allowExternalSharing),
    added: [...after].filter((e) => !before.has(e)).length,
    removed: [...before].filter((e) => !after.has(e)).length,
    warnings,
  };
}
