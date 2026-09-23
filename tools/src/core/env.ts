// Target selection (emulator vs production) and typed, validated environment.
//
// BA_TARGET=production is the only way to reach a real Firebase project;
// every other code path stays on the demo-ba-dashboard emulator.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { REPO_ROOT } from './paths.js';

export type Target = 'emulator' | 'production';

const emulatorSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1).default('demo-ba-dashboard'),
  FIRESTORE_EMULATOR_HOST: z.string().min(1).default('127.0.0.1:8080'),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().min(1).default('127.0.0.1:9099'),
  APP_URL: z.string().min(1).default('http://localhost:5173'),
  PUBLISHER_EMAIL: z.string().min(1).default('admin@example.com'),
  REPORTS_DIR: z.string().optional(),
});

const productionSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1),
  APP_URL: z.string().min(1),
  PUBLISHER_EMAIL: z.string().min(1),
  REPORTS_DIR: z.string().optional(),
});

export interface Env {
  target: Target;
  FIREBASE_PROJECT_ID: string;
  APP_URL: string;
  PUBLISHER_EMAIL: string;
  REPORTS_DIR?: string;
  /** Production only. */
  GOOGLE_APPLICATION_CREDENTIALS?: string;
}

function loadEmulatorEnv(): Env {
  const envFile = path.join(REPO_ROOT, 'tools', '.env');
  if (existsSync(envFile)) {
    loadDotenv({ path: envFile });
  }

  const parsed = emulatorSchema.parse(process.env);

  // Make sure the values the rest of the process reads are actually set,
  // since firebase-admin picks these up from process.env directly.
  process.env.FIRESTORE_EMULATOR_HOST = parsed.FIRESTORE_EMULATOR_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = parsed.FIREBASE_AUTH_EMULATOR_HOST;

  return {
    target: 'emulator',
    FIREBASE_PROJECT_ID: parsed.FIREBASE_PROJECT_ID,
    APP_URL: parsed.APP_URL,
    PUBLISHER_EMAIL: parsed.PUBLISHER_EMAIL,
    REPORTS_DIR: parsed.REPORTS_DIR,
  };
}

function loadProductionEnv(): Env {
  const envFile = path.join(REPO_ROOT, 'tools', '.env.production');
  if (!existsSync(envFile)) {
    throw new Error('tools/.env.production not found — see docs/plan/user-checkpoints.md CP-3');
  }
  loadDotenv({ path: envFile });

  const parsed = productionSchema.parse(process.env);

  if (!existsSync(parsed.GOOGLE_APPLICATION_CREDENTIALS)) {
    throw new Error(
      `GOOGLE_APPLICATION_CREDENTIALS points to a file that does not exist: ` +
        `${parsed.GOOGLE_APPLICATION_CREDENTIALS}`,
    );
  }

  // Never let a leftover emulator host leak into a production run (or vice
  // versa) — these env vars silently redirect the Admin SDK.
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

  return {
    target: 'production',
    FIREBASE_PROJECT_ID: parsed.FIREBASE_PROJECT_ID,
    APP_URL: parsed.APP_URL,
    PUBLISHER_EMAIL: parsed.PUBLISHER_EMAIL,
    REPORTS_DIR: parsed.REPORTS_DIR,
    GOOGLE_APPLICATION_CREDENTIALS: parsed.GOOGLE_APPLICATION_CREDENTIALS,
  };
}

function loadEnv(): Env {
  const target: Target = process.env.BA_TARGET === 'production' ? 'production' : 'emulator';
  return target === 'production' ? loadProductionEnv() : loadEmulatorEnv();
}

/** Loaded once per process; BA_TARGET does not change mid-run. */
export const env: Env = loadEnv();

export function targetLabel(): string {
  return env.target === 'emulator'
    ? `emulator (${env.FIREBASE_PROJECT_ID})`
    : `production (${env.FIREBASE_PROJECT_ID})`;
}
