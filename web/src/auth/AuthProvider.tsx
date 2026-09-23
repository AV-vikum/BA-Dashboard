import { useMemo, type ReactNode } from 'react';
import type { AccessConfig } from '@ba/shared';
import { AuthContext, type AuthContextValue, type AuthUser } from './AuthContext';

// STUB for step 3.3 (routing and app shell) — replaced by the real
// Firebase-backed provider in step 3.4. Lets routing/guards/AppShell be
// built and checked against every auth state ahead of real sign-in.
//
// Switch state with ?stubAuth=signedOut|user|admin (default: user).
// TODO(3.4): remove this stub and the query-param switch.

const stubUser: AuthUser = {
  uid: 'stub-uid',
  email: 'alice@example.com',
  displayName: 'Alice Example',
  photoURL: null,
};

const stubAdmin: AuthUser = {
  uid: 'stub-admin-uid',
  email: 'admin@example.com',
  displayName: 'Admin Example',
  photoURL: null,
};

const stubAccessConfig: AccessConfig = {
  allowedDomains: ['example.com'],
  allowExternalSharing: true,
  updatedAt: { toDate: () => new Date() },
  updatedBy: 'stub',
};

function readStubMode(): 'signedOut' | 'user' | 'admin' {
  const value = new URLSearchParams(window.location.search).get('stubAuth');
  return value === 'signedOut' || value === 'admin' ? value : 'user';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = useMemo(() => readStubMode(), []);

  const value = useMemo<AuthContextValue>(() => {
    if (mode === 'signedOut') {
      return {
        status: 'signedOut',
        user: null,
        accessConfig: null,
        isInternal: false,
        isAdmin: false,
        signIn: async () => {},
        signOut: async () => {},
      };
    }
    const user = mode === 'admin' ? stubAdmin : stubUser;
    return {
      status: 'signedIn',
      user,
      accessConfig: stubAccessConfig,
      isInternal: true,
      isAdmin: mode === 'admin',
      signIn: async () => {},
      signOut: async () => {},
    };
  }, [mode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
