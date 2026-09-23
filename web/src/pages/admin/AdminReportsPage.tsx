import {
  accessSummary,
  collectTags,
  filterReports,
  type Report,
  type ReportStatus,
  type WithId,
} from '@ba/shared';
import { Copy, Eye, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { RelativeDate } from '@/components/RelativeDate';
import { deleteReport, setReportStatus, subscribeAllReports } from '@/lib/firestore/admin';
import { NewReportDialog } from './NewReportDialog';

function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <Badge variant={status === 'published' ? 'default' : 'secondary'}>
      {status === 'published' ? 'Published' : 'Draft'}
    </Badge>
  );
}

function AccessCell({ report }: { report: WithId<Report> }) {
  const summary = accessSummary(report);
  const hasExpired = summary.expiredExternal.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span>{summary.internalCount} people</span>
      {summary.externalCount > 0 && (
        <>
          <span className="text-muted-foreground">·</span>
          <Badge variant={hasExpired ? 'destructive' : 'outline'}>
            {summary.externalCount} external
          </Badge>
        </>
      )}
    </div>
  );
}

export function AdminReportsPage() {
  const [reports, setReports] = useState<WithId<Report>[] | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [newReportOpen, setNewReportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WithId<Report> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const appName = import.meta.env.VITE_APP_NAME;

  useEffect(() => {
    document.title = `Reports · Admin · ${appName}`;
  }, [appName]);

  useEffect(() => {
    return subscribeAllReports(setReports, () => toast.error('Could not load reports.'));
  }, []);

  const query = searchParams.get('q') ?? '';
  const status = searchParams.get('status') ?? 'all';
  const tag = searchParams.get('tag') ?? 'all';

  function updateParam(key: string, value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === '' || value === 'all') next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  }

  const tags = useMemo(() => collectTags(reports ?? []), [reports]);

  const filtered = useMemo(() => {
    if (!reports) return [];
    const result = filterReports(reports, {
      query,
      status: status === 'all' ? undefined : (status as ReportStatus),
      tags: tag === 'all' ? undefined : [tag],
    });
    return [...result].sort(
      (a, b) => b.updatedAt.toDate().getTime() - a.updatedAt.toDate().getTime(),
    );
  }, [reports, query, status, tag]);

  async function copyLink(report: WithId<Report>) {
    const url = `${window.location.origin}/r/${report.id}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  }

  async function togglePublish(report: WithId<Report>) {
    const next: ReportStatus = report.status === 'published' ? 'draft' : 'published';
    try {
      await setReportStatus(report.id, next);
      toast.success(next === 'published' ? 'Report published' : 'Report unpublished');
    } catch {
      toast.error('Could not update the report.');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteReport(deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.title}"`);
      setDeleteTarget(null);
    } catch {
      toast.error('Could not delete the report.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Reports"
        actions={
          <Button onClick={() => setNewReportOpen(true)}>
            <Plus /> New report
          </Button>
        }
      />

      <NewReportDialog
        open={newReportOpen}
        onOpenChange={setNewReportOpen}
        onCreated={(id) => navigate(`/admin/reports/${id}`)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => updateParam('q', e.target.value)}
          placeholder="Search reports…"
          aria-label="Search reports"
          className="max-w-xs"
        />
        <Select value={status} onValueChange={(v) => updateParam('status', v)}>
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        {tags.length > 0 && (
          <Select value={tag} onValueChange={(v) => updateParam('tag', v)}>
            <SelectTrigger className="w-40" aria-label="Filter by tag">
              <SelectValue placeholder="All tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {tags.map(({ tag: t, count }) => (
                <SelectItem key={t} value={t}>
                  {t} ({count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          {reports === null ? '…' : `${filtered.length} of ${reports.length}`}
        </span>
      </div>

      {reports === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {reports.length === 0 ? 'No reports yet.' : 'No reports match your filters.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="sr-only">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((report) => (
                <TableRow
                  key={report.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/admin/reports/${report.id}`)}
                >
                  <TableCell className="max-w-xs">
                    <div className="truncate font-medium">{report.title}</div>
                    {report.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {report.tags.map((t) => (
                          <Badge key={t} variant="outline">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={report.status} />
                  </TableCell>
                  <TableCell>
                    <AccessCell report={report} />
                  </TableCell>
                  <TableCell>
                    <RelativeDate timestamp={report.updatedAt} />
                    <div className="text-xs text-muted-foreground">{report.updatedBy}</div>
                  </TableCell>
                  <TableCell>{report.slug ? 'CLI' : 'Web'}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${report.title}`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/r/${report.id}`}>
                            <Eye /> View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/admin/reports/${report.id}`}>
                            <Pencil /> Manage
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => copyLink(report)}>
                          <Copy /> Copy link
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => togglePublish(report)}>
                          {report.status === 'published' ? 'Unpublish' : 'Publish'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setDeleteTarget(report)}
                        >
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
