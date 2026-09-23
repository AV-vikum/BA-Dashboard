// All Firestore reads/writes for reports live here — components never call
// Firestore directly (conventions.md §5).
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { COLLECTIONS, type Report, type WithId } from '@ba/shared';
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
