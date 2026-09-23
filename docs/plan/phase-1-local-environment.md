# Phase 1 — Local environment (emulators)

## Context

All development runs against the **Firebase Emulator Suite** using the demo project ID **`demo-ba-dashboard`**. A `demo-` project needs no real Firebase project and no credentials. The real project is connected only in Phase 9.

Relevant reference: [architecture A3 (environments)](architecture.md#a3-environments), [A5 (data model)](architecture.md#a5-data-model-firestore).

---

## 1.1 `firebase.json`, placeholder rules and indexes

**Do:**

1. `firebase.json`:
   ```json
   {
     "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
     "hosting": {
       "public": "web/dist",
       "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
       "rewrites": [{ "source": "**", "destination": "/index.html" }],
       "headers": []
     },
     "emulators": {
       "singleProjectMode": true,
       "auth": { "port": 9099 },
       "firestore": { "port": 8080 },
       "hosting": { "port": 5000 },
       "ui": { "enabled": true, "port": 4000 }
     }
   }
   ```
   (Headers are filled in step 3.9.)
2. `firestore.rules` — temporary deny-all:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} { allow read, write: if false; }
     }
   }
   ```
3. `firestore.indexes.json`: `{ "indexes": [], "fieldOverrides": [] }`

**Acceptance:** `npx firebase emulators:start --only auth,firestore --project demo-ba-dashboard` starts; http://localhost:4000 shows the Emulator UI. Stop it (Ctrl+C).

---

## 1.2 Emulator scripts with persistent data

**Why:** `--import` fails if the folder has no export yet, so a small script adds it only when data exists.

**Do:**

1. `scripts/emulators.mjs`:
   - Accepts optional args (e.g. `--only auth,firestore`), passes them through.
   - Runs `firebase emulators:start --project demo-ba-dashboard --export-on-exit=./.emulator-data` and adds `--import=./.emulator-data` **only if** `.emulator-data/firebase-export-metadata.json` exists.
   - Uses `child_process.spawn` with `shell: true` and `stdio: 'inherit'` (works on Windows).
2. `scripts/emulators-reset.mjs`: deletes `.emulator-data/` (with `fs.rm(..., { recursive: true, force: true })`) and prints what it did.
3. Root scripts:
   ```json
   "emulators": "node scripts/emulators.mjs --only auth,firestore",
   "emulators:all": "node scripts/emulators.mjs",
   "emulators:reset": "node scripts/emulators-reset.mjs"
   ```

**Acceptance:**

1. `npm run emulators`, add a document by hand in the Emulator UI, stop with Ctrl+C → `.emulator-data/` is created.
2. Start again → the document is still there.
3. `npm run emulators:reset` → folder removed.

> Note (2026-09-23): `npm run check`, `emulators:reset`, and the emulator boot/shutdown mechanics were verified by the agent. Steps 1–2 (Ctrl+C export-on-exit with a hand-added document) need a real interactive terminal/browser and were not exercised by the agent — please run them once yourself to confirm.

---

## 1.3 Tools: environment + firebase-admin connection

**Do:**

1. Install in `tools`: `firebase-admin dotenv zod`.
2. `tools/src/core/paths.ts`:
   - `REPO_ROOT` resolved from `import.meta.url` (not `process.cwd()` — the MCP server may start in any folder).
   - `resolveReportsDir(env)` → absolute path (default `<repo>/reports`).
   - `assertValidSlug(slug)`: `/^[a-z0-9][a-z0-9-]{1,60}$/` or `_example`; throws a clear error.
   - `reportFolder(slug)` → absolute path; must stay inside the reports dir (reject `..`).
3. `tools/src/core/env.ts`:
   - `BA_TARGET` = `emulator` (default) or `production`.
   - Emulator: load `tools/.env` if present (optional overrides); defaults `FIREBASE_PROJECT_ID=demo-ba-dashboard`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `APP_URL=http://localhost:5173`, `PUBLISHER_EMAIL=admin@example.com`.
   - Production: load `tools/.env.production` (error if missing: _"tools/.env.production not found — see docs/plan/user-checkpoints.md CP-3"_); require `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` (file must exist; **never read or print its content**), `APP_URL`, `PUBLISHER_EMAIL`; **delete** any `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` from `process.env` so production can never accidentally hit the emulator (and vice versa).
   - Validate with zod; export a typed `env` object and `targetLabel()` → `emulator (demo-ba-dashboard)` or `production (my-project)`.
4. `tools/src/core/firebase.ts`:
   - `getDb()` / `getAdminAuth()` lazily initialize `firebase-admin` with `{ projectId }` (emulator) or `applicationDefault()` credentials (production).
   - `assertEmulatorRunning()` (emulator target only): `fetch('http://127.0.0.1:8080/')` with a 2s timeout; on failure throw _"Firestore emulator is not running. Start it with: npm run emulators"_.

**Acceptance:** a temporary script (delete afterwards) run with `npx tsx` writes and reads a document in the emulator; with emulators stopped it prints the friendly error.

---

## 1.4 Setup script (access config)

**Do:**

1. `tools/src/scripts/setup.ts`, root script `"setup": "tsx tools/src/scripts/setup.ts"`.
2. Arguments (use `node:util` `parseArgs`): `--domains a.com,b.lk` (required), `--admins x@a.com,y@a.com` (required), `--external on|off` (default `on`). Target from `BA_TARGET`.
3. Validates domains (`/^[a-z0-9-]+(\.[a-z0-9-]+)+$/` after lower-casing, strip a leading `@`) and emails (use helpers from `@ba/shared` once step 2.2 exists — for now a local check, replaced in 2.2).
4. Writes `config/access` and `config/admins` with `merge: true` semantics for re-runs: domains/admins passed are **the complete new lists** (print the old → new values so the user sees the change).
5. Production target: before writing, print the target and require `--yes` flag; without it, print what would change and exit.

**Acceptance:**

- `npm run setup -- --domains example.com --admins admin@example.com` with emulators running creates both docs (check the Emulator UI).
- Re-running with different values updates them and prints old → new.
- Missing args prints usage and exits with code 1.

---

## 1.5 Seed script (demo data)

**Do:** `tools/src/scripts/seed.ts`, root script `"seed": "tsx tools/src/scripts/seed.ts"`. Emulator target **only** (refuse with an error if `BA_TARGET=production`). Idempotent — uses fixed document IDs and overwrites.

Seed:

- `config/access`: `allowedDomains: ["example.com"]`, `allowExternalSharing: true`
- `config/admins`: `emails: ["admin@example.com"]`
- `groups/demo-finance`: Finance — `alice@example.com`, `bob@example.com`
- `groups/demo-management`: Management — `carol@example.com`
- Reports (simple placeholder HTML for now: a heading + a paragraph + one inline `<script>` that writes the current time — proves scripts run in the iframe; replaced by the real example in step 5.7):

| ID             | Title              | Status    | Access                                                |
| -------------- | ------------------ | --------- | ----------------------------------------------------- |
| `demo-sales`   | Sales Overview     | published | group Finance + direct `dave@example.com`             |
| `demo-hr`      | HR Headcount       | published | group Management                                      |
| `demo-draft`   | Budget Draft       | draft     | Finance                                               |
| `demo-partner` | Partner Summary    | published | Finance + external `partner@outside.test` (no expiry) |
| `demo-expired` | Old Partner Report | published | external `partner@outside.test`, expiry = yesterday   |

`viewerEmails` must be computed (use `computeViewerEmails` once step 2.3 exists; until then compute inline and replace it in 2.3).

Print a summary table of the demo users and what each should see:

| Sign in as           | Should see                                      |
| -------------------- | ----------------------------------------------- |
| admin@example.com    | everything (admin)                              |
| alice@example.com    | Sales Overview, Partner Summary                 |
| carol@example.com    | HR Headcount                                    |
| dave@example.com     | Sales Overview                                  |
| eve@example.com      | nothing (internal, not assigned)                |
| partner@outside.test | Partner Summary (Old Partner Report is expired) |
| stranger@gmail.test  | "No access" page                                |

**Acceptance:** `npm run seed` twice in a row gives the same data; the table prints.

---

## 1.6 `docs/DEVELOPMENT.md`

**Do:** write a short developer guide:

1. Prerequisites (link to conventions §2).
2. First run: `npm install` → `npm run emulators` (terminal 1) → `npm run seed` (terminal 2) → later `npm run dev` (Phase 3).
3. Emulator UI at http://localhost:4000 — how to inspect Firestore/Auth data.
4. Signing in with the Auth emulator: the Google popup is a **fake account chooser** — click "Add new account" and type any email (e.g. `alice@example.com`) to test different users.
5. Resetting data: stop emulators, `npm run emulators:reset`, start, `npm run seed`.
6. Where config lives (link to architecture A4) and the rule: _no real Firebase project is needed until Phase 9._

**Acceptance:** a new person could follow it to get the emulators running with demo data.
