import { useEffect } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useMyReports } from '@/hooks/useMyReports';
import { NoAccessPage } from './NoAccessPage';

// Report list, search and tags land in step 3.6 — this step only adds the
// no-access branch, which needs the reports query to know whether an
// external user has anything shared with them.
export function MyReportsPage() {
  const { isInternal } = useAuth();
  const { reports, loading } = useMyReports();
  const appName = import.meta.env.VITE_APP_NAME;

  useEffect(() => {
    document.title = `My reports · ${appName}`;
  }, [appName]);

  if (loading) {
    return null;
  }

  if (!isInternal && reports.length === 0) {
    return <NoAccessPage />;
  }

  return <h1 className="p-6 text-2xl font-bold">My reports</h1>;
}
