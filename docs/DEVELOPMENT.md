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
