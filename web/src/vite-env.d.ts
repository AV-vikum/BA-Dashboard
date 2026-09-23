/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_USE_EMULATORS: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_LOGO_URL: string;
  readonly VITE_APP_PRIMARY_COLOR: string;
  /** Optional: hints Google sign-in at a Workspace domain. See docs/plan/phase-3-web-viewer.md 3.4. */
  readonly VITE_APP_HINT_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
