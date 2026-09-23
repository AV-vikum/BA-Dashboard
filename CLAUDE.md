# BA-Dashboard

Private report portal: admins build dashboard reports with Claude and publish them to a React + Firebase app; users sign in with Google and see only reports assigned to them.

## Working on this project
- The build follows **`docs/PLAN.md`** (status tracker) and **`docs/plan/`** (detailed steps).
- Before any work, read **`docs/plan/conventions.md`** — it defines the step workflow, hard rules, libraries, and Definition of Done.
- Work one step at a time, update its status in `docs/PLAN.md`, commit as `Step X.Y: <title>`.
- Stop at 🔑 / 👤 steps and tell the user what to do (`docs/plan/user-checkpoints.md`).

## Hard rules
- Develop against the **Firebase emulators** (`demo-ba-dashboard`). Never touch a real Firebase project before Phase 9, and always ask before deploying or writing to production.
- Never create, request, print, or commit secrets. Service-account keys are referenced by file path only and live outside the repo.
- Real report data (`reports/*` except `reports/_example`) never goes into git.
- Security Rules changes require updated tests in `tests/rules/` (`npm run test:rules`).

## Commands
See `docs/plan/conventions.md` §6 (e.g. `npm run dev`, `npm run check`, `npm run test:rules`, `npm run report -- <cmd>`).

## Creating reports
Use the `create-report` skill (`.claude/skills/create-report/`, built in Phase 8).
