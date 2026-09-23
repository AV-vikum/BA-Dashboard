// Access computation: who can see a report. viewerEmails is always derived
// from directEmails + group membership by computeViewerEmails() — never
// edited by hand (see architecture.md#a7-access-semantics).
import { isInternalEmail, normalizeEmail } from './email.js';
import type { Group, Report, TimestampLike, WithId } from './types.js';

export function computeViewerEmails(
  directEmails: string[],
  groupIds: string[],
  groups: WithId<Group>[],
): string[] {
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const memberEmails = groupIds.flatMap((id) => groupById.get(id)?.memberEmails ?? []);
  const all = [...directEmails, ...memberEmails].map(normalizeEmail);
  return [...new Set(all)].sort();
}

export function isExternalActive(
  report: Pick<Report, 'externalEmails' | 'externalExpiry'>,
  email: string,
  now: Date = new Date(),
): boolean {
  const normalized = normalizeEmail(email);
  if (!report.externalEmails.some((e) => normalizeEmail(e) === normalized)) return false;
  const expiry = report.externalExpiry[normalized];
  if (expiry === undefined || expiry === null) return true;
  return expiry.toDate() > now;
}

export interface AccessChange {
  addEmails?: string[];
  removeEmails?: string[];
  addGroupIds?: string[];
  removeGroupIds?: string[];
  addExternal?: { email: string; expires: Date | null }[];
  removeExternal?: string[];
}

export interface AccessResult {
  directEmails: string[];
  groupIds: string[];
  viewerEmails: string[];
  externalEmails: string[];
  externalExpiry: Record<string, TimestampLike | null>;
  warnings: string[];
}

function timestampLike(date: Date): TimestampLike {
  return { toDate: () => date };
}

// Applies an access change to a report's current access fields, recomputing
// viewerEmails from the result. Emails outside allowedDomains are rejected
// from directEmails (with a warning) rather than silently granted access —
// they must be added as external instead.
export function applyAccessChange(
  report: Pick<Report, 'directEmails' | 'groupIds' | 'externalEmails' | 'externalExpiry'>,
  change: AccessChange,
  groups: WithId<Group>[],
  allowedDomains: string[],
): AccessResult {
  const warnings: string[] = [];

  const removeEmailSet = new Set((change.removeEmails ?? []).map(normalizeEmail));
  let directEmails = report.directEmails.map(normalizeEmail).filter((e) => !removeEmailSet.has(e));

  for (const raw of change.addEmails ?? []) {
    const email = normalizeEmail(raw);
    if (!isInternalEmail(email, allowedDomains)) {
      warnings.push(`${email} is outside allowed domains — add as external instead`);
      continue;
    }
    if (!directEmails.includes(email)) directEmails.push(email);
  }
  directEmails = [...new Set(directEmails)].sort();

  const removeGroupSet = new Set(change.removeGroupIds ?? []);
  let groupIds = report.groupIds.filter((id) => !removeGroupSet.has(id));
  for (const id of change.addGroupIds ?? []) {
    if (!groupIds.includes(id)) groupIds.push(id);
  }
  groupIds = [...new Set(groupIds)].sort();

  const removeExternalSet = new Set((change.removeExternal ?? []).map(normalizeEmail));
  let externalEmails = report.externalEmails
    .map(normalizeEmail)
    .filter((e) => !removeExternalSet.has(e));
  const externalExpiry: Record<string, TimestampLike | null> = {};
  for (const [email, expiry] of Object.entries(report.externalExpiry)) {
    const normalized = normalizeEmail(email);
    if (removeExternalSet.has(normalized)) continue;
    if (externalEmails.includes(normalized)) externalExpiry[normalized] = expiry;
  }

  for (const entry of change.addExternal ?? []) {
    const email = normalizeEmail(entry.email);
    if (!externalEmails.includes(email)) externalEmails.push(email);
    externalExpiry[email] = entry.expires ? timestampLike(entry.expires) : null;
  }
  externalEmails = [...new Set(externalEmails)].sort();

  const viewerEmails = computeViewerEmails(directEmails, groupIds, groups);

  return { directEmails, groupIds, viewerEmails, externalEmails, externalExpiry, warnings };
}

export interface AccessSummary {
  internalCount: number;
  externalCount: number;
  expiredExternal: string[];
}

export function accessSummary(
  report: Pick<Report, 'viewerEmails' | 'externalEmails' | 'externalExpiry'>,
  now: Date = new Date(),
): AccessSummary {
  const expiredExternal = report.externalEmails.filter((raw) => {
    const email = normalizeEmail(raw);
    const expiry = report.externalExpiry[email];
    return expiry != null && expiry.toDate() <= now;
  });

  return {
    internalCount: report.viewerEmails.length,
    externalCount: report.externalEmails.length,
    expiredExternal,
  };
}

export type VisibleReport<T> = { report: T; via: 'internal' | 'external' };

// Mirrors the Security Rules read conditions exactly (architecture.md
// §A6): admins see everything; an internal viewer sees published reports
// where their email is in viewerEmails; an external viewer sees published
// reports where their email is in externalEmails, external sharing is on,
// and their access hasn't expired. Used by the People sheet (4.7) and
// View as user (4.10) so both agree with what a user would actually see.
export function reportsVisibleTo<
  T extends Pick<Report, 'status' | 'viewerEmails' | 'externalEmails' | 'externalExpiry'>,
>(
  email: string,
  reports: T[],
  options: { isAdmin: boolean; isInternal: boolean; allowExternalSharing: boolean },
  now: Date = new Date(),
): VisibleReport<T>[] {
  const normalized = normalizeEmail(email);

  if (options.isAdmin) {
    return reports
      .filter((r) => r.status === 'published')
      .map((report) => ({ report, via: 'internal' as const }));
  }

  const result: VisibleReport<T>[] = [];
  for (const report of reports) {
    if (report.status !== 'published') continue;

    if (options.isInternal && report.viewerEmails.some((e) => normalizeEmail(e) === normalized)) {
      result.push({ report, via: 'internal' });
      continue;
    }

    if (
      options.allowExternalSharing &&
      report.externalEmails.some((e) => normalizeEmail(e) === normalized) &&
      isExternalActive(report, normalized, now)
    ) {
      result.push({ report, via: 'external' });
    }
  }
  return result;
}
