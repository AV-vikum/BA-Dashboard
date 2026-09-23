// Firestore document shapes, shared by the web app (Firebase JS SDK) and
// tools (Admin SDK). See docs/plan/architecture.md#a5-data-model-firestore.

// Both SDKs' Timestamp classes have this method; using it instead of
// importing either SDK keeps this file dependency-free.
export interface TimestampLike {
  toDate(): Date;
}

export type WithId<T> = T & { id: string };

export type ReportStatus = 'draft' | 'published';

export interface AccessConfig {
  allowedDomains: string[]; // lower-case, no "@"
  allowExternalSharing: boolean;
  updatedAt: TimestampLike;
  updatedBy: string;
}

export interface AdminsConfig {
  emails: string[];
  updatedAt: TimestampLike;
  updatedBy: string;
}

export interface UserProfile {
  email: string;
  displayName: string | null;
  photoURL: string | null;
  lastLoginAt: TimestampLike;
}

export interface Group {
  name: string; // unique, case-insensitive
  description: string;
  memberEmails: string[]; // internal emails only
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  updatedBy: string;
}

export interface Report {
  title: string; // 1–120 chars
  description: string; // 0–500 chars
  tags: string[]; // lower-case, max 10
  slug: string | null; // local folder name when published via CLI/MCP; null if created in the web UI
  status: ReportStatus;
  directEmails: string[]; // internal people assigned individually
  groupIds: string[];
  viewerEmails: string[]; // COMPUTED: directEmails ∪ members of groupIds (see computeViewerEmails)
  externalEmails: string[]; // outside people
  externalExpiry: Record<string, TimestampLike | null>; // key = external email; null = no expiry
  sizeBytes: number;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  publishedAt: TimestampLike | null;
  createdBy: string;
  updatedBy: string;
}

export interface ReportContent {
  html: string;
  updatedAt: TimestampLike;
}
