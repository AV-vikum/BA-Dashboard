# Phase 9 — Going live (real Firebase project)

## Context

This is the **first phase that touches a real Firebase project**. It alternates between **🔑 user checkpoints** (the user does something in a web console or an interactive terminal — see [user-checkpoints.md](user-checkpoints.md)) and agent steps.

Agent rules for this phase:

- At every 🔑 step: **stop**, tell the user exactly which checkpoint to do (link it), and wait for them to say it's done.
- **Ask before every deploy** or production write, even if a previous deploy was approved.
- Never ask for or display secret values. The service-account key is referenced only by **file path**.

---

## 9.1 🔑 CP-1 — Create the Firebase project and web app

User follows **CP-1**. Result: project exists (Spark plan), Google sign-in enabled, Firestore created, `web/.env.production.local` filled in.

---

## 9.2 Verify the production build

**Do:**

1. Confirm `web/.env.production.local` exists and is git-ignored (`git check-ignore -v web/.env.production.local`). Don't print its contents; only check that every required variable is present and `VITE_USE_EMULATORS` is `false` or absent.
2. `npm run build -w web` — must succeed.
3. Check `web/dist` doesn't contain `127.0.0.1:9099` connection code paths being **executed** (emulator connection only runs when `VITE_USE_EMULATORS === 'true'`).

**Acceptance:** build succeeds.

---

## 9.3 🔑 CP-2 — Firebase CLI login and project alias

User follows **CP-2** (interactive login in their own terminal). Result: `.firebaserc` exists (git-ignored).

Agent verifies: `npx firebase projects:list` shows the project; `git check-ignore -v .firebaserc` confirms it's ignored.

---

## 9.4 Deploy Firestore rules and indexes (ask first)

**Do:**

1. Ask the user: _"Ready to deploy Security Rules and indexes to `<project-id>`?"_
2. `npx firebase deploy --only firestore:rules,firestore:indexes`
3. Indexes can take a few minutes to build — check status in the console (Firestore → Indexes) and tell the user.

**Acceptance:** deploy succeeds; both composite indexes show **Enabled**.

---

## 9.5 🔑 CP-3 — Service-account key for the CLI / MCP server

User follows **CP-3**. Result: key JSON saved **outside the repo**, `tools/.env.production` filled in.

Agent verifies (without reading the key): the file path in `GOOGLE_APPLICATION_CREDENTIALS` exists and is outside the repo; `tools/.env.production` is git-ignored.

---

## 9.6 Production access config (ask first)

**Do:**

1. Ask the user for: allowed domain(s), admin email(s), external sharing on/off.
2. Run (after the user confirms):
   `BA_TARGET=production npm run setup -- --domains <domains> --admins <emails> --external <on|off> --yes`
   (On Windows PowerShell: `$env:BA_TARGET='production'; npm run setup -- …`; then `Remove-Item Env:BA_TARGET`.)

**Acceptance:** `config/access` and `config/admins` exist in the Firebase console.

---

## 9.7 Deploy hosting (ask first)

**Do:**

1. Root script: `"deploy": "npm run build -w web && firebase deploy --only hosting"` and `"deploy:all": "npm run build -w web && firebase deploy --only hosting,firestore:rules,firestore:indexes"`.
2. Ask the user, then `npm run deploy`.
3. Give the user the Hosting URL (`https://<project-id>.web.app`).

**Acceptance:** the URL loads the login page.

---

## 9.8 🔑 CP-4 — Lock down authorized domains and the API key

User follows **CP-4**.

---

## 9.9 Production smoke test

**Do:** with the user, walk through (record results under this step):

1. Admin signs in with their real Google account → sees Admin.
2. Publish `_example` to production: `BA_TARGET=production npm run report -- publish _example` (after asking). It adds the production project's id to `reportIds` in `reports/_example/report.json` — **don't commit** that change (`git checkout reports/_example/report.json`).
3. Assign a real colleague (internal) → they see it; an unassigned colleague does not.
4. Share externally with a personal Gmail address with expiry → it works; set expiry to yesterday → content blocked.
5. Open on a phone.
6. Browser console: no CSP errors.
7. Delete the test report.

**Acceptance:** all pass.

---

## 9.10 Point Claude at production

**Do:**

1. Update the user's **local** `.mcp.json` / Claude Desktop config: `"env": { "BA_TARGET": "production" }` (explain that removing it switches back to the emulator).
2. Document the daily workflow in `docs/DEVELOPMENT.md`: production for real reports; emulator for developing the app itself.

**Acceptance:** `list_reports` from Claude shows `[production]`.
