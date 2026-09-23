import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { envResult } from './env';

// Only called once env validation has already succeeded (see main.tsx),
// so it's safe to assert env here.
if (!envResult.ok) {
  throw new Error('Firebase initialized with invalid environment configuration.');
}
const env = envResult.env;

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getFirestore(app);

export const useEmulators = env.VITE_USE_EMULATORS === 'true';

// Guard against reconnecting on Vite HMR (connectXEmulator throws if called twice).
declare global {
  var __ba_emulators_connected__: boolean | undefined;
}

if (useEmulators && !globalThis.__ba_emulators_connected__) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  globalThis.__ba_emulators_connected__ = true;
}
