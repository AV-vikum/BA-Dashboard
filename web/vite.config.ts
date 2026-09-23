import { readFileSync } from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Reads the catch-all ("**") header rule from ../firebase.json so
// `vite preview` (used by `npm run preview:hosting`, step 3.9) serves the
// same security headers production Hosting will — the Hosting *emulator*
// doesn't apply firebase.json's headers/redirects at all (only rewrites
// and static files), so this is the only local way to check the CSP
// against the real built app before Phase 9. firebase.json stays the
// single source of truth; nothing here is a second copy to keep in sync.
function readProductionHeaders(): Record<string, string> {
  const firebaseJsonPath = path.resolve(import.meta.dirname, '../firebase.json');
  const config = JSON.parse(readFileSync(firebaseJsonPath, 'utf-8'));
  const rule = config.hosting?.headers?.find((h: { source: string }) => h.source === '**');
  const headers: Record<string, string> = {};
  for (const { key, value } of rule?.headers ?? []) {
    headers[key] = value;
  }
  return headers;
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  preview: {
    headers: readProductionHeaders(),
  },
});
