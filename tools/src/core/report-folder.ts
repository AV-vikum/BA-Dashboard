// Creating and locating local report folders (reports/<slug>/).
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TEMPLATE_DIR } from './build.js';
import { reportFolder } from './paths.js';

export const EDITABLE_FILES = [
  'report.html',
  'data.json',
  'build-data.mjs',
  'report.json',
  'data/',
];

function writeJson(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** Copies the starter template into reports/<slug>/ and sets the title. Returns the folder. */
export function createReportFolder(reportsDir: string, slug: string, title: string): string {
  const folder = reportFolder(reportsDir, slug);
  if (existsSync(folder)) throw new Error(`reports/${slug} already exists`);
  if (!title.trim()) throw new Error('title is required');

  cpSync(path.join(TEMPLATE_DIR, 'starter'), folder, { recursive: true });

  const reportJsonFile = path.join(folder, 'report.json');
  const reportJson = JSON.parse(readFileSync(reportJsonFile, 'utf8')) as Record<string, unknown>;
  writeJson(reportJsonFile, { ...reportJson, title: title.trim() });

  const dataFile = path.join(folder, 'data.json');
  const data = JSON.parse(readFileSync(dataFile, 'utf8')) as { meta?: Record<string, unknown> };
  writeJson(dataFile, { ...data, meta: { ...data.meta, title: title.trim() } });

  return folder;
}

/** Updates fields of reports/<slug>/report.json in place, keeping 2-space formatting. */
export function updateReportJsonFile(folder: string, patch: Record<string, unknown>): void {
  const file = path.join(folder, 'report.json');
  const current = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeJson(file, { ...current, ...patch });
}

export { writeJson };
