// Pure helpers used by admin.ts, split out so they're unit-testable without
// touching Firestore (conventions.md's Firestore-touching functions are
// verified manually — see step 4.2).
import { LIMITS } from '@ba/shared';

// Firestore batches are capped at 500 operations (conventions.md §5).
export const BATCH_LIMIT = 500;

export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

export function normalizeTags(tags: string[]): string[] {
  const normalized = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  return normalized.slice(0, LIMITS.tagsMax);
}

// Splits a flat list of operations into chunks of at most BATCH_LIMIT, so
// callers can commit one Firestore batch per chunk.
export function chunkOps<T>(ops: T[], limit: number = BATCH_LIMIT): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < ops.length; i += limit) {
    chunks.push(ops.slice(i, i + limit));
  }
  return chunks;
}
