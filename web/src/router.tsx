import { createBrowserRouter } from 'react-router';
import { AppShell } from '@/components/AppShell';
import { RequireAdmin } from '@/auth/RequireAdmin';
import { RequireAuth } from '@/auth/RequireAuth';
import { AdminLayout } from '@/pages/admin/AdminLayout';
import { LoginPage } from '@/pages/LoginPage';
import { MyReportsPage } from '@/pages/MyReportsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ReportViewerPage } from '@/pages/ReportViewerPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell>
          <MyReportsPage />
        </AppShell>
      </RequireAuth>
    ),
  },
  {
    path: '/r/:reportId',
    element: (
      <RequireAuth>
        <ReportViewerPage />
      </RequireAuth>
    ),
  },
  {
    path: '/admin',
    element: (
      <RequireAuth>
        <RequireAdmin>
          <AdminLayout />
        </RequireAdmin>
      </RequireAuth>
    ),
  },
  { path: '*', element: <NotFoundPage /> },
]);
