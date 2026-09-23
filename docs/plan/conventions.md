# Conventions & Working Rules

Read this file **before every work session**. It applies to every phase.

---

## 1. How an AI agent works through this plan

1. Open [`docs/PLAN.md`](../PLAN.md) and find the **first step whose status is ⬜ or 🔄**.
2. Open the phase file for that step (linked from PLAN.md) and read:
   - the phase **Context** section, and
   - the step itself.
     Read [`architecture.md`](architecture.md) sections only when the step references them.
3. Set the step's status in `docs/PLAN.md` to 🔄.
4. Do the step exactly as written. Where the plan says _"check the current docs"_, do so — library APIs change.
5. Run the step's **Acceptance checks** and `npm run check` (once it exists — from step 0.7).
6. Set the status to ✅. If you deviated from the plan, add a one-line note under the step in the phase file (`> Note (YYYY-MM-DD): …`) and, if it changes a decision, add a row to the Decision log in PLAN.md.
7. Commit: `git add -A && git commit -m "Step X.Y: <step title>"`.
8. Continue with the next step, **unless**:
   - the next step is marked **🔑 (user checkpoint)** → stop, tell the user which checkpoint in [`user-checkpoints.md`](user-checkpoints.md) to do, and wait;
   - the next step is marked **👤 (manual)** → stop and ask the user to do it;
   - you are blocked → set ⛔, write the reason under the step, and ask the user.
9. At the end of a phase, give the user a short summary: what was built, how to try it, anything they must decide.

### Hard rules

- **Never** create, request, print, or commit secrets. Never ask the user to paste a service-account key into the chat — only its **file path**.
- **Never** run anything against a real Firebase project before Phase 9. Everything before Phase 9 uses the **emulators** with the demo project ID `demo-ba-dashboard`.
- **Never** run `firebase deploy` or any command that changes a real project without asking the user first in that session.
- Don't change a decision in the Decision log silently — ask the user.
- Don't skip acceptance checks. If a check can't be run (e.g. needs a browser), say so and describe how the user can check it.
- Keep changes scoped to the current step.

---

## 2. Prerequisites (checked in step 0.2)

| Tool     | Version                              | Why                                 |
| -------- | ------------------------------------ | ----------------------------------- |
| Node.js  | 22 LTS or newer (24 LTS recommended) | Everything                          |
| npm      | 10+ (comes with Node)                | Workspaces                          |
| Java JDK | 21 or newer                          | The Firestore emulator runs on Java |
| Git      | any recent                           | Version control                     |

`firebase-tools` is installed as a **root devDependency** and used through npm scripts / `npx firebase` — no global install.

---

## 3. Library versions

- Install the **latest stable** version of each library at the time of the step (`npm install <pkg>`). Do **not** pin versions from memory.
- If an API described in this plan differs from the installed version's official docs, **follow the docs** and add a note to the step.
- After install, the lockfile (`package-lock.json`) is committed.

### Chosen libraries

| Area                | Package(s)                                                                                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language / build    | `typescript`, `tsx` (run TS directly), `tsup` (bundle tools)                                                                                                                                             |
| Lint / format       | `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `prettier`, `eslint-config-prettier`                                                 |
| Tests               | `vitest`, `@firebase/rules-unit-testing`                                                                                                                                                                 |
| Git hooks / secrets | `lefthook`, `secretlint`, `@secretlint/secretlint-rule-preset-recommend`                                                                                                                                 |
| Dev orchestration   | `concurrently`, `firebase-tools`                                                                                                                                                                         |
| Web                 | `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `react-router` (v7, data mode), `tailwindcss` + `@tailwindcss/vite` (v4), shadcn/ui components, `lucide-react`, `sonner`, `firebase` (modular SDK) |
| Tools (CLI + MCP)   | `firebase-admin`, `commander`, `zod`, `dotenv`, `@modelcontextprotocol/sdk`, `open`, `csv-parse`, `exceljs`                                                                                              |
| Report charts       | Apache ECharts from `cdn.jsdelivr.net` (pin the exact version in the template)                                                                                                                           |

---

## 4. Workspace layout & naming

| Workspace | Package name | Purpose                                              |
| --------- | ------------ | ---------------------------------------------------- |
| `shared/` | `@ba/shared` | Types, constants, pure helpers (no Firebase imports) |
| `web/`    | `@ba/web`    | React app                                            |
| `tools/`  | `@ba/tools`  | CLI + MCP server + scripts (setup, seed)             |

- All packages are ESM (`"type": "module"`), TypeScript `strict: true`.
- `@ba/shared` exports its TypeScript source directly (`"exports": { ".": "./src/index.ts" }`). Vite compiles it for `web`; `tsup` bundles it into `tools/dist` (`noExternal: ['@ba/shared']`); `tsx` handles it in dev.
- File names: `kebab-case.ts` for modules, `PascalCase.tsx` for React components, `useThing.ts` for hooks.
- Named exports only (except where a tool requires a default export, e.g. `vite.config.ts`).
- Comments explain _why_, not _what_. Keep them short.

---

## 5. Coding rules

- **Emails:** always pass through `normalizeEmail()` from `@ba/shared` (trim + lower-case) before storing or comparing.
- **Firestore access in the web app** lives only in `web/src/lib/firestore/*.ts` (and hooks in `web/src/hooks/`). Components never call Firestore directly.
- **Every write** to a report sets `updatedAt: serverTimestamp()` and `updatedBy: <email or "cli:<email>">`.
- **Never** use a Firestore field path containing an email (e.g. `externalExpiry.${email}`) — dots in emails break field paths. Always write the **whole** `externalExpiry` map.
- **Batched writes** must stay ≤ 500 operations; split larger batches.
- **Errors:** show a toast (web) or a `✗ …` line (CLI). Never swallow errors silently. Map Firestore `permission-denied` to a friendly message.
- **No `any`** unless unavoidable (add a comment why).
- **Accessibility:** every input has a label, every icon-only button has `aria-label`, focus states are visible.
- **UI text:** plain, short English. Dates shown as relative ("2 days ago") with the exact date in a tooltip.

---

## 6. Standard commands (final state)

| Command                                   | What it does                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| `npm run dev`                             | Emulators + web app (http://localhost:5173), emulator UI at http://localhost:4000       |
| `npm run emulators`                       | Emulators only (data persisted in `.emulator-data/`)                                    |
| `npm run emulators:reset`                 | Delete persisted emulator data                                                          |
| `npm run seed`                            | Load demo data into the emulators                                                       |
| `npm run setup -- --domains … --admins …` | Write access config (emulator by default)                                               |
| `npm run check`                           | Lint + typecheck + unit tests (must pass before a step is ✅)                           |
| `npm run test:rules`                      | Security-rules tests against the Firestore emulator                                     |
| `npm run report -- <command>`             | Report CLI (new, build, preview, publish, list, access, …)                              |
| `npm run build`                           | Build all packages                                                                      |
| `npm run preview:hosting`                 | Build web for emulators and serve it from the Hosting emulator (tests real headers/CSP) |
| `npm run deploy`                          | Phase 9+: build and deploy to the real project (ask the user first)                     |

---

## 7. Definition of Done (every step)

- [ ] Step instructions completed
- [ ] Acceptance checks pass (or are described for the user if they need a browser)
- [ ] `npm run check` passes (from step 0.7 on)
- [ ] No secrets or real company data added to git (`git status` / `git diff --cached` reviewed)
- [ ] `docs/PLAN.md` status updated
- [ ] Committed as `Step X.Y: <title>`
