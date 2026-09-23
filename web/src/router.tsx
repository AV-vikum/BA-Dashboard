import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from '@/components/AppShell';
import { RequireAdmin } from '@/auth/RequireAdmin';
import { RequireAuth } from '@/auth/RequireAuth';
import { AdminGroupsPage } from '@/pages/admin/AdminGroupsPage';
import { AdminLayout } from '@/pages/admin/AdminLayout';
import { AdminPeoplePage } from '@/pages/admin/AdminPeoplePage';
import { AdminReportDetailPage } from '@/pages/admin/AdminReportDetailPage';
import { AdminReportsPage } from '@/pages/admin/AdminReportsPage';
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';
import { AdminViewAsPage } from '@/pages/admin/AdminViewAsPage';
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
    children: [
      { index: true, element: <Navigate to="reports" replace /> },
      { path: 'reports', element: <AdminReportsPage /> },
      { path: 'reports/:reportId', element: <AdminReportDetailPage /> },
      { path: 'people', element: <AdminPeoplePage /> },
      { path: 'groups', element: <AdminGroupsPage /> },
      { path: 'settings', element: <AdminSettingsPage /> },
      { path: 'view-as', element: <AdminViewAsPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
