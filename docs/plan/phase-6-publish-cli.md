# Phase 6 — Publish CLI

## Context

CLI commands that talk to Firestore via `firebase-admin` (rules are bypassed — the CLI acts as admin). Target is the emulator unless `BA_TARGET=production` (Phase 9). All logic lives in `tools/src/core/*` so the MCP server (Phase 7) reuses it. Reference: [A7 ownership rules](architecture.md#who-owns-what-report-folder-vs-web-ui).

**Output style (token-friendly):** one line per result, `✓` success / `!` warning / `✗` error, exit code 1 on error. No stack traces unless `--verbose`.

---

## 6.1 Publish core — `tools/src/core/publish.ts`

**Do:** `publishReport(slug, { draft?: boolean })`:

1. `buildReport(slug)` (5.5) — stop on errors.
2. Read `report.json`.
3. **If `reportId` is null (first publish):**
   - Resolve `access.groups` names → group ids (case-insensitive). Unknown group → error listing available groups.
   - Use `applyAccessChange` (from `@ba/shared`) to build the access fields from `access.emails` / `groups` / `external` (+ `allowedDomains` from `config/access`). Print its warnings.
   - Create `reports/{autoId}` + `content/main` in one batch: metadata from `report.json`, `slug`, `status` (`draft` if `--draft`, else `report.json.status`), `sizeBytes`, timestamps, `createdBy`/`updatedBy` = `cli:<PUBLISHER_EMAIL>`.
   - Write the new `reportId` back into `report.json` (preserve formatting: 2-space JSON).
4. **If `reportId` exists (update):**
   - If the doc doesn't exist → error: _"Report <id> not found in <target>. If it was deleted, set reportId to null in report.json to create it again."_
   - Update content + title/description/tags/status/`sizeBytes`/`updatedAt`/`updatedBy`/`publishedAt` (if published). **Do not touch access fields.**
   - If the Firestore title/description/tags differ from `report.json` and were last updated by someone other than the CLI, print `! Details were edited in the web app and have been overwritten: title "…" → "…"`.
5. Return `{ id, url: <APP_URL>/r/<id>, status, bytes, viewerCount, externalCount, created: boolean, warnings }`.

**Acceptance:** unit-level test against the emulator in 6.6.

---

## 6.2 `report publish <slug> [--draft]`

**Do:** wire the command. Output examples:

```
[target: emulator (demo-ba-dashboard)]
✓ Created "Example Sales Dashboard" (published) → http://localhost:5173/r/Ab12Cd34 · 214 KB · 2 viewers, 0 external
```

```
✓ Updated "Example Sales Dashboard" → http://localhost:5173/r/Ab12Cd34 · 216 KB
```

**Acceptance:** publishing `_example` twice creates once and updates once (same URL); Alice (member of Finance) sees it in the web app.

---

## 6.3 `report list [--search <q>]` and `report groups`

**Do:**

- `list`: one line per report: `<id>  <status>  <slug or ->  "<title>"  <viewers>v/<external>e  <updated YYYY-MM-DD>`, sorted by updated desc; `--search` uses `matchesSearch`.
- `groups`: `<name> (<n> members): a@x.com, b@x.com` — truncate member list after 5 with `+N more`.

**Acceptance:** output matches the emulator data.

---

## 6.4 `report access <slug|id> …`

**Do:** options (all repeatable or comma-separated):
`--add <emails>`, `--remove <emails>`, `--add-group <names>`, `--remove-group <names>`, `--add-external <email[:YYYY-MM-DD]>`, `--remove-external <emails>`, `--show`.

1. Resolve `<slug|id>`: if a folder `reports/<slug>/report.json` has a `reportId`, use it; else treat as an id.
2. Load report + groups + access config → `applyAccessChange` → write → print a summary:
   ```
   ✓ Access updated for "Sales Overview": 14 viewers (+2, −1), 1 external
   ! x@gmail.com is outside allowed domains — use --add-external
   ```
3. `--show` prints current access (direct, groups, external with expiry/status).
4. After any change, if a local folder exists, refresh its `report.json` `access` block from Firestore (so the folder reflects reality).

**Acceptance:** add/remove person, group, external with expiry — verify in the web app's Access panel.

---

## 6.5 `report pull <id> [--slug <name>]` and `report unpublish <slug|id>`

**Do:**

- `pull`: creates/updates `reports/<slug>/` from Firestore: `report.json` (metadata + current access + reportId). If the folder doesn't exist, also writes `dist/report.html` from the stored HTML and a `README.txt` explaining that this report was created in the web app, so its source isn't available — edits should be made by rebuilding it from the starter. Default slug = slugified title.
- `unpublish`: sets status `draft`. Requires `--yes`; without it prints what would happen and exits.

**Acceptance:** pull a web-created report → folder appears; unpublish → report disappears for viewers.

---

## 6.6 Tests

**Do:**

1. Unit tests (no emulator): argument parsing helpers, slug/id resolution, output formatting.
2. Integration tests `tools/test/*.int.test.ts` run with `firebase emulators:exec --only firestore --project demo-ba-dashboard "vitest run --config tools/vitest.int.config.ts"` (root script `test:tools:int`): publish create → update → access change → unpublish, using a temporary reports dir (set `REPORTS_DIR` to a temp folder).
3. Add `npm run test:tools:int` to the CI workflow (step 2.8 file).

**Acceptance:** all tests pass locally.
