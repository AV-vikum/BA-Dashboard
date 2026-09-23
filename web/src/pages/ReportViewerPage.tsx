import { FirestoreError } from 'firebase/firestore';
import { AlertTriangle, ArrowLeft, Clock, Copy, FileX, Moon, Settings, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { isExternalActive, type Report, type WithId } from '@ba/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessagePage } from '@/components/MessagePage';
import { RelativeDate } from '@/components/RelativeDate';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { getReportContent, subscribeReport } from '@/lib/firestore/reports';
import { withTheme } from '@/lib/report-frame';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'unavailable' } // doesn't exist, not shared, or unpublished while open
  | { kind: 'expired' } // external access expired
  | { kind: 'error' } // network / anything else
  | { kind: 'ready'; report: WithId<Report>; html: string };

function isPermissionDenied(error: unknown): boolean {
  return error instanceof FirestoreError && error.code === 'permission-denied';
}

function BackToReports() {
  return (
    <Button asChild>
      <Link to="/">Back to my reports</Link>
    </Button>
  );
}

// Keyed by requestId (reportId + retry count) so a result from a previous
// request (a different report, or a stale retry) is never shown against
// the current one.
interface LoadedFor<T> {
  requestId: string;
  value: T;
}

type MetadataResult = { report: WithId<Report> | null; error: unknown };
type ContentResult = { html: string | null; error: unknown };

export function ReportViewerPage() {
  const { reportId } = useParams();
  const { user, isAdmin, isInternal } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const appName = import.meta.env.VITE_APP_NAME;

  const [retryCount, setRetryCount] = useState(0);
  const requestId = `${reportId}:${retryCount}`;

  const [metadata, setMetadata] = useState<LoadedFor<MetadataResult> | null>(null);
  const [content, setContent] = useState<LoadedFor<ContentResult> | null>(null);

  useEffect(() => {
    if (!reportId) return;
    return subscribeReport(
      reportId,
      (report) => setMetadata({ requestId, value: { report, error: null } }),
      (error) => setMetadata({ requestId, value: { report: null, error } }),
    );
  }, [reportId, requestId]);

  const report = metadata?.requestId === requestId ? metadata.value.report : undefined;

  useEffect(() => {
    if (!reportId || !report) return;
    let cancelled = false;
    getReportContent(reportId)
      .then((doc) => {
        if (!cancelled) setContent({ requestId, value: { html: doc?.html ?? null, error: null } });
      })
      .catch((error) => {
        if (!cancelled) setContent({ requestId, value: { html: null, error } });
      });
    return () => {
      cancelled = true;
    };
  }, [reportId, report, requestId]);

  useEffect(() => {
    document.title = `${report?.title ?? 'Report'} · ${appName}`;
  }, [report?.title, appName]);

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied');
  }

  function retry() {
    setRetryCount((c) => c + 1);
  }

  const state: ViewState = (() => {
    if (metadata?.requestId !== requestId) return { kind: 'loading' };
    const { report, error: metadataError } = metadata.value;

    if (report === null) {
      // Missing doc and permission-denied both mean "not available"; a
      // network/other error gets its own message with a Retry.
      return isPermissionDenied(metadataError) || metadataError === null
        ? { kind: 'unavailable' }
        : { kind: 'error' };
    }

    if (report.status !== 'published' && !isAdmin) {
      return { kind: 'unavailable' }; // unpublished while open, non-admin
    }

    if (content?.requestId !== requestId) return { kind: 'loading' };
    const { html, error: contentError } = content.value;

    if (html === null) {
      const expired = !isInternal && user && !isExternalActive(report, user.email);
      if (expired || isPermissionDenied(contentError)) {
        return { kind: 'expired' };
      }
      return contentError ? { kind: 'error' } : { kind: 'unavailable' };
    }

    return { kind: 'ready', report, html };
  })();

  if (state.kind === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col">
        <div className="flex h-12 shrink-0 items-center border-b px-4">
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  if (state.kind === 'unavailable') {
    return (
      <MessagePage
        icon={FileX}
        title="Report not available"
        text="It doesn't exist, or it hasn't been shared with you."
      >
        <BackToReports />
      </MessagePage>
    );
  }

  if (state.kind === 'expired') {
    return (
      <MessagePage
        icon={Clock}
        title="Your access to this report has expired"
        text="Contact the person who shared it with you."
      >
        <BackToReports />
      </MessagePage>
    );
  }

  if (state.kind === 'error') {
    return (
      <MessagePage icon={AlertTriangle} title="Something went wrong">
        <Button onClick={retry}>Retry</Button>
        <BackToReports />
      </MessagePage>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to my reports"
          onClick={() => navigate((location.state as { from?: string } | null)?.from ?? '/')}
        >
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{state.report.title}</p>
          <p className="text-xs text-muted-foreground">
            <RelativeDate timestamp={state.report.updatedAt} prefix="Updated " />
          </p>
        </div>
        {isAdmin && (
          <Button variant="ghost" size="icon" aria-label="Manage report" asChild>
            <Link to={`/admin/reports/${state.report.id}`}>
              <Settings />
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label="Copy link" onClick={copyLink}>
          <Copy />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
        </Button>
      </header>

      <iframe
        title={state.report.title}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        srcDoc={withTheme(state.html, resolvedTheme)}
        className="h-[calc(100dvh-3rem)] w-full border-0"
      />
    </div>
  );
}
