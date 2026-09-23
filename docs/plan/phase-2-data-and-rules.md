# Phase 2 — Data model & security rules

## Context
Security Rules are **the** access-control mechanism — the web app only reflects them. This phase builds shared types/helpers and fully tested rules. Reference: [architecture A5–A7](architecture.md#a5-data-model-firestore).

---

## 2.1 Shared types and constants
**Do:** in `shared/src/`:
1. `constants.ts`:
   ```ts
   export const DEMO_PROJECT_ID = 'demo-ba-dashboard';
   export const COLLECTIONS = { config: 'config', users: 'users', groups: 'groups', reports: 'reports' } as const;
   export const CONFIG_DOCS = { access: 'access', admins: 'admins' } as const;
   export const REPORT_CONTENT_DOC = 'main';
   export const REPORT_MAX_BYTES = 900_000;
   export const LIMITS = { titleMax: 120, descriptionMax: 500, tagsMax: 10, tagMax: 30 } as const;
   ```
2. `types.ts`: `AccessConfig`, `AdminsConfig`, `UserProfile`, `Group`, `Report`, `ReportContent`, `ReportStatus`, exactly as in A5. Timestamps: use a generic `TimestampLike = { toDate(): Date }` so both the web SDK and Admin SDK `Timestamp` fit. Also `WithId<T> = T & { id: string }`.
3. Re-export everything from `index.ts`.

**Acceptance:** `npm run typecheck` passes.

---

## 2.2 Email and domain helpers
**Do:** `shared/src/email.ts` + `email.test.ts`:
- `normalizeEmail(s)` → trimmed, lower-case.
- `isValidEmail(s)` → pragmatic regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` after normalizing.
- `domainOf(email)` → part after the last `@`.
- `normalizeDomain(s)` → trim, lower-case, strip leading `@`.
- `isValidDomain(s)` → `/^[a-z0-9-]+(\.[a-z0-9-]+)+$/`.
- `isInternalEmail(email, allowedDomains)`.
- `parseEmailList("a@x.com, b@y.com\nc@z.com")` → normalized, de-duplicated, with an `invalid: string[]` list.

Replace the temporary checks in `setup.ts` (step 1.4) with these.

**Tests:** upper-case input, spaces, `@` prefix on domains, duplicates, invalid entries, sub-domains (`a@mail.example.com` is **not** internal for `example.com` — exact match only; note this in a code comment).

**Acceptance:** `npm test -w shared` passes.

---

## 2.3 Access computation helpers
**Do:** `shared/src/access.ts` + tests:
- `computeViewerEmails(directEmails, groupIds, groups: Group-with-id[])` → sorted unique list; unknown group IDs are ignored.
- `isExternalActive(report, email, now = new Date())`.
- `applyAccessChange(report, change, groups, allowedDomains)` where `change = { addEmails?, removeEmails?, addGroupIds?, removeGroupIds?, addExternal?: {email, expires: Date|null}[], removeExternal?: string[] }` → returns the new `{ directEmails, groupIds, viewerEmails, externalEmails, externalExpiry }` **plus** `warnings: string[]` (e.g. *"x@gmail.com is outside allowed domains — add as external instead"*; such emails are **not** added to `directEmails`).
- `accessSummary(report)` → `{ internalCount, externalCount, expiredExternal: string[] }`.

Replace the inline computation in `seed.ts` with `computeViewerEmails`.

**Acceptance:** tests cover add/remove direct, add/remove group, overlap between direct and group (no duplicates), external with/without expiry, rejecting external emails in direct list, expired detection.

---

## 2.4 Search helper
**Do:** `shared/src/search.ts` + tests:
- `matchesSearch(report, query)` → split query into lower-case words; every word must appear in title, description, or any tag.
- `filterReports(reports, { query, tags, status })` — tags filter = report must have **all** selected tags.
- `collectTags(reports)` → sorted unique tags with counts.

**Acceptance:** tests pass (multi-word, case-insensitive, tag AND-filter, empty query returns all).

---

## 2.5 Firestore Security Rules
**Do:** replace `firestore.rules` with the rules in [architecture A6](architecture.md#a6-security-rules-target--implemented-in-step-25). Add short comments above each `match` block explaining who can do what.

**Acceptance:** emulators start without rule compile errors (`npm run emulators`, check the terminal output).

---

## 2.6 Firestore indexes
**Do:** `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "viewerEmails", "arrayConfig": "CONTAINS" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "externalEmails", "arrayConfig": "CONTAINS" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```
> ⚠️ The emulator does **not** enforce indexes. If any new query is added later (with `array-contains` + other filters or `orderBy`), add its index here. Missing indexes only show up in production.

**Acceptance:** JSON is valid; a comment in DEVELOPMENT.md explains the warning above.

---

## 2.7 Security-rules tests
**Do:**
1. Root dev deps: `@firebase/rules-unit-testing`.
2. `tests/rules/vitest.config.ts` (node environment, `fileParallelism: false`, timeout 20s).
3. `tests/rules/helpers.ts`:
   - `initializeTestEnvironment({ projectId: 'demo-ba-dashboard-rules', firestore: { rules: readFileSync('firestore.rules','utf8'), host: '127.0.0.1', port: 8080 } })`
   - `as(email, { verified = true } = {})` → `testEnv.authenticatedContext(uidFromEmail(email), { email, email_verified: verified }).firestore()`
   - `seed()` using `testEnv.withSecurityRulesDisabled` — config (domain `example.com`, admin `admin@example.com`, external sharing on), a group, and reports covering every case below.
   - `beforeEach` → `clearFirestore()` + `seed()`.
4. Root script: `"test:rules": "firebase emulators:exec --only firestore --project demo-ba-dashboard \"vitest run --config tests/rules/vitest.config.ts\""`.
5. Tests (use `assertSucceeds` / `assertFails`) — **all** of these:

| # | Case | Expected |
|---|---|---|
| 1 | Unauthenticated read of any report / config | ✘ |
| 2 | Signed in with `email_verified: false` | ✘ everywhere |
| 3 | Internal viewer `get` published report + content | ✔ |
| 4 | Internal viewer list query (`viewerEmails array-contains` + `status == published`) | ✔ |
| 5 | Internal viewer list query **without** the status filter | ✘ |
| 6 | Internal user not assigned: get report / content | ✘ |
| 7 | Internal viewer on a **draft** | ✘ |
| 8 | Viewer whose domain was removed from `allowedDomains` | ✘ |
| 9 | User from another domain listed in `viewerEmails` (not external) | ✘ |
| 10 | External viewer: get report + content (no expiry) | ✔ |
| 11 | External viewer list query on `externalEmails` | ✔ |
| 12 | External viewer, expiry in the past: content | ✘ (metadata ✔ — documented limitation) |
| 13 | External viewer, expiry in the future: content | ✔ |
| 14 | `allowExternalSharing = false`: external viewer | ✘ |
| 15 | Admin: read/write reports, content, groups, config, users | ✔ |
| 16 | Non-admin writes to reports / content / groups / config | ✘ |
| 17 | Non-admin reads `config/admins` | ✘ |
| 18 | Any verified user reads `config/access` | ✔ |
| 19 | User creates own profile with allowed fields | ✔ |
| 20 | User writes profile with extra field (e.g. `role`) | ✘ |
| 21 | User writes someone else's profile | ✘ |
| 22 | User writes profile with a different `email` | ✘ |
| 23 | Admin removes all admins (`emails: []`) | ✘ |
| 24 | Upper-case email in token (`Alice@Example.com`) matches lower-case data | ✔ |

**Acceptance:** `npm run test:rules` → all tests pass.

---

## 2.8 Continuous integration workflow
**Do:** `.github/workflows/ci.yml` — on `push` and `pull_request`:
1. `actions/checkout`, `actions/setup-node` (Node 22, npm cache), `actions/setup-java` (Temurin 21).
2. `npm ci`
3. `npm run check`
4. `npm run test:rules`
5. `npm run secrets:scan`

No secrets are needed (everything runs on emulators).

**Acceptance:** YAML is valid (`npx --yes yaml-lint .github/workflows/ci.yml` or equivalent). It will run for real once the repo is on GitHub (Phase 10).
