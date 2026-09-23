# Phase 0 — Repository foundation

## Context
Set up an npm-workspaces monorepo (`shared`, `web`, `tools`), code-quality tooling, git-ignore rules that keep secrets and company data out of git, and a pre-commit secret scanner. **No Firebase yet.** Read [conventions.md](conventions.md) first.

---

## 0.1 Development plan and CLAUDE.md ✅
Done: `docs/PLAN.md`, `docs/plan/*`, `CLAUDE.md`.

---

## 0.2 Check prerequisites 👤 (only if something is missing)
**Do:**
1. Run `node -v`, `npm -v`, `java -version`, `git --version`.
2. Compare against [conventions §2](conventions.md#2-prerequisites-checked-in-step-02).
3. If something is missing or too old, **stop** and tell the user what to install. On Windows:
   - Node: `winget install OpenJS.NodeJS.LTS`
   - Java 21: `winget install EclipseAdoptium.Temurin.21.JDK` (open a new terminal afterwards)
   The user installs it; then continue.

**Acceptance:** all four commands print versions that meet the minimums.

---

## 0.3 Root workspace
**Do:**
1. Create root `package.json`:
   ```json
   {
     "name": "ba-dashboard",
     "private": true,
     "type": "module",
     "workspaces": ["shared", "web", "tools"],
     "engines": { "node": ">=22" },
     "scripts": {}
   }
   ```
2. Create `tsconfig.base.json` with: `"target": "ES2022"`, `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"strict": true`, `"noUncheckedIndexedAccess": true`, `"esModuleInterop": true`, `"skipLibCheck": true`, `"resolveJsonModule": true`, `"isolatedModules": true`, `"verbatimModuleSyntax": true`.
3. Install root dev dependencies: `typescript tsx vitest concurrently firebase-tools`.
4. Create `.editorconfig` (utf-8, LF, 2-space indent, final newline) and `.gitattributes` with `* text=auto eol=lf`.

**Acceptance:** `npm install` completes without errors from the root.

---

## 0.4 `.gitignore`
**Do:** create `.gitignore` with exactly these sections (add framework defaults as needed):
```gitignore
# Dependencies & builds
node_modules/
dist/
*.tsbuildinfo
coverage/

# Environment files — only examples and the demo dev file are committed.
# The "!" lines must stay AFTER the ignore lines (the last matching rule wins).
**/.env
**/.env.*
!**/.env.example
!web/.env.development

# Firebase
.firebaserc
.firebase/
.emulator-data/
firebase-debug.log*
firestore-debug.log*
ui-debug.log*
database-debug.log*
pubsub-debug.log*

# Secrets (defence in depth — keys must live OUTSIDE the repo anyway)
*service-account*.json
*serviceAccount*.json
*-firebase-adminsdk-*.json
*.pem
*.key

# MCP client config (may contain local paths)
.mcp.json

# Reports: company data stays local. Only the example is committed.
reports/*
!reports/_example/
reports/_example/dist/

# OS / editor
.DS_Store
Thumbs.db
.vscode/*
!.vscode/extensions.json
.idea/
```

**Acceptance:** create these dummy files, run `git status`, confirm **none** are listed, then delete them:
`.env`, `web/.env.production.local`, `tools/.env.production`, `my-service-account.json`, `.firebaserc`, `.mcp.json`, `reports/secret-report/report.html`.
And confirm `web/.env.development` **would** be tracked (`git check-ignore -v web/.env.development` prints nothing).

---

## 0.5 `shared` package skeleton
**Do:**
1. `shared/package.json`:
   ```json
   {
     "name": "@ba/shared",
     "version": "0.0.0",
     "private": true,
     "type": "module",
     "exports": { ".": "./src/index.ts" },
     "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
     "dependencies": { "zod": "*" }
   }
   ```
   (Install `zod` so the real version replaces `*`.)
2. `shared/tsconfig.json` extends `../tsconfig.base.json`, `include: ["src"]`.
3. `shared/src/index.ts` exporting a placeholder `export const APP_ID = 'ba-dashboard';`
4. `shared/src/index.test.ts` with one trivial test.

**Acceptance:** `npm test -w shared` passes; `npm run typecheck -w shared` passes.

---

## 0.6 `tools` package skeleton
**Do:**
1. `tools/package.json` (`@ba/tools`, private, ESM) with dependency `"@ba/shared": "*"` and scripts `test`, `typecheck`, `build` (tsup — configured in 6.x/7.x; for now `"build": "echo tools build not configured yet"`).
2. `tools/tsconfig.json` extends base, `"types": ["node"]`; install `@types/node` as a dev dependency.
3. `tools/src/cli.ts` printing `ba-dashboard tools` (placeholder).
4. Root script: `"report": "tsx tools/src/cli.ts"`.

**Acceptance:** `npm run report` prints the placeholder text.

> The `web` workspace is created in step 3.1 (Vite scaffolding). Until then, npm may warn that `web` is missing — create an empty `web/package.json` (`{"name":"@ba/web","private":true,"version":"0.0.0"}`) to avoid that.

---

## 0.7 Lint, format, typecheck, `npm run check`
**Do:**
1. Install root dev deps: `eslint @eslint/js typescript-eslint globals prettier eslint-config-prettier eslint-plugin-react-hooks eslint-plugin-react-refresh`.
2. `eslint.config.js` (flat config): recommended JS + typescript-eslint recommended for `**/*.{ts,tsx}`; react-hooks + react-refresh for `web/**/*.tsx`; `eslint-config-prettier` last; ignore `**/dist`, `**/node_modules`, `.emulator-data`, `reports/**/dist`, `templates/**` (plain browser JS is linted separately in 5.3 if needed).
3. `.prettierrc.json`: `{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "all" }` and `.prettierignore` (dist, coverage, package-lock.json, .emulator-data).
4. Root scripts:
   ```json
   "lint": "eslint .",
   "format": "prettier --write .",
   "format:check": "prettier --check .",
   "typecheck": "npm run typecheck --workspaces --if-present",
   "test": "npm run test --workspaces --if-present",
   "check": "npm run lint && npm run format:check && npm run typecheck && npm run test"
   ```

**Acceptance:** `npm run check` passes.

---

## 0.8 Example config files
**Do:** create these files with **placeholder** values and a comment on every line explaining it (use the tables in [architecture A4](architecture.md#a4-configuration--secrets)):
1. `web/.env.example` — all `VITE_*` variables, with a header comment: *"Copy to `.env.production.local` for your real Firebase project. Never commit that file."*
2. `web/.env.development` — the **demo** values from A4 (`demo-api-key`, `demo-ba-dashboard`, `VITE_USE_EMULATORS=true`). Header comment: *"Demo values for the local emulators. Safe to commit — contains no secrets."*
3. `tools/.env.example` — all tools variables, header: *"Copy to `tools/.env.production` when going live (Phase 9). GOOGLE_APPLICATION_CREDENTIALS must point to a file OUTSIDE this repository."*
4. `.firebaserc.example`:
   ```json
   { "projects": { "default": "your-firebase-project-id" } }
   ```
5. `.mcp.json.example` — filled in step 7.4; for now `{ "mcpServers": {} }`.

**Acceptance:** `git status` lists all five files as new (none of them is ignored); they contain no real values.

---

## 0.9 Pre-commit secret scanning
**Do:**
1. Install root dev deps `lefthook secretlint @secretlint/secretlint-rule-preset-recommend`.
2. `.secretlintrc.json`: `{ "rules": [{ "id": "@secretlint/secretlint-rule-preset-recommend" }] }`
3. `lefthook.yml`:
   ```yaml
   pre-commit:
     commands:
       secretlint:
         glob: "*"
         run: npx secretlint {staged_files}
   ```
4. Add root script `"prepare": "lefthook install"` and run `npm run prepare`.
5. Add root script `"secrets:scan": "secretlint \"**/*\""`.

**Acceptance:**
1. Create `tmp-secret-test.txt` containing a fake private key block (a line `-----BEGIN PRIVATE KEY-----`, a line of random base64 text, a line `-----END PRIVATE KEY-----`), `git add` it, try to commit → the commit is **blocked**.
2. `git reset tmp-secret-test.txt` and delete the file.
3. `npm run secrets:scan` reports nothing.

---

## 0.10 License and README skeleton 👤 (confirm license)
**Do:**
1. Ask the user to confirm: license **MIT** (proposed) and the **copyright holder name** to use.
2. Create `LICENSE` with the confirmed text and year 2026.
3. Replace `README.md` with a skeleton: project name, one-paragraph description, "Status: in development", links to `docs/PLAN.md` and `docs/DEVELOPMENT.md` (created in 1.6). The full README comes in Phase 10.

**Acceptance:** files exist; `npm run check` passes.
