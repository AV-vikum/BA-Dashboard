// All admin Firestore reads/writes — components never call Firestore
// directly (conventions.md §5). Every write sets updatedAt/updatedBy.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
  type WriteBatch,
} from 'firebase/firestore';
import {
  applyAccessChange,
  computeViewerEmails,
  COLLECTIONS,
  CONFIG_DOCS,
  LIMITS,
  normalizeDomain,
  normalizeEmail,
  REPORT_CONTENT_DOC,
  REPORT_MAX_BYTES,
  type AccessChange,
  type AccessConfig,
  type AdminsConfig,
  type Group,
  type Report,
  type ReportStatus,
  type UserProfile,
  type WithId,
} from '@ba/shared';
import { auth, db } from '@/lib/firebase';
import { byteLength, chunkOps, normalizeTags } from './admin-helpers';

function currentUpdatedBy(): string {
  const email = auth.currentUser?.email;
  return email ? normalizeEmail(email) : 'unknown';
}

function toWithId<T>(snap: { id: string; data(): unknown }): WithId<T> {
  return { id: snap.id, ...(snap.data() as T) };
}

// Runs a list of batch operations in chunks of at most BATCH_LIMIT.
async function commitInChunks(ops: ((batch: WriteBatch) => void)[]): Promise<void> {
  for (const chunk of chunkOps(ops)) {
    const batch = writeBatch(db);
    for (const op of chunk) op(batch);
    await batch.commit();
  }
}

export class ReportTooLargeError extends Error {
  readonly sizeBytes: number;

  constructor(sizeBytes: number) {
    super(`Report HTML is ${sizeBytes} bytes, over the ${REPORT_MAX_BYTES}-byte limit.`);
    this.name = 'ReportTooLargeError';
    this.sizeBytes = sizeBytes;
  }
}

// ---------------------------------------------------------------------------
// Reads (live)
//
// subscribeAllReports and subscribeReport (every report incl. drafts, and
// one report by id) already exist in ./reports.ts and are reused here —
// re-exported so admin pages only need to import from this module.
// ---------------------------------------------------------------------------

export { subscribeAllReports, subscribeReport } from './reports';

export function subscribeGroups(
  cb: (groups: WithId<Group>[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, COLLECTIONS.groups),
    (snap) => cb(snap.docs.map((d) => toWithId<Group>(d))),
    (error) => onError?.(error),
  );
}

export function subscribeUserProfiles(
  cb: (profiles: WithId<UserProfile>[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, COLLECTIONS.users),
    (snap) => cb(snap.docs.map((d) => toWithId<UserProfile>(d))),
    (error) => onError?.(error),
  );
}

export function subscribeAccessConfig(
  cb: (config: AccessConfig | null) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, COLLECTIONS.config, CONFIG_DOCS.access),
    (snap) => cb(snap.exists() ? (snap.data() as AccessConfig) : null),
    (error) => onError?.(error),
  );
}

export function subscribeAdmins(
  cb: (admins: AdminsConfig | null) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, COLLECTIONS.config, CONFIG_DOCS.admins),
    (snap) => cb(snap.exists() ? (snap.data() as AdminsConfig) : null),
    (error) => onError?.(error),
  );
}

// ---------------------------------------------------------------------------
// Reports: create / replace / details / status / delete
// ---------------------------------------------------------------------------

export interface CreateReportInput {
  title: string;
  description: string;
  tags: string[];
  html: string;
}

// New reports start as drafts with no access — the admin adds people and
// publishes explicitly (step 4.4/4.6).
export async function createReportFromHtml(input: CreateReportInput): Promise<string> {
  const sizeBytes = byteLength(input.html);
  if (sizeBytes > REPORT_MAX_BYTES) throw new ReportTooLargeError(sizeBytes);

  const updatedBy = currentUpdatedBy();
  const reportRef = doc(collection(db, COLLECTIONS.reports));
  const now = serverTimestamp();

  const batch = writeBatch(db);
  batch.set(reportRef, {
    title: input.title.trim(),
    description: input.description,
    tags: normalizeTags(input.tags),
    slug: null,
    status: 'draft' satisfies ReportStatus,
    directEmails: [],
    groupIds: [],
    viewerEmails: [],
    externalEmails: [],
    externalExpiry: {},
    sizeBytes,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    createdBy: updatedBy,
    updatedBy,
  });
  batch.set(doc(reportRef, 'content', REPORT_CONTENT_DOC), { html: input.html, updatedAt: now });
  await batch.commit();

  return reportRef.id;
}

export async function replaceReportHtml(id: string, html: string): Promise<void> {
  const sizeBytes = byteLength(html);
  if (sizeBytes > REPORT_MAX_BYTES) throw new ReportTooLargeError(sizeBytes);

  const updatedBy = currentUpdatedBy();
  const now = serverTimestamp();
  const reportRef = doc(db, COLLECTIONS.reports, id);

  const batch = writeBatch(db);
  batch.set(doc(reportRef, 'content', REPORT_CONTENT_DOC), { html, updatedAt: now });
  batch.update(reportRef, { sizeBytes, updatedAt: now, updatedBy });
  await batch.commit();
}

export interface ReportDetailsInput {
  title: string;
  description: string;
  tags: string[];
}

export async function updateReportDetails(id: string, details: ReportDetailsInput): Promise<void> {
  const title = details.title.trim();
  if (title.length < 1 || title.length > LIMITS.titleMax) {
    throw new Error(`Title must be 1–${LIMITS.titleMax} characters.`);
  }
  if (details.description.length > LIMITS.descriptionMax) {
    throw new Error(`Description must be at most ${LIMITS.descriptionMax} characters.`);
  }

  await updateDoc(doc(db, COLLECTIONS.reports, id), {
    title,
    description: details.description,
    tags: normalizeTags(details.tags),
    updatedAt: serverTimestamp(),
    updatedBy: currentUpdatedBy(),
  });
}

export async function setReportStatus(id: string, status: ReportStatus): Promise<void> {
  const now = serverTimestamp();
  await updateDoc(doc(db, COLLECTIONS.reports, id), {
    status,
    updatedAt: now,
    updatedBy: currentUpdatedBy(),
    ...(status === 'published' ? { publishedAt: now } : {}),
  });
}

export async function deleteReport(id: string): Promise<void> {
  const reportRef = doc(db, COLLECTIONS.reports, id);
  const batch = writeBatch(db);
  batch.delete(doc(reportRef, 'content', REPORT_CONTENT_DOC));
  batch.delete(reportRef);
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

export async function updateReportAccess(
  id: string,
  change: AccessChange,
): Promise<{ warnings: string[] }> {
  const [reportSnap, groupsSnap, accessSnap] = await Promise.all([
    getDoc(doc(db, COLLECTIONS.reports, id)),
    getDocs(collection(db, COLLECTIONS.groups)),
    getDoc(doc(db, COLLECTIONS.config, CONFIG_DOCS.access)),
  ]);
  if (!reportSnap.exists()) throw new Error('Report not found.');

  const report = reportSnap.data() as Report;
  const groups = groupsSnap.docs.map((d) => toWithId<Group>(d));
  const allowedDomains = accessSnap.exists()
    ? (accessSnap.data() as AccessConfig).allowedDomains
    : [];

  const result = applyAccessChange(report, change, groups, allowedDomains);
  await updateDoc(doc(db, COLLECTIONS.reports, id), {
    directEmails: result.directEmails,
    groupIds: result.groupIds,
    viewerEmails: result.viewerEmails,
    externalEmails: result.externalEmails,
    externalExpiry: result.externalExpiry,
    updatedAt: serverTimestamp(),
    updatedBy: currentUpdatedBy(),
  });

  return { warnings: result.warnings };
}

// Removes every expired external entry from every report. Returns the
// number of reports updated.
export async function cleanupExpiredExternal(): Promise<number> {
  const now = new Date();
  const reportsSnap = await getDocs(collection(db, COLLECTIONS.reports));
  const updatedBy = currentUpdatedBy();

  const ops: ((batch: WriteBatch) => void)[] = [];
  for (const reportDoc of reportsSnap.docs) {
    const report = reportDoc.data() as Report;
    const expiredSet = new Set(
      report.externalEmails.map(normalizeEmail).filter((email) => {
        const expiry = report.externalExpiry[email];
        return expiry != null && expiry.toDate() <= now;
      }),
    );
    if (expiredSet.size === 0) continue;

    const externalEmails = report.externalEmails.filter((e) => !expiredSet.has(normalizeEmail(e)));
    const externalExpiry = Object.fromEntries(
      Object.entries(report.externalExpiry).filter(([email]) => !expiredSet.has(email)),
    );

    ops.push((batch) =>
      batch.update(reportDoc.ref, {
        externalEmails,
        externalExpiry,
        updatedAt: serverTimestamp(),
        updatedBy,
      }),
    );
  }

  await commitInChunks(ops);
  return ops.length;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export interface SaveGroupInput {
  id?: string; // present = update, absent = create
  name: string;
  description: string;
  memberEmails: string[];
}

// Recomputes viewerEmails for every report using this group, since
// membership may have changed (architecture.md §A7). Returns the number of
// reports updated.
export async function saveGroup(input: SaveGroupInput): Promise<{ reportsUpdated: number }> {
  const name = input.name.trim();
  if (!name) throw new Error('Group name is required.');

  const updatedBy = currentUpdatedBy();
  const now = serverTimestamp();
  const memberEmails = [...new Set(input.memberEmails.map(normalizeEmail))].sort();

  const groupRef = input.id
    ? doc(db, COLLECTIONS.groups, input.id)
    : doc(collection(db, COLLECTIONS.groups));
  const groupId = groupRef.id;

  const [reportsSnap, allGroupsSnap] = await Promise.all([
    input.id
      ? getDocs(
          query(collection(db, COLLECTIONS.reports), where('groupIds', 'array-contains', groupId)),
        )
      : Promise.resolve(null),
    getDocs(collection(db, COLLECTIONS.groups)),
  ]);

  // The updated membership, as it will be after this write — used to
  // recompute viewerEmails for affected reports below.
  const groups = allGroupsSnap.docs.map((d) => toWithId<Group>(d));
  const groupIndex = groups.findIndex((g) => g.id === groupId);
  const updatedGroup: WithId<Group> = {
    id: groupId,
    name,
    description: input.description,
    memberEmails,
    createdAt: groups[groupIndex]?.createdAt ?? { toDate: () => new Date() },
    updatedAt: { toDate: () => new Date() },
    updatedBy,
  };
  if (groupIndex >= 0) groups[groupIndex] = updatedGroup;
  else groups.push(updatedGroup);

  const ops: ((batch: WriteBatch) => void)[] = [];
  ops.push((batch) =>
    batch.set(
      groupRef,
      {
        name,
        description: input.description,
        memberEmails,
        createdAt: now,
        updatedAt: now,
        updatedBy,
      },
      { merge: true },
    ),
  );
  for (const reportDoc of reportsSnap?.docs ?? []) {
    const report = reportDoc.data() as Report;
    const viewerEmails = computeViewerEmails(report.directEmails, report.groupIds, groups);
    ops.push((batch) => batch.update(reportDoc.ref, { viewerEmails, updatedAt: now, updatedBy }));
  }
  await commitInChunks(ops);

  return { reportsUpdated: reportsSnap?.docs.length ?? 0 };
}

// Removes the group from every report that used it, recomputes access,
// then deletes the group. Returns the number of reports updated.
export async function deleteGroup(id: string): Promise<{ reportsUpdated: number }> {
  const updatedBy = currentUpdatedBy();
  const now = serverTimestamp();

  const [reportsSnap, allGroupsSnap] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.reports), where('groupIds', 'array-contains', id))),
    getDocs(collection(db, COLLECTIONS.groups)),
  ]);
  const remainingGroups = allGroupsSnap.docs
    .map((d) => toWithId<Group>(d))
    .filter((g) => g.id !== id);

  const ops: ((batch: WriteBatch) => void)[] = [];
  for (const reportDoc of reportsSnap.docs) {
    const report = reportDoc.data() as Report;
    const groupIds = report.groupIds.filter((g) => g !== id);
    const viewerEmails = computeViewerEmails(report.directEmails, groupIds, remainingGroups);
    ops.push((batch) =>
      batch.update(reportDoc.ref, { groupIds, viewerEmails, updatedAt: now, updatedBy }),
    );
  }
  ops.push((batch) => batch.delete(doc(db, COLLECTIONS.groups, id)));
  await commitInChunks(ops);

  return { reportsUpdated: reportsSnap.docs.length };
}

// ---------------------------------------------------------------------------
// Config: allowed domains / external sharing, admins
// ---------------------------------------------------------------------------

export interface AccessConfigPatch {
  allowedDomains?: string[];
  allowExternalSharing?: boolean;
}

export async function updateAccessConfig(patch: AccessConfigPatch): Promise<void> {
  const update: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedBy: currentUpdatedBy(),
  };
  if (patch.allowedDomains) {
    const domains = [...new Set(patch.allowedDomains.map(normalizeDomain))];
    if (domains.length === 0) throw new Error('At least one allowed domain is required.');
    update.allowedDomains = domains;
  }
  if (patch.allowExternalSharing !== undefined) {
    update.allowExternalSharing = patch.allowExternalSharing;
  }
  await updateDoc(doc(db, COLLECTIONS.config, CONFIG_DOCS.access), update);
}

export async function updateAdmins(emails: string[]): Promise<void> {
  const normalized = [...new Set(emails.map(normalizeEmail))];
  if (normalized.length === 0) throw new Error('At least one admin is required.');
  await updateDoc(doc(db, COLLECTIONS.config, CONFIG_DOCS.admins), {
    emails: normalized,
    updatedAt: serverTimestamp(),
    updatedBy: currentUpdatedBy(),
  });
}
