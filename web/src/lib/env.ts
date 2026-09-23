import { z } from 'zod';

// Validates import.meta.env at startup so a missing/misconfigured variable
// fails with a clear message instead of a cryptic runtime error later.
const envSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().min(1),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1),
  VITE_FIREBASE_APP_ID: z.string().min(1),
  VITE_USE_EMULATORS: z.enum(['true', 'false']),
  VITE_APP_NAME: z.string().min(1),
  VITE_APP_LOGO_URL: z.string(),
  VITE_APP_PRIMARY_COLOR: z.string(),
});

export type Env = z.infer<typeof envSchema>;

export type EnvResult = { ok: true; env: Env } | { ok: false; problems: string[] };

function parseEnv(raw: ImportMetaEnv): EnvResult {
  const result = envSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, env: result.data };
  }
  const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  return { ok: false, problems };
}

export const envResult = parseEnv(import.meta.env);
