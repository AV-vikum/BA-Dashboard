import { useEffect, useState } from 'react';
import { isExternalActive, type Report, type WithId } from '@ba/shared';
import { useAuth } from '@/auth/AuthContext';
import { subscribeAllReports, subscribeMyReports } from '@/lib/firestore/reports';

export interface MyReportsResult {
  reports: WithId<Report>[];
  loading: boolean;
  error: unknown;
}

// Admins see every published report on the home page (they manage
// everything anyway); everyone else sees only what's assigned to them.
// External users additionally have expired shares filtered out here —
// list queries can't check expiry (architecture.md §A6).
export function useMyReports(): MyReportsResult {
  const { user, isInternal, isAdmin } = useAuth();
  const [state, setState] = useState<MyReportsResult>({
    reports: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!user) return;

    const onError = (error: unknown) => setState({ reports: [], loading: false, error });

    if (isAdmin) {
      return subscribeAllReports((all) => {
        setState({
          reports: all.filter((r) => r.status === 'published'),
          loading: false,
          error: null,
        });
      }, onError);
    }

    return subscribeMyReports(
      user.email,
      isInternal,
      (mine) => {
        const visible = isInternal ? mine : mine.filter((r) => isExternalActive(r, user.email));
        setState({ reports: visible, loading: false, error: null });
      },
      onError,
    );
  }, [user, isInternal, isAdmin]);

  return state;
}
