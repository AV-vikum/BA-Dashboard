// Integration test against the Firestore emulator: publish → update → access → unpublish → pull.
// Uses its own project (demo-ba-tools-int) and a temporary reports dir, so it never touches
// dev data. Run with `npm run test:tools:int` (starts the emulator if it isn't running).
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PROJECT = 'demo-ba-tools-int';
const reportsDir = mkdtempSync(path.join(tmpdir(), 'ba-int-'));
process.env.BA_TARGET = 'emulator';
process.env.FIREBASE_PROJECT_ID = PROJECT;
process.env.REPORTS_DIR = reportsDir;
process.env.APP_URL = 'http://app.test';
process.env.PUBLISHER_EMAIL = 'admin@example.com';

// Imported after the env is set — env.ts reads it once at load.
const { getDb } = await import('../src/core/firebase.js');
const { createReportFolder, updateReportJsonFile } = await import('../src/core/report-folder.js');
const { publishReport } = await import('../src/core/publish.js');
const { getAccess, updateAccess } = await import('../src/core/access.js');
const { listReports, pullReport, unpublishReport } = await import('../src/core/reports.js');

const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const db = getDb();

function readJson(slug: string) {
  return JSON.parse(readFileSync(path.join(reportsDir, slug, 'report.json'), 'utf8'));
}

beforeAll(async () => {
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
    method: 'DELETE',
  });
  await db
    .doc('config/access')
    .set({ allowedDomains: ['example.com'], allowExternalSharing: true });
  await db.doc('config/admins').set({ emails: ['admin@example.com'] });
  await db.doc('groups/finance').set({
    name: 'Finance',
    description: '',
    memberEmails: ['alice@example.com', 'bob@example.com'],
  });
  await db.doc('groups/mgmt').set({
    name: 'Management',
    description: '',
    memberEmails: ['carol@example.com'],
  });
});

afterAll(() => {
  rmSync(reportsDir, { recursive: true, force: true });
});

describe('publish flow (emulator)', () => {
  let id = '';

  it('creates a report with access from report.json and records its id per project', async () => {
    const folder = createReportFolder(reportsDir, 'sales', 'Sales');
    updateReportJsonFile(folder, {
      tags: ['sales'],
      access: {
        emails: ['dave@example.com', 'someone@gmail.test'],
        groups: ['finance'],
        external: [{ email: 'partner@outside.test', expires: '2099-12-31' }],
      },
    });

    const result = await publishReport('sales');
    id = result.id;
    expect(result).toMatchObject({
      created: true,
      status: 'published',
      url: `http://app.test/r/${id}`,
    });
    expect(result.warnings.join()).toMatch(/someone@gmail\.test is outside allowed domains/);
    expect(readJson('sales').reportIds).toEqual({ [PROJECT]: id });

    const doc = (await db.doc(`reports/${id}`).get()).data()!;
    expect(doc.viewerEmails).toEqual(['alice@example.com', 'bob@example.com', 'dave@example.com']);
    expect(doc.groupIds).toEqual(['finance']);
    expect(doc.externalEmails).toEqual(['partner@outside.test']);
    expect(doc.externalExpiry['partner@outside.test'].toDate().getFullYear()).toBe(2099);
    expect(doc.slug).toBe('sales');
    expect(doc.updatedBy).toBe('cli:admin@example.com');
    const content = (await db.doc(`reports/${id}/content/main`).get()).data()!;
    expect(content.html).toContain('id="report-data"');
  });

  it('re-publishing updates content and details but never access', async () => {
    await db.doc(`reports/${id}`).update({
      title: 'Edited in web',
      updatedBy: 'alice@example.com',
      directEmails: [],
      viewerEmails: ['alice@example.com', 'bob@example.com'],
    });
    const result = await publishReport('sales');
    expect(result).toMatchObject({ created: false, id });
    expect(result.warnings.join()).toMatch(/title was edited in the web app/);

    const doc = (await db.doc(`reports/${id}`).get()).data()!;
    expect(doc.title).toBe('Sales');
    expect(doc.viewerEmails).toEqual(['alice@example.com', 'bob@example.com']);
  });

  it('changes access by slug and mirrors it into report.json', async () => {
    const result = await updateAccess('sales', {
      addEmails: ['eve@example.com'],
      addGroups: ['Management'],
      removeGroups: ['Finance'],
      removeExternal: ['partner@outside.test'],
    });
    expect(result.view.viewerCount).toBe(2);
    const doc = (await db.doc(`reports/${id}`).get()).data()!;
    expect(doc.viewerEmails).toEqual(['carol@example.com', 'eve@example.com']);
    expect(doc.externalEmails).toEqual([]);
    expect(readJson('sales').access).toEqual({
      emails: ['eve@example.com'],
      groups: ['Management'],
      external: [],
    });

    const byId = await getAccess(id);
    expect(byId.groups).toEqual([{ name: 'Management', members: 1 }]);
  });

  it('lists, unpublishes and pulls', async () => {
    expect((await listReports('sales')).map((r) => r.id)).toEqual([id]);
    await unpublishReport('sales');
    expect((await db.doc(`reports/${id}`).get()).data()!.status).toBe('draft');

    const pulled = await pullReport(id, 'sales-copy');
    expect(pulled.created).toBe(true);
    expect(readJson('sales-copy')).toMatchObject({
      title: 'Sales',
      status: 'draft',
      reportIds: { [PROJECT]: id },
    });
    expect(
      readFileSync(path.join(reportsDir, 'sales-copy', 'dist', 'report.html'), 'utf8'),
    ).toContain('<html');
  });

  it('gives a clear error for unknown groups and missing reports', async () => {
    await expect(updateAccess('sales', { addGroups: ['Nope'] })).rejects.toThrow(
      /Available groups: Finance, Management/,
    );
    await expect(getAccess('does-not-exist')).rejects.toThrow(/No report folder or report id/);
  });
});
