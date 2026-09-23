// Fixed values shared by the web app and tools — collection/doc names,
// the emulator's demo project ID, and hard limits enforced in several places.

export const DEMO_PROJECT_ID = 'demo-ba-dashboard';

export const COLLECTIONS = {
  config: 'config',
  users: 'users',
  groups: 'groups',
  reports: 'reports',
} as const;

export const CONFIG_DOCS = { access: 'access', admins: 'admins' } as const;

export const REPORT_CONTENT_DOC = 'main';

// Firestore's per-document limit is 1 MiB; this leaves headroom for the
// rest of the report metadata document's fields.
export const REPORT_MAX_BYTES = 900_000;

export const LIMITS = { titleMax: 120, descriptionMax: 500, tagsMax: 10, tagMax: 30 } as const;
