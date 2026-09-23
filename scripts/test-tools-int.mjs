// Runs the tools integration tests against the Firestore emulator: uses the one already
// running on 127.0.0.1:8080 (they use their own demo project, so dev data is untouched),
// otherwise starts one just for the run with `firebase emulators:exec`.
import { spawn } from 'node:child_process';

const vitest = 'vitest run --root tools --config vitest.int.config.ts';

async function emulatorRunning() {
  try {
    await fetch('http://127.0.0.1:8080/', { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

const command = (await emulatorRunning())
  ? vitest
  : `firebase emulators:exec --only firestore --project demo-ba-tools-int "${vitest}"`;

const child = spawn(command, { shell: true, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
