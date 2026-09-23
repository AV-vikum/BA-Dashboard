# Development

How to run BA-Dashboard locally. Everything here uses the **Firebase Emulator
Suite** with the demo project `demo-ba-dashboard` — no real Firebase project,
no account, no keys. See [`docs/plan/architecture.md` §A4](plan/architecture.md#a4-configuration--secrets)
for where real config lives once you reach Phase 9.

## Prerequisites

See [conventions.md §2](plan/conventions.md#2-prerequisites-checked-in-step-02):
Node.js 22+, Java JDK 21+ (for the Firestore emulator), Git.

## First run

```sh
npm install
```

Terminal 1 — start the emulators and keep them running:

```sh
npm run emulators
```

Terminal 2 — load demo data (once the emulators say "All emulators ready"):

```sh
npm run seed
```

That's it for now — `npm run dev` (the web app) arrives in Phase 3.

## The Emulator UI

Open **http://localhost:4000** while the emulators are running to inspect
data directly:

- **Firestore** tab — browse `config/`, `groups/`, `reports/` documents.
- **Authentication** tab — see and manage fake sign-ins.

## Signing in with the Auth emulator

Once the web app exists (Phase 3+), "Sign in with Google" opens the **Auth
emulator's fake account chooser**, not the real Google sign-in page. Click
**"Add new account"** and type any email address — no password, no real
account needed. Use this to test different users, e.g.:

| Email                  | Notes (after `npm run seed`)       |
| ---------------------- | ---------------------------------- |
| `admin@example.com`    | admin — sees everything            |
| `alice@example.com`    | Finance group member               |
| `carol@example.com`    | Management group member            |
| `partner@outside.test` | external share example             |
| `stranger@gmail.test`  | not allowed — lands on "No access" |

The full table prints every time you run `npm run seed`.

### Email verification

Security Rules require `request.auth.token.email_verified == true` (see
[architecture.md §A6](plan/architecture.md#a6-security-rules-target--implemented-in-step-25)).
Accounts created through the Auth emulator's **"Add new account"** flow are
**not** verified by default — the app signs them straight back out with a
toast ("Your Google account email is not verified"). To fix this for a test
account:

1. Open the Emulator UI → **Authentication** tab.
2. Click the user → **Edit user**.
3. Check **"Email verified"** → Save.
4. Sign in again in the app.

This is purely a quirk of the emulator's fake accounts — real Google
accounts are always verified, and the rules are never weakened to work
around it.

## Resetting data

```sh
# stop the emulators (Ctrl+C in terminal 1), then:
npm run emulators:reset
npm run emulators
npm run seed
```

`emulators:reset` deletes the `.emulator-data/` folder (git-ignored) where
the emulators persist state between runs via `--export-on-exit` /
`--import`.

## Firestore indexes

`firestore.indexes.json` declares composite indexes for the two report list
queries (`viewerEmails array-contains` + `status ==` + `orderBy(updatedAt)`,
and the same for `externalEmails`).

> ⚠️ The **Firestore emulator does not enforce indexes** — a query missing
> an index still runs locally. The same query fails in production with a
> "the query requires an index" error until the index is deployed (step
> 9.4). If you add a new query with `array-contains`/`in` combined with
> another filter or an `orderBy`, add its index here so it's ready before
> you deploy, and test it for real with `npm run test:rules` (which runs
> against the real emulator, not a mock).

## Where config lives

See [`architecture.md` §A4](plan/architecture.md#a4-configuration--secrets)
for the full table. The short version: **no real Firebase project or
secrets are needed until Phase 9.** Everything before that runs against the
`demo-ba-dashboard` emulator, and `config/access` / `config/admins` (allowed
domains, admin emails) live in Firestore itself, editable with
`npm run setup -- --domains … --admins …` or later in the Admin UI.

## Creating reports from the command line

Reports are folders under `reports/<slug>/` (git-ignored, except the fake-data
`reports/_example/`). With the emulators running:

```sh
npm run report -- new sales-q3 --title "Sales Q3"   # copy the starter template
npm run report -- preview sales-q3 --data           # run build-data.mjs, build, open in browser
npm run report -- publish sales-q3                  # create/update it in the app; prints the URL
npm run report -- access sales-q3 --add-group Finance --add-external partner@outside.test:2026-12-31
npm run report -- list                              # all reports
npm run report -- --help                            # every command
```

Every Firestore command prints its target first (`[target: emulator (demo-ba-dashboard)]`).
`npm run test:tools:int` runs the CLI's integration tests against the emulator.

## Using Claude with this project

The MCP server (`tools/dist/mcp.js`, built by `npm install` / `npm run build:tools`)
gives Claude tools to create, build, preview, publish and share reports. **Rebuild
with `npm run build:tools` after changing anything in `tools/src`.**

### Claude Code

```sh
cp .mcp.json.example .mcp.json   # git-ignored; PowerShell: Copy-Item .mcp.json.example .mcp.json
```

Restart Claude Code in this folder and approve the `ba-dashboard` server when asked
(`/mcp` shows its status). If the relative path in `args` doesn't resolve, use the
absolute path to `tools/dist/mcp.js`.

### Claude Desktop (Windows)

Edit `%APPDATA%\Claude\claude_desktop_config.json` and add (absolute path, double
backslashes):

```json
{
  "mcpServers": {
    "ba-dashboard": {
      "command": "node",
      "args": ["D:\path\to\BA-Dashboard\tools\dist\mcp.js"],
      "env": { "BA_TARGET": "emulator" }
    }
  }
}
```

Restart Claude Desktop. Claude Desktop also needs to **read and write files** in the
repo's `reports/` folder (to edit `report.html`, `data.json`, `build-data.mjs`) — give
it access with its filesystem extension/connector, limited to that folder. Check the
current Claude Desktop docs for where to enable it.

### Which data does Claude work on?

`BA_TARGET` in the MCP config decides: `emulator` (default) while developing the app,
`production` once the app is live (Phase 9, step 9.10). Every tool result starts with
the target, e.g. `[emulator (demo-ba-dashboard)]`.
