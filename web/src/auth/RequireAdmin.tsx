import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from './AuthContext';

// Nested inside RequireAuth by the router config, so status is always
// 'signedIn' here — this only gates on isAdmin.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
