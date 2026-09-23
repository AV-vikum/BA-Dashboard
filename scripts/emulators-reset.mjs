// Deletes persisted emulator data so the next `npm run emulators` starts fresh.
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(REPO_ROOT, '.emulator-data');

await rm(DATA_DIR, { recursive: true, force: true });
console.log(`Removed ${path.relative(REPO_ROOT, DATA_DIR)}`);
