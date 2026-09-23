// Lazy firebase-admin initialization — emulator needs only a project ID;
// production uses the service-account key via applicationDefault(), which
// reads GOOGLE_APPLICATION_CREDENTIALS (validated to exist in env.ts).
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { env } from './env.js';

function ensureApp() {
  if (getApps().length > 0) return;

  if (env.target === 'production') {
    initializeApp({
      projectId: env.FIREBASE_PROJECT_ID,
      credential: applicationDefault(),
    });
  } else {
    initializeApp({ projectId: env.FIREBASE_PROJECT_ID });
  }
}

let db: Firestore | undefined;
export function getDb(): Firestore {
  ensureApp();
  db ??= getFirestore();
  return db;
}

let auth: Auth | undefined;
export function getAdminAuth(): Auth {
  ensureApp();
  auth ??= getAuth();
  return auth;
}

/** Emulator target only — fails fast with a friendly message instead of hanging. */
export async function assertEmulatorRunning(): Promise<void> {
  if (env.target !== 'emulator') return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    await fetch('http://127.0.0.1:8080/', { signal: controller.signal });
  } catch {
    throw new Error('Firestore emulator is not running. Start it with: npm run emulators');
  } finally {
    clearTimeout(timeout);
  }
}
