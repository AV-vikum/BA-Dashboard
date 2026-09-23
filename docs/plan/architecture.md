# Architecture Reference

Reference material used by several phases. Phase files link to the section they need.

---

## A1. System overview

```
 Admin ──chat──▶ Claude Desktop / Claude Code
                    │  reads data, writes report files (using the create-report skill)
                    ▼
        reports/<slug>/          local, git-ignored (except reports/_example)
                    │
                    ▼
        tools/  ── CLI (`npm run report …`) + MCP server — same core code
                    │  firebase-admin
                    │    • emulator:   no credentials (demo-ba-dashboard)
                    │    • production: service-account key file (outside repo)
                    ▼
        Cloud Firestore  ◀── Security Rules decide who can read what
                    ▲
                    │  Firebase JS SDK (signed-in user, Google sign-in)
        web/  React app on Firebase Hosting
          ├─ /login          Google sign-in
          ├─ /               My reports (list + search)
          ├─ /r/:reportId    Report viewer (sandboxed iframe)
          └─ /admin/*        Admin UI (reports, people, groups, settings, view-as)
```

---

## A2. Repository layout (target)

```
BA-Dashboard/
├─ CLAUDE.md                        instructions for AI agents (points to the plan)
├─ README.md
├─ LICENSE
├─ package.json                      npm workspaces root + scripts
├─ tsconfig.base.json
├─ eslint.config.js
├─ .prettierrc.json
├─ lefthook.yml                     pre-commit: secretlint
├─ .secretlintrc.json
├─ .gitignore
├─ firebase.json                    emulators, hosting, firestore paths, headers
├─ firestore.rules
├─ firestore.indexes.json
├─ .firebaserc.example              (real .firebaserc is git-ignored, created in Phase 9)
├─ .mcp.json.example
├─ scripts/
│  └─ emulators.mjs                 starts emulators with import/export only if data exists
├─ tests/
│  └─ rules/                        security-rules tests (Vitest + emulator)
├─ docs/
│  ├─ PLAN.md                       status tracker
│  ├─ DEVELOPMENT.md                how to develop locally (Phase 1)
│  ├─ SETUP.md                      fork → configure → deploy (Phase 10)
│  ├─ SECURITY.md                   (Phase 10)
│  └─ plan/                         detailed phase instructions
├─ shared/
│  ├─ package.json                  @ba/shared
│  └─ src/
│     ├─ index.ts
│     ├─ constants.ts
│     ├─ types.ts
│     ├─ email.ts
│     ├─ access.ts
│     ├─ search.ts
│     └─ report-json.ts             zod schema for report.json
├─ web/
│  ├─ package.json                  @ba/web
│  ├─ .env.development              demo/emulator values only — committed, contains no secrets
│  ├─ .env.example                  documents every variable
│  ├─ index.html
│  ├─ vite.config.ts
│  └─ src/
│     ├─ main.tsx, router.tsx
│     ├─ lib/firebase.ts            init + emulator connection
│     ├─ lib/firestore/*.ts         all Firestore reads/writes
│     ├─ lib/report-frame.ts        iframe helpers (theme injection)
│     ├─ auth/AuthProvider.tsx, RequireAuth.tsx, RequireAdmin.tsx
│     ├─ hooks/*.ts
│     ├─ components/ui/*            shadcn components
│     ├─ components/*.tsx           app components
│     └─ pages/…                    route pages (viewer + admin)
├─ tools/
│  ├─ package.json                  @ba/tools
│  ├─ .env.example
│  ├─ tsup.config.ts
│  └─ src/
│     ├─ cli.ts                     commander entry
│     ├─ mcp.ts                     MCP server entry (stdio)
│     ├─ core/env.ts                target selection + env loading
│     ├─ core/firebase.ts           firebase-admin init
│     ├─ core/paths.ts              REPORTS_DIR, slug validation
│     ├─ core/build.ts              report build + validation
│     ├─ core/publish.ts            create/update reports in Firestore
│     ├─ core/access.ts             access changes (uses @ba/shared)
│     ├─ core/output.ts             one-line result formatting
│     └─ scripts/setup.ts, seed.ts
├─ templates/
│  └─ report-base/
│     ├─ base.css
│     ├─ base.js                    window.Report helper API
│     └─ starter/                   copied by `report new`
│        ├─ report.html, report.json, data.json, build-data.mjs, data/.gitkeep
├─ reports/
│  └─ _example/                     the only committed report (fake data)
└─ .claude/
   └─ skills/create-report/
      ├─ SKILL.md
      └─ references/ (helpers.md, design.md, data.md)
```

---

## A3. Environments

|                   | Emulator (default)                                                                                                  | Production (Phase 9+)                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Project ID        | `demo-ba-dashboard` (the `demo-` prefix means: no real project, no credentials, emulators can't reach the internet) | The user's real project ID                                                          |
| Web config        | `web/.env.development` (committed, fake values)                                                                     | `web/.env.production.local` (git-ignored)                                           |
| Tools target      | `BA_TARGET` unset or `emulator` → `tools/.env` (optional)                                                           | `BA_TARGET=production` → `tools/.env.production` (git-ignored)                      |
| Credentials       | none                                                                                                                | service-account JSON **outside the repo**, path in `GOOGLE_APPLICATION_CREDENTIALS` |
| Data              | `.emulator-data/` (git-ignored)                                                                                     | Cloud Firestore                                                                     |
| Firestore indexes | **not enforced** by the emulator                                                                                    | enforced — must be deployed (step 9.4)                                              |

### Emulator ports

| Emulator        | Port |
| --------------- | ---- |
| Auth            | 9099 |
| Firestore       | 8080 |
| Hosting         | 5000 |
| Emulator UI     | 4000 |
| Vite dev server | 5173 |

---

## A4. Configuration & secrets

| What                                                                      | Where                                     | In git?                         |
| ------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------- |
| Web Firebase config (dev)                                                 | `web/.env.development` — fake demo values | ✅ (safe)                       |
| Web Firebase config (prod)                                                | `web/.env.production.local`               | ❌                              |
| Branding (`VITE_APP_NAME`, `VITE_APP_LOGO_URL`, `VITE_APP_PRIMARY_COLOR`) | same env files                            | dev ✅ / prod ❌                |
| Firebase project alias                                                    | `.firebaserc`                             | ❌ (`.firebaserc.example` ✅)   |
| Allowed domains, external-sharing switch                                  | Firestore `config/access`                 | — (edited in Admin → Settings)  |
| Admin emails                                                              | Firestore `config/admins`                 | — (edited in Admin → Settings)  |
| Service-account key                                                       | JSON file outside the repo                | ❌ never                        |
| Tools production settings                                                 | `tools/.env.production`                   | ❌ (`tools/.env.example` ✅)    |
| MCP client config                                                         | `.mcp.json` / Claude Desktop config       | ❌ (`.mcp.json.example` ✅)     |
| Report sources & data                                                     | `reports/<slug>/`                         | ❌ (except `reports/_example/`) |

**The web `apiKey` is not a secret** — it's sent to every browser. Security comes from Security Rules, Auth authorized domains, and API-key website restrictions (Phase 9).

### Environment variables

`web/.env.*`

| Variable                    | Dev value                           | Notes                 |
| --------------------------- | ----------------------------------- | --------------------- |
| `VITE_FIREBASE_API_KEY`     | `demo-api-key`                      |                       |
| `VITE_FIREBASE_AUTH_DOMAIN` | `demo-ba-dashboard.firebaseapp.com` |                       |
| `VITE_FIREBASE_PROJECT_ID`  | `demo-ba-dashboard`                 |                       |
| `VITE_FIREBASE_APP_ID`      | `demo-app-id`                       |                       |
| `VITE_USE_EMULATORS`        | `true`                              | `false` in production |
| `VITE_APP_NAME`             | `BA Dashboard`                      |                       |
| `VITE_APP_LOGO_URL`         | _(empty)_                           | optional              |
| `VITE_APP_PRIMARY_COLOR`    | _(empty)_                           | optional, hex         |

`tools/.env.production` (and optional `tools/.env` for emulator overrides)

| Variable                         | Example                                       | Notes                                        |
| -------------------------------- | --------------------------------------------- | -------------------------------------------- |
| `FIREBASE_PROJECT_ID`            | `my-company-reports`                          | emulator default: `demo-ba-dashboard`        |
| `GOOGLE_APPLICATION_CREDENTIALS` | `C:\secure\ba-dashboard\service-account.json` | production only                              |
| `APP_URL`                        | `https://my-company-reports.web.app`          | emulator default: `http://localhost:5173`    |
| `REPORTS_DIR`                    | `../reports`                                  | relative to the repo root; default `reports` |
| `PUBLISHER_EMAIL`                | `you@company.com`                             | written to `updatedBy` as `cli:<email>`      |
| `FIRESTORE_EMULATOR_HOST`        | `127.0.0.1:8080`                              | emulator only; set automatically             |

---

## A5. Data model (Firestore)

All emails lower-case. All timestamps are Firestore `Timestamp`.

### `config/access` — readable by any signed-in user

```ts
{
  allowedDomains: string[];        // ["example.com"] — lower-case, no "@"
  allowExternalSharing: boolean;
  updatedAt: Timestamp; updatedBy: string;
}
```

### `config/admins` — admins only

```ts
{ emails: string[]; updatedAt: Timestamp; updatedBy: string; }
```

The web app finds out whether the user is an admin by trying to read this document (success = admin).

### `users/{uid}` — profile, written by the user on sign-in

```ts
{
  email: string;
  displayName: string | null;
  photoURL: string | null;
  lastLoginAt: Timestamp;
}
```

### `groups/{groupId}` — admins only

```ts
{
  name: string;                    // unique (case-insensitive)
  description: string;
  memberEmails: string[];          // internal emails only
  createdAt, updatedAt: Timestamp; updatedBy: string;
}
```

### `reports/{reportId}` — metadata (small)

```ts
{
  title: string;                   // 1–120 chars
  description: string;             // 0–500 chars
  tags: string[];                  // lower-case, max 10
  slug: string | null;             // local folder name when published via CLI/MCP; null if created in the web UI
  status: 'draft' | 'published';
  directEmails: string[];          // internal people assigned individually
  groupIds: string[];
  viewerEmails: string[];          // COMPUTED: directEmails ∪ members of groupIds (see A7)
  externalEmails: string[];        // outside people
  externalExpiry: Record<string, Timestamp | null>;  // key = external email; null = no expiry
  sizeBytes: number;
  createdAt, updatedAt, publishedAt: Timestamp;
  createdBy, updatedBy: string;
}
```

### `reports/{reportId}/content/main` — the report HTML

```ts
{
  html: string;
  updatedAt: Timestamp;
}
```

Limit: the built HTML must be ≤ `REPORT_MAX_BYTES` = **900,000 bytes** (Firestore's document limit is 1 MiB).

---

## A6. Security Rules (target — implemented in step 2.5)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null
        && request.auth.token.email != null
        && request.auth.token.email_verified == true;
    }
    function email() { return request.auth.token.email.lower(); }
    function accessCfg() { return get(/databases/$(database)/documents/config/access).data; }
    function adminEmails() { return get(/databases/$(database)/documents/config/admins).data.emails; }
    function isInternal() { return signedIn() && email().split('@')[1] in accessCfg().allowedDomains; }
    function isAdmin() { return signedIn() && email() in adminEmails(); }

    function internalViewer(r) {
      return isInternal() && r.status == 'published' && email() in r.viewerEmails;
    }
    function externalViewer(r) {
      return signedIn() && accessCfg().allowExternalSharing == true
        && r.status == 'published' && email() in r.externalEmails;
    }
    function externalNotExpired(r) {
      let exp = r.externalExpiry.get(email(), null);
      return exp == null || exp > request.time;
    }
    function reportData(id) { return get(/databases/$(database)/documents/reports/$(id)).data; }

    match /config/access {
      allow read: if signedIn();
      allow write: if isAdmin()
        && request.resource.data.allowedDomains is list
        && request.resource.data.allowedDomains.size() > 0
        && request.resource.data.allowExternalSharing is bool;
    }
    match /config/admins {
      allow read: if isAdmin();
      allow write: if isAdmin()
        && request.resource.data.emails is list
        && request.resource.data.emails.size() > 0;
    }
    match /users/{uid} {
      allow read: if isAdmin() || (signedIn() && request.auth.uid == uid);
      allow create, update: if signedIn() && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['email', 'displayName', 'photoURL', 'lastLoginAt'])
        && request.resource.data.email == email();
      allow delete: if isAdmin();
    }
    match /groups/{groupId} {
      allow read, write: if isAdmin();
    }
    match /reports/{reportId} {
      allow read: if isAdmin()
        || internalViewer(resource.data)
        || externalViewer(resource.data);
      allow write: if isAdmin();

      match /content/{docId} {
        allow read: if isAdmin()
          || internalViewer(reportData(reportId))
          || (externalViewer(reportData(reportId)) && externalNotExpired(reportData(reportId)));
        allow write: if isAdmin();
      }
    }
  }
}
```

**Why queries work:** Firestore only allows a list query if the rule is provably true for every possible result.

- Internal users query `where('viewerEmails','array-contains',email) + where('status','==','published')`.
- External users query `where('externalEmails','array-contains',email) + where('status','==','published')`.
- Admins can query anything.

**Known limitation:** list queries cannot check expiry, so an external user whose access expired can still read the report's _metadata_ (title etc.); the app hides it. The _content_ is blocked by the rules. Admins can clean up expired entries (step 4.9).

**Bootstrapping:** the Admin SDK (setup/seed scripts, CLI) bypasses rules, which is how the first `config/*` documents are created.

---

## A7. Access semantics

- `viewerEmails = unique(directEmails ∪ ⋃ members(groupIds))` — always recomputed by `computeViewerEmails()` from `@ba/shared`, never edited by hand.
- When a **group's members** change or a **group is deleted**: find reports with `groupIds array-contains groupId`, recompute `viewerEmails`, write in batches.
- **Direct emails and group members must be internal** (domain in `allowedDomains`). An email outside the allowed domains can only be added as **external**.
- **External access**: email in `externalEmails` plus an entry in `externalExpiry` (`null` = never expires; otherwise the end of the chosen day, 23:59:59 local time).
- **Drafts** are visible only to admins.
- If a domain is **removed** from `allowedDomains`, those people immediately lose access (rules check the domain at read time); their emails stay in reports so access returns if the domain is re-added.
- Admins see every report (published and draft).

### Who owns what: report folder vs. web UI

- `report.json` (in the local folder) is the source of truth for **content, title, description, tags**. Publishing overwrites them in Firestore. The admin UI shows a note on reports that have a `slug`: _"Managed from a local folder — edits to details here are overwritten on the next publish."_
- **Access** is applied from `report.json` **only when the report is first created**. After that, access is managed in the web UI or with `report access` / the `set_access` MCP tool; a normal re-publish never changes access. `report pull` refreshes the `access` block in `report.json` from Firestore.

---

## A8. Report rendering

- The viewer loads `content/main.html` and renders it in:
  ```html
  <iframe
    sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
    referrerpolicy="no-referrer"
    srcdoc="…"
    title="<report title>"
  ></iframe>
  ```
  **No `allow-same-origin`** → the report runs in an opaque origin and cannot read the app's cookies, storage, auth tokens, or Firestore.
- Theme: before setting `srcdoc`, the app injects `data-theme="light|dark"` on the report's `<html>` tag (`web/src/lib/report-frame.ts`).
- A `srcdoc` iframe **inherits the parent page's Content-Security-Policy**, so the app's CSP must allow what reports need (inline scripts, the chart CDN). The v1 trade-off and exact policy are in step 3.9. Serving reports from a separate origin (backlog B.7) would remove this trade-off.

### Report file format (details in Phase 5)

```
reports/<slug>/
├─ report.json      metadata + initial access + reportId (after first publish)
├─ report.html      layout + report-specific script; uses window.Report helpers
├─ data.json        numbers only — generated by build-data.mjs
├─ build-data.mjs   source files → data.json (aggregation happens here, not in the chat)
├─ data/            source files (CSV/XLSX)
└─ dist/report.html built, self-contained output (git-ignored) — this is what gets published
```

---

## A9. Free-plan (Spark) budget

| Resource          | Free limit                         | Expected use                                                                                    |
| ----------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| Firestore storage | 1 GiB                              | ~100–300 KB per report → thousands of reports                                                   |
| Firestore reads   | 50,000 / day                       | Home list ≈ 1 read per report + 2 config; opening a report ≈ 2–4 reads (includes rule `get()`s) |
| Firestore writes  | 20,000 / day                       | Admin actions + one profile write per sign-in                                                   |
| Hosting           | 10 GB storage, 360 MB/day transfer | Only the app shell                                                                              |
| Auth              | Google sign-in is free             | —                                                                                               |

Cloud Functions and new Cloud Storage buckets need the Blaze plan, so v1 uses neither.
