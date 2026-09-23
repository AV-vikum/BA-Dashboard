import { ArrowLeft, Copy, Moon, Settings, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import type { Report, WithId } from '@ba/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RelativeDate } from '@/components/RelativeDate';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { getReportContent, subscribeReport } from '@/lib/firestore/reports';
import { withTheme } from '@/lib/report-frame';

// Error states beyond "still loading" are formalized in step 3.8 — this
// step ships a single fallback message so 3.7's own acceptance check
// (sandbox works, theme toggling works) can be verified.
function ReportUnavailable() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-bold">Report not available</h1>
      <p className="text-sm text-muted-foreground">
        It doesn't exist, or it hasn't been shared with you.
      </p>
      <Button asChild>
        <Link to="/">Back to my reports</Link>
      </Button>
    </div>
  );
}

export function ReportViewerPage() {
  const { reportId } = useParams();
  const { isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const appName = import.meta.env.VITE_APP_NAME;

  const [report, setReport] = useState<WithId<Report> | null | undefined>(undefined); // undefined = loading
  const [html, setHtml] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!reportId) return;
    return subscribeReport(
      reportId,
      (doc) => setReport(doc),
      () => setReport(null),
    );
  }, [reportId]);

  useEffect(() => {
    if (!reportId || !report) return;
    let cancelled = false;
    getReportContent(reportId)
      .then((content) => {
        if (!cancelled) setHtml(content?.html ?? null);
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId, report]);

  useEffect(() => {
    document.title = `${report?.title ?? 'Report'} · ${appName}`;
  }, [report?.title, appName]);

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied');
  }

  if (report === undefined) {
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

  if (report === null || (report.status !== 'published' && !isAdmin)) {
    return <ReportUnavailable />;
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
          <p className="truncate text-sm font-medium">{report.title}</p>
          <p className="text-xs text-muted-foreground">
            <RelativeDate timestamp={report.updatedAt} prefix="Updated " />
          </p>
        </div>
        {isAdmin && (
          <Button variant="ghost" size="icon" aria-label="Manage report" asChild>
            <Link to={`/admin/reports/${report.id}`}>
              <Settings />
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label="Copy link" onClick={copyLink}>
          <Copy />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
      </header>

      {html === undefined ? (
        <div className="h-[calc(100dvh-3rem)] p-4">
          <Skeleton className="h-full w-full" />
        </div>
      ) : html === null ? (
        <ReportUnavailable />
      ) : (
        <iframe
          title={report.title}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          srcDoc={withTheme(html, theme)}
          className="h-[calc(100dvh-3rem)] w-full border-0"
        />
      )}
    </div>
  );
}
