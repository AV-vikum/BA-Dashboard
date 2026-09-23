# BA-Dashboard — Development Plan & Status

> **What this is:** a private report portal. An admin creates dashboard-style reports (charts, KPIs, tables) with Claude, publishes them, and assigns them to people. Each person signs in with Google and sees only the reports assigned to them — each at its own shareable URL. Access is organization-only by default (configurable email domains), with optional per-report sharing to outside people.

**Last updated:** 2026-09-23

This file is the **status tracker**. The detailed instructions are in [`docs/plan/`](plan/):

| File                                            | Contents                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [conventions.md](plan/conventions.md)           | **Read first.** Working rules for AI agents, libraries, coding rules, Definition of Done |
| [architecture.md](plan/architecture.md)         | System design, repo layout, environments, config & secrets, data model, security rules   |
| [user-checkpoints.md](plan/user-checkpoints.md) | 🔑 Steps **you** do (Firebase project, keys, GitHub) — all in Phase 9+                   |
| `phase-N-*.md`                                  | Step-by-step instructions per phase                                                      |

## How to use this plan

**You (the owner):** start a session with Claude (Sonnet is fine) and say:

> "Continue the development plan in docs/PLAN.md."

The agent picks the next open step, does it, updates the status here, commits, and stops when it needs you (🔑 / 👤) or at the end of a phase. To run one phase per conversation (cheaper), say: _"Do Phase 3 of the plan."_

**AI agents:** follow [conventions.md §1](plan/conventions.md#1-how-an-ai-agent-works-through-this-plan).

## Status legend

| Icon | Meaning                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------- |
| ⬜   | Not started                                                                                             |
| 🔄   | In progress                                                                                             |
| ✅   | Done                                                                                                    |
| ⛔   | Blocked (reason noted under the step in the phase file)                                                 |
| ⏭️   | Skipped / moved to backlog                                                                              |
| 👤   | Needs a quick decision or manual action from the user                                                   |
| 🔑   | User checkpoint — Firebase / Google Cloud / GitHub setup or secrets ([guide](plan/user-checkpoints.md)) |

## When you'll need Firebase keys and secrets

**Not until Phase 9.** Phases 0–8 run entirely on the Firebase **emulators** with the fake project `demo-ba-dashboard` — no account, no keys. The agent will stop and tell you when each checkpoint is due:

| Checkpoint | Step | What you'll do                                                                                                       |
| ---------- | ---- | -------------------------------------------------------------------------------------------------------------------- |
| 🔑 CP-1    | 9.1  | Create the Firebase project, enable Google sign-in + Firestore, copy the web config into `web/.env.production.local` |
| 🔑 CP-2    | 9.3  | `npx firebase login` + `npx firebase use --add` in your terminal                                                     |
| 🔑 CP-3    | 9.5  | Download the service-account key to a folder **outside** the repo; fill `tools/.env.production`                      |
| 🔑 CP-4    | 9.8  | Restrict authorized domains and the API key                                                                          |
| 🔑 CP-5    | 10.5 | Create the GitHub repo, enable secret scanning, push                                                                 |
| 🔑 CP-6    | 10.6 | _(optional)_ Automatic deploys from GitHub                                                                           |

---

## Progress

### Phase 0 — Repository foundation · [details](plan/phase-0-foundation.md)

| #    | Step                                                | Status |
| ---- | --------------------------------------------------- | ------ |
| 0.1  | Development plan and CLAUDE.md                      | ✅     |
| 0.2  | Check prerequisites (Node, Java, Git) 👤 if missing | ✅     |
| 0.3  | Root npm workspace                                  | ✅     |
| 0.4  | `.gitignore` (secrets, env files, reports)          | ✅     |
| 0.5  | `shared` package skeleton                           | ✅     |
| 0.6  | `tools` package skeleton                            | ✅     |
| 0.7  | Lint, format, typecheck, `npm run check`            | ✅     |
| 0.8  | Example config files                                | ✅     |
| 0.9  | Pre-commit secret scanning                          | ✅     |
| 0.10 | License and README skeleton 👤 confirm license      | ✅     |

### Phase 1 — Local environment (emulators) · [details](plan/phase-1-local-environment.md)

| #   | Step                                           | Status |
| --- | ---------------------------------------------- | ------ |
| 1.1 | `firebase.json`, placeholder rules and indexes | ✅     |
| 1.2 | Emulator scripts with persistent data          | ✅     |
| 1.3 | Tools: environment + firebase-admin connection | ⬜     |
| 1.4 | Setup script (allowed domains, admins)         | ⬜     |
| 1.5 | Seed script (demo data)                        | ⬜     |
| 1.6 | `docs/DEVELOPMENT.md`                          | ⬜     |

### Phase 2 — Data model & security rules · [details](plan/phase-2-data-and-rules.md)

| #   | Step                            | Status |
| --- | ------------------------------- | ------ |
| 2.1 | Shared types and constants      | ⬜     |
| 2.2 | Email and domain helpers        | ⬜     |
| 2.3 | Access computation helpers      | ⬜     |
| 2.4 | Search helper                   | ⬜     |
| 2.5 | Firestore Security Rules        | ⬜     |
| 2.6 | Firestore indexes               | ⬜     |
| 2.7 | Security-rules tests (24 cases) | ⬜     |
| 2.8 | CI workflow (GitHub Actions)    | ⬜     |

### Phase 3 — Web app: viewer · [details](plan/phase-3-web-viewer.md)

| #    | Step                                 | Status |
| ---- | ------------------------------------ | ------ |
| 3.1  | Scaffold web app + `npm run dev`     | ⬜     |
| 3.2  | Firebase init and env validation     | ⬜     |
| 3.3  | Routing and app shell                | ⬜     |
| 3.4  | Authentication (Google sign-in)      | ⬜     |
| 3.5  | "No access" page                     | ⬜     |
| 3.6  | My reports page (list, search, tags) | ⬜     |
| 3.7  | Report viewer (sandboxed iframe)     | ⬜     |
| 3.8  | Error pages                          | ⬜     |
| 3.9  | Security headers and CSP             | ⬜     |
| 3.10 | Theme, responsiveness, accessibility | ⬜     |

### Phase 4 — Web app: admin · [details](plan/phase-4-web-admin.md)

| #    | Step                                              | Status |
| ---- | ------------------------------------------------- | ------ |
| 4.1  | Admin guard and layout                            | ⬜     |
| 4.2  | Admin data layer                                  | ⬜     |
| 4.3  | Reports page                                      | ⬜     |
| 4.4  | Create / replace report from HTML                 | ⬜     |
| 4.5  | Report detail page (preview, details)             | ⬜     |
| 4.6  | Access panel (people, groups, external)           | ⬜     |
| 4.7  | People page                                       | ⬜     |
| 4.8  | Groups page                                       | ⬜     |
| 4.9  | Settings page (domains, admins, external sharing) | ⬜     |
| 4.10 | View as user                                      | ⬜     |
| 4.11 | Admin end-to-end check                            | ⬜     |

### Phase 5 — Report authoring toolkit · [details](plan/phase-5-report-toolkit.md)

| #   | Step                                                  | Status |
| --- | ----------------------------------------------------- | ------ |
| 5.1 | `report.json` schema                                  | ⬜     |
| 5.2 | Base styles (`base.css`)                              | ⬜     |
| 5.3 | Helper API (`base.js`)                                | ⬜     |
| 5.4 | Starter files                                         | ⬜     |
| 5.5 | Build/validate + `new` / `build` / `preview` commands | ⬜     |
| 5.6 | Example report (fake data)                            | ⬜     |
| 5.7 | Seed uses the example report                          | ⬜     |

### Phase 6 — Publish CLI · [details](plan/phase-6-publish-cli.md)

| #   | Step                                 | Status |
| --- | ------------------------------------ | ------ |
| 6.1 | Publish core                         | ⬜     |
| 6.2 | `report publish`                     | ⬜     |
| 6.3 | `report list` and `report groups`    | ⬜     |
| 6.4 | `report access`                      | ⬜     |
| 6.5 | `report pull` and `report unpublish` | ⬜     |
| 6.6 | Tests (unit + emulator integration)  | ⬜     |

### Phase 7 — MCP server · [details](plan/phase-7-mcp-server.md)

| #   | Step                                         | Status |
| --- | -------------------------------------------- | ------ |
| 7.1 | Server skeleton and build                    | ⬜     |
| 7.2 | Tools                                        | ⬜     |
| 7.3 | Safety                                       | ⬜     |
| 7.4 | Client configuration (Claude Code / Desktop) | ⬜     |
| 7.5 | End-to-end test with Claude Code             | ⬜     |

### Phase 8 — Claude skill · [details](plan/phase-8-claude-skill.md)

| #   | Step                              | Status |
| --- | --------------------------------- | ------ |
| 8.1 | Skill structure                   | ⬜     |
| 8.2 | `SKILL.md` workflow               | ⬜     |
| 8.3 | Reference files                   | ⬜     |
| 8.4 | End-to-end test                   | ⬜     |
| 8.5 | Using the skill in Claude Desktop | ⬜     |

### Phase 9 — Going live · [details](plan/phase-9-go-live.md)

| #    | Step                                       | Status |
| ---- | ------------------------------------------ | ------ |
| 9.1  | 🔑 CP-1 Create Firebase project + web app  | ⬜     |
| 9.2  | Verify the production build                | ⬜     |
| 9.3  | 🔑 CP-2 Firebase CLI login + project alias | ⬜     |
| 9.4  | Deploy rules and indexes (ask first)       | ⬜     |
| 9.5  | 🔑 CP-3 Service-account key                | ⬜     |
| 9.6  | Production access config (ask first)       | ⬜     |
| 9.7  | Deploy hosting (ask first)                 | ⬜     |
| 9.8  | 🔑 CP-4 Lock down domains and API key      | ⬜     |
| 9.9  | Production smoke test                      | ⬜     |
| 9.10 | Point Claude at production                 | ⬜     |

### Phase 10 — Documentation & open-source release · [details](plan/phase-10-open-source.md)

| #    | Step                                 | Status |
| ---- | ------------------------------------ | ------ |
| 10.1 | `docs/SETUP.md`                      | ⬜     |
| 10.2 | `docs/SECURITY.md` 👤 contact method | ⬜     |
| 10.3 | `CONTRIBUTING.md`                    | ⬜     |
| 10.4 | README with screenshots              | ⬜     |
| 10.5 | 🔑 CP-5 Publish to GitHub            | ⬜     |
| 10.6 | 🔑 CP-6 Automatic deploy (optional)  | ⬜     |
| 10.7 | Release v1.0.0                       | ⬜     |

---

## Backlog (after v1)

| #   | Idea                                                       | Notes                                                                     |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| B.1 | Version history per report                                 | `reports/{id}/versions/*`, restore button                                 |
| B.2 | View analytics (who opened what, when)                     | One write per view — fine on the free tier at small scale                 |
| B.3 | Email notification when access is given                    | Needs Cloud Functions → Blaze plan; interim: "Copy invite message" button |
| B.4 | Print / export to PDF                                      | Needs care with the sandboxed iframe                                      |
| B.5 | Favourites / pinned reports                                | Per user                                                                  |
| B.6 | Sign-in for outside people without a Google account        | Firebase email-link sign-in                                               |
| B.7 | Serve reports from a separate origin (second Hosting site) | Removes the CSP trade-off; strict CSP for the app                         |
| B.8 | Remote MCP server so other analysts can publish            | Cloud Run / Functions + auth → Blaze plan                                 |
| B.9 | Scheduled data refresh                                     | Re-run `build-data` + publish on a schedule                               |

---

## Decision log

| Date       | Decision                                                                                                             | Why                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 2026-09-23 | Firebase Spark plan: Hosting + Auth + Firestore                                                                      | Free, simple, fits the scale                                                            |
| 2026-09-23 | Google sign-in only (v1)                                                                                             | Organization uses Google accounts                                                       |
| 2026-09-23 | Report HTML stored in Firestore, not as Hosting files                                                                | Hosting files are public to anyone with the URL                                         |
| 2026-09-23 | Reports rendered in a sandboxed iframe without `allow-same-origin`                                                   | Reports are AI-generated code; they must not reach the viewer's session                 |
| 2026-09-23 | Allowed domains + external-sharing switch in `config/access`; admins in `config/admins`                              | Editable in the UI and readable by Security Rules; admin list not exposed to non-admins |
| 2026-09-23 | External sharing per report, optional expiry, global switch                                                          | Some reports go to outside people                                                       |
| 2026-09-23 | No watermark                                                                                                         | Internal audience                                                                       |
| 2026-09-23 | Emulator-first development with demo project `demo-ba-dashboard`                                                     | No real project or secrets needed until Phase 9; safe for contributors                  |
| 2026-09-23 | `web/.env.development` (demo values) is committed; all real config is git-ignored with `*.example` files             | Clone-and-run works instantly; no secrets in git                                        |
| 2026-09-23 | Tools target chosen by `BA_TARGET` (emulator default, production opt-in)                                             | Prevents accidental writes to production                                                |
| 2026-09-23 | Claude integration: local stdio MCP server + CLI sharing one core                                                    | Works in Claude Desktop and Claude Code; no server cost                                 |
| 2026-09-23 | `report.json` owns content/metadata; access applied only on first publish, then managed in the web UI / `set_access` | Avoids re-publishing silently overwriting access changes                                |
| 2026-09-23 | Separate `data.json` (built by `build-data.mjs`) from `report.html`; base template inlined at build                  | Monthly refresh without regenerating design; less Claude usage                          |
| 2026-09-23 | v1 CSP allows `'unsafe-inline'` scripts + chart CDNs                                                                 | `srcdoc` iframes inherit the app CSP; separate origin is backlog B.7                    |
| 2026-09-23 | secretlint (pre-commit + CI) + GitHub push protection                                                                | npm-only tooling works on Windows for every contributor                                 |
