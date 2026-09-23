// Loads demo data into the emulator: access config, two groups, and five
// reports covering published/draft/group/direct/external/expired access.
//
// Emulator target only — refuses to run against production. Idempotent:
// every document uses a fixed ID and is overwritten on each run.
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { computeViewerEmails, type Group, type WithId } from '@ba/shared';
import { assertEmulatorRunning, getDb } from '../core/firebase.js';
import { env } from '../core/env.js';

if (env.target !== 'emulator') {
  console.error('✗ npm run seed only runs against the emulator (BA_TARGET=production refused).');
  process.exit(1);
}

const GROUPS: Record<
  string,
  Omit<WithId<Group>, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>
> = {
  'demo-finance': {
    name: 'Finance',
    description: 'Finance team',
    memberEmails: ['alice@example.com', 'bob@example.com'],
  },
  'demo-management': {
    name: 'Management',
    description: 'Management team',
    memberEmails: ['carol@example.com'],
  },
};

function placeholderHtml(title: string): string {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>${title}</title></head>
  <body>
    <h1>${title}</h1>
    <p>This is placeholder demo data — replaced by the real example report in step 5.7.</p>
    <script>document.body.appendChild(document.createTextNode('Rendered at: ' + new Date().toISOString()));</script>
  </body>
</html>`;
}

const YESTERDAY = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);

interface ReportSeed {
  id: string;
  title: string;
  status: 'draft' | 'published';
  directEmails: string[];
  groupIds: string[];
  externalEmails: string[];
  externalExpiry: Record<string, Timestamp | null>;
}

const REPORTS: ReportSeed[] = [
  {
    id: 'demo-sales',
    title: 'Sales Overview',
    status: 'published',
    directEmails: ['dave@example.com'],
    groupIds: ['demo-finance'],
    externalEmails: [],
    externalExpiry: {},
  },
  {
    id: 'demo-hr',
    title: 'HR Headcount',
    status: 'published',
    directEmails: [],
    groupIds: ['demo-management'],
    externalEmails: [],
    externalExpiry: {},
  },
  {
    id: 'demo-draft',
    title: 'Budget Draft',
    status: 'draft',
    directEmails: [],
    groupIds: ['demo-finance'],
    externalEmails: [],
    externalExpiry: {},
  },
  {
    id: 'demo-partner',
    title: 'Partner Summary',
    status: 'published',
    directEmails: [],
    groupIds: ['demo-finance'],
    externalEmails: ['partner@outside.test'],
    externalExpiry: { 'partner@outside.test': null },
  },
  {
    id: 'demo-expired',
    title: 'Old Partner Report',
    status: 'published',
    directEmails: [],
    groupIds: [],
    externalEmails: ['partner@outside.test'],
    externalExpiry: { 'partner@outside.test': YESTERDAY },
  },
];

async function main(): Promise<void> {
  await assertEmulatorRunning();
  const db = getDb();
  const updatedBy = `cli:${env.PUBLISHER_EMAIL}`;
  const now = FieldValue.serverTimestamp();

  await db.doc('config/access').set({
    allowedDomains: ['example.com'],
    allowExternalSharing: true,
    updatedAt: now,
    updatedBy,
  });
  await db.doc('config/admins').set({
    emails: ['admin@example.com'],
    updatedAt: now,
    updatedBy,
  });

  for (const [id, group] of Object.entries(GROUPS)) {
    await db.doc(`groups/${id}`).set({
      name: group.name,
      description: group.description,
      memberEmails: [...group.memberEmails],
      createdAt: now,
      updatedAt: now,
      updatedBy,
    });
  }

  const groupsWithId: WithId<Group>[] = Object.entries(GROUPS).map(([id, group]) => ({
    id,
    ...group,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    updatedBy,
  }));

  for (const report of REPORTS) {
    const viewerEmails = computeViewerEmails(report.directEmails, report.groupIds, groupsWithId);
    const html = placeholderHtml(report.title);

    await db.doc(`reports/${report.id}`).set({
      title: report.title,
      description: '',
      tags: [],
      slug: null,
      status: report.status,
      directEmails: report.directEmails,
      groupIds: report.groupIds,
      viewerEmails,
      externalEmails: report.externalEmails,
      externalExpiry: report.externalExpiry,
      sizeBytes: Buffer.byteLength(html, 'utf8'),
      createdAt: now,
      updatedAt: now,
      publishedAt: report.status === 'published' ? now : null,
      createdBy: updatedBy,
      updatedBy,
    });
    await db.doc(`reports/${report.id}/content/main`).set({
      html,
      updatedAt: now,
    });
  }

  console.log('✓ Seeded config, groups and reports\n');
  console.log('Sign in as           | Should see');
  console.log('--------------------- | -------------------------------------------------');
  console.log('admin@example.com    | everything (admin)');
  console.log('alice@example.com    | Sales Overview, Partner Summary');
  console.log('carol@example.com    | HR Headcount');
  console.log('dave@example.com     | Sales Overview');
  console.log('eve@example.com      | nothing (internal, not assigned)');
  console.log('partner@outside.test | Partner Summary (Old Partner Report is expired)');
  console.log('stranger@gmail.test  | "No access" page');
}

main().catch((error: unknown) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
