# User checkpoints 🔑

These are the steps **you** do yourself — in the Firebase / Google Cloud / GitHub web consoles or in your own terminal. The AI agent will stop and point you here when one is needed.

**You don't need any of these until Phase 9.** Everything before that runs on the local emulators with fake data.

### Safety rules
- **Never paste a service-account key (JSON) into a chat with an AI**, an issue, or anywhere online. Tell the agent only the **file path**.
- The Firebase **web config** (`apiKey`, `projectId`, …) is *not* secret, but still goes only in the git-ignored `web/.env.production.local`.
- When a checkpoint is done, tell the agent: **"CP-X done"**.

| Checkpoint | When | Time |
|---|---|---|
| [CP-0](#cp-0--install-missing-tools-only-if-asked) | Step 0.2, only if Node/Java is missing | 5 min |
| [CP-1](#cp-1--create-the-firebase-project-and-web-app) | Step 9.1 | 10 min |
| [CP-2](#cp-2--firebase-cli-login-and-project-alias) | Step 9.3 | 3 min |
| [CP-3](#cp-3--service-account-key-for-publishing) | Step 9.5 | 5 min |
| [CP-4](#cp-4--lock-down-authorized-domains-and-the-api-key) | Step 9.8 | 5 min |
| [CP-5](#cp-5--publish-the-repository-on-github) | Step 10.5 | 10 min |
| [CP-6](#cp-6-optional--automatic-deploy-from-github) | Step 10.6 (optional) | 10 min |

---

## CP-0 — Install missing tools (only if asked)
- **Node.js LTS:** `winget install OpenJS.NodeJS.LTS`
- **Java 21:** `winget install EclipseAdoptium.Temurin.21.JDK`
- Close and reopen your terminal / VS Code, then check `node -v` and `java -version`.

---

## CP-1 — Create the Firebase project and web app
1. Go to https://console.firebase.google.com → **Create a project**.
   - Name: e.g. `yourcompany-reports` (the project ID becomes part of your URL: `https://<project-id>.web.app`).
   - Google Analytics: **off** (not needed).
   - Stay on the free **Spark** plan.
2. **Authentication** → *Get started* → *Sign-in method* → **Google** → Enable → choose a support email → Save.
3. **Firestore Database** → *Create database*:
   - Mode: **Production mode**.
   - Location: choose the region closest to your users (for Sri Lanka, `asia-south1` (Mumbai) is closest). ⚠️ **This can't be changed later.**
4. **Project settings** (gear icon) → *General* → *Your apps* → click the **Web** icon `</>`:
   - App nickname: `web`. Don't tick "Firebase Hosting" here (the agent sets it up).
   - Firebase shows a `firebaseConfig` object.
5. In VS Code, create the file `web/.env.production.local` (copy `web/.env.example`) and fill in:
   ```
   VITE_FIREBASE_API_KEY=<apiKey>
   VITE_FIREBASE_AUTH_DOMAIN=<authDomain>
   VITE_FIREBASE_PROJECT_ID=<projectId>
   VITE_FIREBASE_APP_ID=<appId>
   VITE_USE_EMULATORS=false
   VITE_APP_NAME=<your app name>
   VITE_APP_HINT_DOMAIN=<your company domain, optional>
   ```
6. Tell the agent: **"CP-1 done"** and your **project ID** (the project ID is not secret).

---

## CP-2 — Firebase CLI login and project alias
Login opens a browser, so run it in **your own terminal** (VS Code terminal is fine), in the project folder:
```
npx firebase login
npx firebase use --add
```
- Pick your project from the list; for the alias type `default`.
- This creates `.firebaserc` (git-ignored).

Tell the agent: **"CP-2 done"**.

---

## CP-3 — Service-account key (for publishing)
The CLI and MCP server use this key to publish reports. **It gives full access to your database — treat it like a password.**

1. Create a folder **outside the project**, e.g. `C:\secure\ba-dashboard\`.
2. Firebase console → **Project settings** → **Service accounts** → *Firebase Admin SDK* → **Generate new private key** → confirm.
3. Save the downloaded file as `C:\secure\ba-dashboard\service-account.json`.
4. Copy `tools/.env.example` to `tools/.env.production` and fill in:
   ```
   FIREBASE_PROJECT_ID=<projectId>
   GOOGLE_APPLICATION_CREDENTIALS=C:\secure\ba-dashboard\service-account.json
   APP_URL=https://<projectId>.web.app
   PUBLISHER_EMAIL=<your email>
   ```
5. Tell the agent: **"CP-3 done"**. Do **not** paste the key.

**If the key ever leaks:** Google Cloud Console → *IAM & Admin* → *Service accounts* → the `firebase-adminsdk` account → *Keys* → delete the key, then repeat steps 2–3.

---

## CP-4 — Lock down authorized domains and the API key
Do this after the first hosting deploy (step 9.7).

1. **Authorized domains:** Firebase console → *Authentication* → *Settings* → *Authorized domains*. Keep only:
   - `<projectId>.web.app`
   - `<projectId>.firebaseapp.com`
   - any custom domain you add later
   - `localhost` can be removed (local development uses the emulators, not this project).
2. **API key website restriction:** https://console.cloud.google.com → select your project → *APIs & Services* → *Credentials* → the key named **"Browser key (auto created by Firebase)"** → *Application restrictions* → **Websites** → add:
   - `https://<projectId>.web.app/*`
   - `https://<projectId>.firebaseapp.com/*`
   → Save. Leave *API restrictions* as they are (changing them can break sign-in).
3. Open the app URL and sign in once to confirm everything still works.

Tell the agent: **"CP-4 done"**.

---

## CP-5 — Publish the repository on GitHub
1. Wait until the agent confirms the secret scan and history check are clean (step 10.5).
2. Create a **new empty repository** on GitHub (no README/license — the project has them).
3. Settings → *Code security* → enable **Secret scanning** and **Push protection**.
4. Give the agent the repository URL; the agent adds the remote and pushes **after asking you**.
5. Check the *Actions* tab: the CI workflow should be green.

Tell the agent: **"CP-5 done"**.

---

## CP-6 (optional) — Automatic deploy from GitHub
Run in your own terminal:
```
npx firebase init hosting:github
```
- It asks for the GitHub repo, creates a deploy service account, and stores its key as a **GitHub secret** automatically (never in the repo).
- Choose: build script `npm ci && npm run build -w web`; deploy on merge to `main`: yes.
- In GitHub → Settings → *Secrets and variables* → *Actions*, add your `VITE_*` values from `web/.env.production.local` as variables/secrets.

Tell the agent: **"CP-6 done"** so it can review the workflow files.
