// Shared setup for firestore.rules tests: one emulator test environment,
// per-user authenticated Firestore clients, and a seed() that writes fixture
// data with security rules disabled (the way the Admin SDK bootstraps
// config/* and reports in real setup/seed/publish scripts).
import { readFileSync } from 'node:fs';
import { type RulesTestEnvironment, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp } from 'firebase/firestore';

export const PROJECT_ID = 'demo-ba-dashboard-rules';

export async function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
}

// A stable, deterministic fake uid — rules never look at the uid itself
// (they key off request.auth.token.email), so any unique string per email
// is fine.
export function uidFromEmail(email: string): string {
  return `uid-${email.replace(/[^a-z0-9]/gi, '-')}`;
}

export function authedFirestore(
  testEnv: RulesTestEnvironment,
  email: string,
  { verified = true }: { verified?: boolean } = {},
) {
  return testEnv
    .authenticatedContext(uidFromEmail(email), { email, email_verified: verified })
    .firestore();
}

export const ADMIN_EMAIL = 'admin@example.com';
export const ALLOWED_DOMAIN = 'example.com';
export const OTHER_ALLOWED_EMAIL = 'nobody@other-allowed.test'; // used for the "not internal" domain case
export const GROUP_ID = 'group-finance';
export const GROUP_MEMBER_EMAIL = 'bob@example.com';

export const PUBLISHED_REPORT_ID = 'report-published';
export const PUBLISHED_REPORT_DIRECT_EMAIL = 'alice@example.com';
export const DRAFT_REPORT_ID = 'report-draft';
export const UNASSIGNED_INTERNAL_EMAIL = 'eve@example.com'; // internal, not on any report
export const OTHER_DOMAIN_LISTED_EMAIL = 'carol@other.test'; // in viewerEmails but domain not allowed

export const EXTERNAL_EMAIL = 'ext@outside.test';
export const EXTERNAL_NO_EXPIRY_REPORT_ID = 'report-external-no-expiry';
export const EXTERNAL_FUTURE_REPORT_ID = 'report-external-future';
export const EXTERNAL_PAST_REPORT_ID = 'report-external-past';

const YESTERDAY = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
const TOMORROW = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);

interface ReportFixture {
  id: string;
  status: 'draft' | 'published';
  directEmails: string[];
  groupIds: string[];
  viewerEmails: string[];
  externalEmails: string[];
  externalExpiry: Record<string, Timestamp | null>;
}

const REPORTS: ReportFixture[] = [
  {
    id: PUBLISHED_REPORT_ID,
    status: 'published',
    directEmails: [PUBLISHED_REPORT_DIRECT_EMAIL],
    groupIds: [GROUP_ID],
    viewerEmails: [PUBLISHED_REPORT_DIRECT_EMAIL, GROUP_MEMBER_EMAIL, OTHER_DOMAIN_LISTED_EMAIL],
    externalEmails: [],
    externalExpiry: {},
  },
  {
    id: DRAFT_REPORT_ID,
    status: 'draft',
    directEmails: [PUBLISHED_REPORT_DIRECT_EMAIL],
    groupIds: [],
    viewerEmails: [PUBLISHED_REPORT_DIRECT_EMAIL],
    externalEmails: [],
    externalExpiry: {},
  },
  {
    id: EXTERNAL_NO_EXPIRY_REPORT_ID,
    status: 'published',
    directEmails: [],
    groupIds: [],
    viewerEmails: [],
    externalEmails: [EXTERNAL_EMAIL],
    externalExpiry: { [EXTERNAL_EMAIL]: null },
  },
  {
    id: EXTERNAL_FUTURE_REPORT_ID,
    status: 'published',
    directEmails: [],
    groupIds: [],
    viewerEmails: [],
    externalEmails: [EXTERNAL_EMAIL],
    externalExpiry: { [EXTERNAL_EMAIL]: TOMORROW },
  },
  {
    id: EXTERNAL_PAST_REPORT_ID,
    status: 'published',
    directEmails: [],
    groupIds: [],
    viewerEmails: [],
    externalEmails: [EXTERNAL_EMAIL],
    externalExpiry: { [EXTERNAL_EMAIL]: YESTERDAY },
  },
];

export interface SeedOptions {
  allowExternalSharing?: boolean;
  allowedDomains?: string[];
}

export async function seed(
  testEnv: RulesTestEnvironment,
  { allowExternalSharing = true, allowedDomains = [ALLOWED_DOMAIN] }: SeedOptions = {},
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const now = Timestamp.now();

    await db.doc('config/access').set({
      allowedDomains,
      allowExternalSharing,
      updatedAt: now,
      updatedBy: `cli:${ADMIN_EMAIL}`,
    });
    await db.doc('config/admins').set({
      emails: [ADMIN_EMAIL],
      updatedAt: now,
      updatedBy: `cli:${ADMIN_EMAIL}`,
    });
    await db.doc(`groups/${GROUP_ID}`).set({
      name: 'Finance',
      description: 'Finance team',
      memberEmails: [GROUP_MEMBER_EMAIL],
      createdAt: now,
      updatedAt: now,
      updatedBy: `cli:${ADMIN_EMAIL}`,
    });

    for (const report of REPORTS) {
      await db.doc(`reports/${report.id}`).set({
        title: report.id,
        description: '',
        tags: [],
        slug: null,
        status: report.status,
        directEmails: report.directEmails,
        groupIds: report.groupIds,
        viewerEmails: report.viewerEmails,
        externalEmails: report.externalEmails,
        externalExpiry: report.externalExpiry,
        sizeBytes: 0,
        createdAt: now,
        updatedAt: now,
        publishedAt: report.status === 'published' ? now : null,
        createdBy: `cli:${ADMIN_EMAIL}`,
        updatedBy: `cli:${ADMIN_EMAIL}`,
      });
      await db.doc(`reports/${report.id}/content/main`).set({
        html: `<p>${report.id}</p>`,
        updatedAt: now,
      });
    }
  });
}
