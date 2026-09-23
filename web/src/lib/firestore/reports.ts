// All Firestore reads/writes for reports live here — components never call
// Firestore directly (conventions.md §5).
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  COLLECTIONS,
  REPORT_CONTENT_DOC,
  type Report,
  type ReportContent,
  type WithId,
} from '@ba/shared';
import { db } from '@/lib/firebase';

function toReport(snap: { id: string; data(): unknown }): WithId<Report> {
  return { id: snap.id, ...(snap.data() as Report) };
}

// Internal users: reports directly/group-assigned to them (viewerEmails).
// External users: reports shared with their email (externalEmails) — the
// caller still needs to filter out expired ones with isExternalActive,
// since a list query can't check expiry (see architecture.md §A6).
export function subscribeMyReports(
  email: string,
  isInternal: boolean,
  cb: (reports: WithId<Report>[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const field = isInternal ? 'viewerEmails' : 'externalEmails';
  const q = query(
    collection(db, COLLECTIONS.reports),
    where(field, 'array-contains', email),
    where('status', '==', 'published'),
    orderBy('updatedAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(toReport)),
    (error) => onError?.(error),
  );
}

// Admins: every report (published and draft) — they manage everything.
export function subscribeAllReports(
  cb: (reports: WithId<Report>[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTIONS.reports), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(toReport)),
    (error) => onError?.(error),
  );
}

// Live metadata for one report — so unpublishing it while a viewer has it
// open takes effect immediately (see step 3.8's error states).
export function subscribeReport(
  id: string,
  cb: (report: WithId<Report> | null) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, COLLECTIONS.reports, id),
    (snap) => cb(snap.exists() ? toReport(snap) : null),
    (error) => onError?.(error),
  );
}

// One-time read of the report's HTML. Fetched separately from metadata
// (a much bigger document) and only once the metadata read has confirmed
// access, per architecture.md §A5.
export async function getReportContent(id: string): Promise<ReportContent | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.reports, id, 'content', REPORT_CONTENT_DOC));
  return snap.exists() ? (snap.data() as ReportContent) : null;
}
