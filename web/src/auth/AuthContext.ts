import { createContext, useContext } from 'react';
import type { AccessConfig } from '@ba/shared';

// The final shape from step 3.4. AuthProvider.tsx currently provides a
// STUB implementation (see that file) so routing/guards can be built and
// checked ahead of the real Firebase-backed auth in step 3.4.
export interface AuthUser {
  uid: string;
  email: string; // normalized
  displayName: string | null;
  photoURL: string | null;
}

export interface AuthContextValue {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: AuthUser | null;
  accessConfig: AccessConfig | null; // live (onSnapshot)
  isInternal: boolean;
  isAdmin: boolean; // true if config/admins is readable
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
