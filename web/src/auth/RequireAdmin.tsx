import type { ReactNode } from 'react';
import { AdminForbiddenPage } from '@/pages/admin/AdminForbiddenPage';
import { useAuth } from './AuthContext';

// Nested inside RequireAuth by the router config, so status is always
// 'signedIn' here — this only gates on isAdmin.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <AdminForbiddenPage />;
  }

  return children;
}
