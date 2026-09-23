// Starts the Firebase emulators, importing persisted data if it exists and
// exporting it again on exit. `--import` errors if the folder has no export
// yet, so we only add the flag once one has been created.
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(REPO_ROOT, '.emulator-data');
const METADATA_FILE = path.join(DATA_DIR, 'firebase-export-metadata.json');

const extraArgs = process.argv.slice(2);

const args = [
  'firebase',
  'emulators:start',
  '--project',
  'demo-ba-dashboard',
  '--export-on-exit=./.emulator-data',
  ...extraArgs,
];

if (existsSync(METADATA_FILE)) {
  args.push('--import=./.emulator-data');
}

const child = spawn('npx', args, {
  cwd: REPO_ROOT,
  shell: true,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
