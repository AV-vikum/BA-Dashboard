# Phase 10 — Documentation & open-source release

## Context

Make the repository safe and easy for anyone to fork, configure with their own Firebase project, and deploy.

---

## 10.1 `docs/SETUP.md` — fork → configure → deploy

**Do:** a complete guide for a new person, reusing the click-by-click text from [user-checkpoints.md](user-checkpoints.md) (CP-1 … CP-4) but written for a generic reader:

1. Prerequisites.
2. Try it locally first (emulators, seed, demo accounts) — no Firebase account needed.
3. Create a Firebase project (CP-1), fill `web/.env.production.local`.
4. CLI login + project alias (CP-2).
5. Deploy rules + indexes; run `setup` with their domains/admins.
6. Deploy hosting; lock down domains + API key (CP-4).
7. Service account for publishing (CP-3) + `tools/.env.production`.
8. Connect Claude Code / Claude Desktop (MCP + skill).
9. Branding (`VITE_APP_*`).
10. Troubleshooting: missing index errors, `permission-denied`, popup blocked, unverified email, CSP errors, emulator not running.

**Acceptance:** someone could follow it without other docs.

---

## 10.2 `docs/SECURITY.md`

**Do:** sections: what is secret vs not (web API key is public; service-account key is secret); how access control works (rules summary, sandboxed iframe, CSP trade-off); rotating a leaked service-account key (delete key in Google Cloud Console → IAM → Service accounts → Keys, create a new one, update the path); what to do if a secret was committed (rotate first, then clean history); reporting vulnerabilities (contact method chosen by the user 👤).

**Acceptance:** written; user confirmed the contact method.

---

## 10.3 `CONTRIBUTING.md`

**Do:** dev setup (link DEVELOPMENT.md), branch/commit conventions, `npm run check` + `npm run test:rules` before PRs, the rule that security-rule changes need tests, no real data in `reports/`.

---

## 10.4 README

**Do:** final README: what it is, feature list, screenshots (take them from the **emulator** with demo data — never real reports; store in `docs/images/`), architecture diagram (from A1), quick start (emulator), link to SETUP.md, "Create reports with Claude" section, license.

---

## 10.5 🔑 CP-5 — Publish to GitHub

User follows **CP-5**. Before that, the agent runs and reports:

1. `npm run secrets:scan` → clean.
2. `git log --all --name-only --format="" | sort -u` → confirm no `.env*` (except examples / `web/.env.development`), `.firebaserc`, `.mcp.json`, key files, or real `reports/*` ever appeared in history.
3. `git grep -n -I -E "BEGIN (RSA )?PRIVATE KEY|private_key_id"` → no matches.

**Acceptance:** all three clean; user completed CP-5; CI runs green on GitHub.

---

## 10.6 🔑 CP-6 (optional) — Automatic deploy from GitHub

User follows **CP-6** if they want deploys on every push to `main`. Agent then reviews the generated workflow file(s) and makes sure the build step has the production web env (store `VITE_*` values as GitHub Actions **variables/secrets** and write them into `web/.env.production.local` in the workflow before building).

---

## 10.7 Release v1.0.0

**Do:** update `docs/PLAN.md` (all ✅), add a `CHANGELOG.md` entry, tag `v1.0.0` (ask the user before pushing tags).
