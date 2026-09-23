# Phase 4 — Web app: admin experience

## Context

Admin pages to view every report, manage access (people, groups, external), manage settings, and preview what a user sees. Admin status comes from `config/admins` (step 3.4). All writes go through `web/src/lib/firestore/admin.ts`. Reference: [A5–A7](architecture.md#a5-data-model-firestore).

Test as `admin@example.com` in the emulator.

---

## 4.1 Admin guard and layout

**Do:**

1. `RequireAdmin`: while loading → spinner; not admin → `MessagePage` "Admins only" (403) with a link home.
2. `AdminLayout`: left sidebar (desktop) / `Sheet` menu (mobile) with: **Reports**, **People**, **Groups**, **Settings**, plus "Back to my reports". Content area with a page header component (title, description, actions slot).
3. Child routes under `/admin`:

| Path                       | Page                        |
| -------------------------- | --------------------------- |
| `/admin`                   | redirect → `/admin/reports` |
| `/admin/reports`           | `AdminReportsPage`          |
| `/admin/reports/:reportId` | `AdminReportDetailPage`     |
| `/admin/people`            | `AdminPeoplePage`           |
| `/admin/groups`            | `AdminGroupsPage`           |
| `/admin/settings`          | `AdminSettingsPage`         |
| `/admin/view-as`           | `AdminViewAsPage`           |

**Acceptance:** admin can navigate all pages (placeholders); Alice gets the 403 page at `/admin/people`.

> Note (2026-09-24): `RequireAdmin` previously redirected non-admins to `/`; changed it to render a new `AdminForbiddenPage` (403 `MessagePage`, "Admins only") to match this step's acceptance check. `npm run check` and `npm run build -w web` pass; the live browser walk-through (admin navigating all pages, Alice hitting the 403) wasn't run this session because the emulators weren't up and a `vite` dev server for this project was already running/connected on port 5173 — starting a second one or the emulators risked colliding with that session. Please verify in the browser with `npm run dev` when convenient.

---

## 4.2 Admin data layer

**Do:** `web/src/lib/firestore/admin.ts` (+ hooks in `web/src/hooks/`). Every function sets `updatedAt`/`updatedBy` as per [conventions §5](conventions.md#5-coding-rules).

Reads (live `onSnapshot` hooks):

- `useAllReports()`, `useReport(id)`, `useGroups()`, `useUserProfiles()`, `useAccessConfig()`, `useAdmins()`.

Writes:

| Function                                                   | Behaviour                                                                                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createReportFromHtml({ title, description, tags, html })` | Batch: new `reports/{autoId}` (status `draft`, empty access, `slug: null`, `sizeBytes`) + `content/main`. Returns id. Rejects html > `REPORT_MAX_BYTES`. |
| `replaceReportHtml(id, html)`                              | Batch: update `content/main` + `sizeBytes`, `updatedAt`.                                                                                                 |
| `updateReportDetails(id, { title, description, tags })`    | Validate with `LIMITS`; tags normalized to lower-case.                                                                                                   |
| `setReportStatus(id, status)`                              | Sets `publishedAt` when publishing.                                                                                                                      |
| `deleteReport(id)`                                         | Batch delete `content/main` + report.                                                                                                                    |
| `updateReportAccess(id, change)`                           | Load groups, call `applyAccessChange` from `@ba/shared`, write the result; return `warnings`.                                                            |
| `saveGroup(group)`                                         | Create/update; then find reports with `groupIds array-contains id`, recompute `viewerEmails`, write in batches ≤ 500.                                    |
| `deleteGroup(id)`                                          | Remove id from every report's `groupIds`, recompute, delete group.                                                                                       |
| `updateAccessConfig(patch)` / `updateAdmins(emails)`       | Validate (non-empty lists, valid domains/emails).                                                                                                        |
| `cleanupExpiredExternal()`                                 | For every report with expired external entries, remove them. Returns count.                                                                              |

Unit-test the pure parts (validation, batch splitting) with Vitest; Firestore-touching functions are verified manually in the next steps.

**Acceptance:** `npm run check` passes.

> Note (2026-09-24): `subscribeAllReports`/`subscribeReport` already existed in `reports.ts` (built for the admin-sees-everything case in `useMyReports`) — re-exported from `admin.ts` instead of duplicating them. Pure helpers (`byteLength`, `normalizeTags`, batch-chunking) live in a separate `admin-helpers.ts` so they're unit-testable without a Firestore mock; `admin.ts` itself (all reads/writes) is not yet imported by any page, so it'll be exercised manually starting step 4.3.

---

## 4.3 Reports page

**Do:** `AdminReportsPage`:

1. Header: "Reports" + **New report** button (step 4.4).
2. Toolbar: search (uses `filterReports`), status filter (All / Published / Draft), tag filter (select), count.
3. Table (cards on mobile) columns: **Title** (+ tags below), **Status** badge, **Access** ("12 people · 2 external" — external badge amber if any expired), **Updated** (relative, tooltip exact + `updatedBy`), **Source** (`CLI` if `slug`, else `Web`), **Actions** menu: View (`/r/:id`), Manage (`/admin/reports/:id`), Copy link, Publish/Unpublish, Delete.
4. Delete → `AlertDialog` "Delete _<title>_? This can't be undone." → `deleteReport` → toast.
5. Row click → Manage.

**Acceptance (emulator):** all 5 demo reports listed incl. the draft; filters work; unpublish → Alice's list updates live; delete a report → gone for everyone (re-seed afterwards).

> Note (2026-09-24): the **New report** button opens `NewReportDialog`, a placeholder stub — the real dialog is step 4.4's scope per this step's own text. `npm run check` and the production build pass; the live emulator walk-through wasn't run this session (see the note under step 4.1 — no emulators running, and an existing dev server was already up on 5173). Please verify with `npm run dev` when convenient, ideally together with 4.4's check once the New report dialog is real.

---

## 4.4 Create / replace report from HTML

**Do:**

1. **New report** dialog: Title (required), Description, Tags (comma-separated → chips), HTML via **file picker / drag-and-drop** (`.html`) **or** a paste textarea (tabs). Show file size vs the limit; reject bigger files with a clear message.
2. On create → `createReportFromHtml` → navigate to its detail page, toast "Draft created — add people and publish when ready."
3. On the detail page (4.5), a **Replace HTML** action uses the same picker → `replaceReportHtml`.

**Acceptance:** upload `reports/_example/dist/report.html` (after Phase 5) or any small HTML file → draft appears, preview renders.

> Note (2026-09-24): built `HtmlSourcePicker` (file drag-and-drop/click or paste tabs, size-vs-limit display, rejects non-`.html` files and over-limit content) as a shared component used by both `NewReportDialog` (this step) and a new `ReplaceHtmlDialog` (used from the detail page, step 4.5), plus a shared `TagsInput` chip component (also needed by 4.5). `reports/_example` doesn't exist yet (Phase 5), so this step was checked with a small hand-written `.html` file instead — `npm run check` and the production build pass; the live emulator walk-through (draft appears, preview renders) is pending together with step 4.5's check, per the note under 4.1.

---

## 4.5 Report detail page — layout, preview, details

**Do:** `AdminReportDetailPage`:

1. Header: title, status badge, actions: **Publish/Unpublish** (primary), **Open as viewer**, **Copy link**, overflow menu (Replace HTML, Delete).
2. Two columns on desktop (preview left ~60%, side panel right); stacked on mobile.
3. Preview: same iframe component as the viewer (extract a shared `ReportFrame` component), fixed height with an "Open full screen" link.
4. Side panel tabs: **Details** | **Access** (4.6) | **Info**.
5. **Details** form: title, description, tags (chip input, lower-case, max 10). **Save** button enabled only when dirty. If `slug` is set, show the note from [A7](architecture.md#who-owns-what-report-folder-vs-web-ui).
6. **Info**: id, slug, size (KB), created/updated/published at + by.

**Acceptance:** edit title → saved → Alice's list shows the new title live.

> Note (2026-09-24): extracted the sandboxed iframe out of `ReportViewerPage` into a shared `ReportFrame` component (as instructed) and reused it here for the preview. The Access tab is a placeholder pending step 4.6. Content (the report HTML) is fetched once per `reportId`, not on every live metadata update, and explicitly re-fetched after Replace HTML — admins can always read `content/main` per the security rules, so no access-gating wait is needed the way the viewer page needs one. The Details form is keyed by `report.id` so switching reports (or a live update after Save) doesn't fight with in-progress local edits, instead of resetting via a setState-in-effect (which `npm run lint` flags as a cascading-render risk). `npm run check` and the production build pass; the live emulator walk-through wasn't run this session (see the note under 4.1).

---

## 4.6 Access panel

**Do:** tab **Access** with an explicit **Save changes** button (disabled until something changes; "Discard" resets). Sections:

1. **People in your organization**
   - Combobox (`Command` in a `Popover`) suggesting emails from user profiles + emails already used in any report/group; typing a new email is allowed (press Enter).
   - Several emails can be pasted at once (`parseEmailList`).
   - If an email is **outside** the allowed domains → inline prompt: "*x@gmail.com* is outside your organization. **Share externally?**" (disabled with an explanation if external sharing is off) → moves it to section 3.
   - Chips for current direct emails with remove (×).
2. **Groups** — multi-select of groups (name + member count); chips with remove.
3. **External people** — list rows: email, expiry (date picker, "No expiry" option), status badge (_Active_ / _Expired_ red), remove. Header shows a warning banner if `allowExternalSharing` is off: "External sharing is turned off in Settings — these people can't open the report."
4. **Summary** (collapsible): "_N_ people can view this report" → full list with source (Direct / group name / External). Draft reports show "Only admins can see drafts. Publish to give access."
5. Save → `updateReportAccess` → show returned warnings as toasts.

**Acceptance (emulator):** add `eve@example.com` → Eve sees the report; add group Management → Carol sees it; add `someone@gmail.test` → offered as external; set external expiry to yesterday → partner can't open content; remove Finance → Alice loses it (unless direct).

> Note (2026-09-24): built as a local `AccessDraft` (Save/Discard against a draft, not writing on every click) diffed against the original to produce an `AccessChange` for `updateReportAccess`. The people combobox (`EmailCombobox`, cmdk `Command` in a `Popover`) suggests emails from user profiles + group members, accepts pasted lists via `parseEmailList`, and routes an outside-domain email to External automatically (blocked with a toast if external sharing is off, per this step's spec). External rows use a `Calendar`-backed expiry popover ("No expiry" clears it) and an Active/Expired badge computed locally so it updates as the admin edits, before Save. The component is keyed by `report.id` from the parent (same reasoning as the Details tab in 4.5) so a live snapshot update doesn't clobber an in-progress draft. `npm run check` and the production build pass; the live emulator walk-through wasn't run this session (see the note under 4.1) — this is the step most worth a careful manual pass given its size, especially the external-sharing-off toast path and the expiry date picker.

---

## 4.7 People page

**Do:**

1. Build the people list in memory from: user profiles ∪ all `directEmails`/`externalEmails` of reports ∪ group members ∪ admin emails. One row per email.
2. Columns: person (avatar/name/email), **Type** (Internal / External — by domain), **Status** (Signed in / Not signed in yet), **Last sign-in**, **Reports** (count of reports they can view), **Groups**, **Admin** badge.
3. Search + filter by type.
4. Row click → `Sheet` with:
   - Reports they can access, each with _via_ (Direct / Group: Finance / External, with expiry) and an **Open as them** shortcut to View-as (4.10).
   - **Add to reports**: multi-select dialog of reports → for internal emails adds to `directEmails`; for external adds to `externalEmails` (asks for optional expiry) → batch update.
   - Remove **direct** or **external** access per report (× button). Access via group shows "via Finance — edit the group" link instead.

**Acceptance:** Alice's sheet shows Sales Overview (via Finance) and Partner Summary (via Finance); adding Alice to HR Headcount works; bulk-add a report to `newperson@example.com` who never signed in → shown as "Not signed in yet".

> Note (2026-09-24): pulled step 4.10's planned extraction forward — added `reportsVisibleTo(email, reports, { isAdmin, isInternal, allowExternalSharing }, now?)` to `@ba/shared` (with unit tests) now, since this step's own "Reports" count column and the person Sheet need the exact same "what can this email see" logic that mirrors the Security Rules read conditions; step 4.10 (View as user) will reuse it as instructed rather than rebuild it. The person Sheet shows access source (Direct/Group/External with expiry) via a small local `accessSourceLabel` helper, with remove buttons for Direct/External (Group access links to the Groups page instead, as specified) and an "Add to reports" dialog (`AddToReportsDialog`) that multi-selects candidate reports and calls `updateReportAccess` once per selection. `npm run check` and the production build pass; the live emulator walk-through wasn't run this session (see the note under 4.1).

---

## 4.8 Groups page

**Do:**

1. Cards/table: name, description, member count, number of reports using it.
2. Create/Edit dialog: name (required, unique case-insensitive), description, members (paste or add emails; **internal only** — others rejected with a message).
3. Group detail (sheet or section): members list, reports using this group (links).
4. Delete → confirm "Remove _Finance_ from N reports and delete it?" → `deleteGroup`.
5. Saving recomputes affected reports (4.2) and shows "Updated access on N reports".

**Acceptance:** add `eve@example.com` to Finance → Eve sees Sales Overview and Partner Summary; delete Management → Carol loses HR Headcount.

---

## 4.9 Settings page

**Do:** three cards:

1. **Allowed email domains** — list with remove, add input (validated with `isValidDomain`). Can't remove the last one. Before removing, show "_N_ people with access will lose it" (count emails in reports/groups with that domain).
2. **Admins** — list with remove, add email. Can't remove the last admin. Removing yourself asks for confirmation ("You'll lose admin access immediately").
3. **External sharing** — switch with explanation; below it **Expired external access**: list of (report, email, expired on) + **Remove all expired** → `cleanupExpiredExternal()`.

**Acceptance:** add domain `example.org` → a user `x@example.org` assigned to a report can now open it; turning external sharing off → partner can't see Partner Summary; cleanup removes `demo-expired`'s entry.

---

## 4.10 View as user

**Do:** `AdminViewAsPage`: email picker (same combobox as 4.6). Shows a banner "Viewing as *alice@example.com* — this is what they see" and renders the **same list component** as My reports (read-only; links open the admin preview). Logic: compute from `useAllReports()` in memory using the same rules as the real queries (published + internal-domain + `viewerEmails`, or external-sharing-on + `externalEmails` + not expired). Extract that logic into `@ba/shared` (`reportsVisibleTo(email, reports, accessConfig)`) with tests, and use it here.

**Acceptance:** results for every demo user match the table printed by the seed script (step 1.5).

---

## 4.11 Admin end-to-end check

**Do:** walk through this checklist in the emulator and record the result under this step:

1. Create a report from HTML → add Finance + one external with expiry next week → publish.
2. Alice sees it; partner sees it; Carol doesn't.
3. Edit details → changes appear live for Alice.
4. Unpublish → Alice and partner lose it.
5. View-as matches reality for Alice, Carol, partner.
6. Delete it.

**Acceptance:** all six pass.
