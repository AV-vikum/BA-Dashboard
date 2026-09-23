import { LIMITS, type Report, type WithId } from '@ba/shared';
import { AlertTriangle, ArrowLeft, Copy, Maximize2, MoreHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
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
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { MessagePage } from '@/components/MessagePage';
import { RelativeDate } from '@/components/RelativeDate';
import { ReportFrame } from '@/components/ReportFrame';
import { TagsInput } from '@/components/TagsInput';
import {
  deleteReport,
  setReportStatus,
  subscribeReport,
  updateReportDetails,
} from '@/lib/firestore/admin';
import { getReportContent } from '@/lib/firestore/reports';
import { ReplaceHtmlDialog } from './ReplaceHtmlDialog';

function AccessTabPlaceholder() {
  // Built out in step 4.6.
  return (
    <p className="p-4 text-sm text-muted-foreground">Access management — coming in step 4.6.</p>
  );
}

function InfoTab({ report }: { report: WithId<Report> }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Report ID', value: report.id },
    { label: 'Slug', value: report.slug ?? '—' },
    { label: 'Size', value: `${(report.sizeBytes / 1000).toFixed(0)} KB` },
    {
      label: 'Created',
      value: `${report.createdAt.toDate().toLocaleString()} by ${report.createdBy}`,
    },
    {
      label: 'Updated',
      value: `${report.updatedAt.toDate().toLocaleString()} by ${report.updatedBy}`,
    },
    {
      label: 'Published',
      value: report.publishedAt ? report.publishedAt.toDate().toLocaleString() : 'Not published',
    },
  ];

  return (
    <dl className="flex flex-col gap-3 p-4 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
          <dt className="w-32 shrink-0 text-muted-foreground">{row.label}</dt>
          <dd className="wrap-break-word">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Keyed by report.id from the caller, so switching reports remounts this
// (fresh local state) without a live snapshot update from *this* report
// wiping out an in-progress, unsaved edit.
function DetailsTab({ report }: { report: WithId<Report> }) {
  const [title, setTitle] = useState(report.title);
  const [description, setDescription] = useState(report.description);
  const [tags, setTags] = useState<string[]>(report.tags);
  const [saving, setSaving] = useState(false);

  const dirty =
    title !== report.title ||
    description !== report.description ||
    JSON.stringify(tags) !== JSON.stringify(report.tags);
  const titleValid = title.trim().length > 0 && title.trim().length <= LIMITS.titleMax;

  async function handleSave() {
    if (!titleValid) return;
    setSaving(true);
    try {
      await updateReportDetails(report.id, { title, description, tags });
      toast.success('Details saved.');
    } catch {
      toast.error('Could not save details.');
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setTitle(report.title);
    setDescription(report.description);
    setTags(report.tags);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {report.slug && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Managed from a local folder — edits to details here are overwritten on the next publish.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="detail-title">Title</Label>
        <Input
          id="detail-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={LIMITS.titleMax}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="detail-description">Description</Label>
        <Textarea
          id="detail-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={LIMITS.descriptionMax}
        />
      </div>

      <TagsInput tags={tags} onChange={setTags} />

      <div className="flex gap-2">
        <Button onClick={() => void handleSave()} disabled={!dirty || !titleValid || saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="outline" onClick={discard} disabled={!dirty || saving}>
          Discard
        </Button>
      </div>
    </div>
  );
}

export function AdminReportDetailPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const appName = import.meta.env.VITE_APP_NAME;

  const [report, setReport] = useState<WithId<Report> | null | undefined>(undefined); // undefined = loading, null = not found
  const [html, setHtml] = useState<string | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!reportId) return;
    return subscribeReport(reportId, setReport, () => setReport(null));
  }, [reportId]);

  useEffect(() => {
    document.title = `${report?.title ?? 'Report'} · Admin · ${appName}`;
  }, [report?.title, appName]);

  function reloadContent(id: string) {
    getReportContent(id)
      .then((content) => setHtml(content?.html ?? null))
      .catch(() => setHtml(null));
  }

  // Only re-fetched when the report id changes (or after Replace HTML) —
  // report itself updates on every live snapshot and content is a
  // separate, bigger document not worth re-reading on every metadata edit.
  useEffect(() => {
    if (reportId) reloadContent(reportId);
  }, [reportId]);

  async function togglePublish() {
    if (!report) return;
    setPublishing(true);
    try {
      const next = report.status === 'published' ? 'draft' : 'published';
      await setReportStatus(report.id, next);
      toast.success(next === 'published' ? 'Report published' : 'Report unpublished');
    } catch {
      toast.error('Could not update the report.');
    } finally {
      setPublishing(false);
    }
  }

  async function copyLink() {
    if (!report) return;
    await navigator.clipboard.writeText(`${window.location.origin}/r/${report.id}`);
    toast.success('Link copied');
  }

  async function confirmDelete() {
    if (!report) return;
    setDeleting(true);
    try {
      await deleteReport(report.id);
      toast.success(`Deleted "${report.title}"`);
      navigate('/admin/reports');
    } catch {
      toast.error('Could not delete the report.');
      setDeleting(false);
    }
  }

  if (report === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (report === null) {
    return (
      <MessagePage icon={AlertTriangle} title="Report not found">
        <Button asChild>
          <Link to="/admin/reports">Back to reports</Link>
        </Button>
      </MessagePage>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Back to reports" asChild>
            <Link to="/admin/reports">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold">{report.title}</h1>
              <Badge variant={report.status === 'published' ? 'default' : 'secondary'}>
                {report.status === 'published' ? 'Published' : 'Draft'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Updated <RelativeDate timestamp={report.updatedAt} />
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={() => void togglePublish()} disabled={publishing}>
            {report.status === 'published' ? 'Unpublish' : 'Publish'}
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/r/${report.id}`}>Open as viewer</Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Copy link"
            onClick={() => void copyLink()}
          >
            <Copy />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setReplaceOpen(true)}>
                Replace HTML
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Preview</span>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/r/${report.id}`} target="_blank" rel="noreferrer">
                <Maximize2 /> Open full screen
              </Link>
            </Button>
          </div>
          <div className="h-128 overflow-hidden rounded-lg border">
            {html === null ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading preview…
              </div>
            ) : (
              <ReportFrame html={html} title={report.title} />
            )}
          </div>
        </div>

        <div className="rounded-lg border">
          <Tabs defaultValue="details">
            <TabsList className="m-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="access">Access</TabsTrigger>
              <TabsTrigger value="info">Info</TabsTrigger>
            </TabsList>
            <TabsContent value="details">
              <DetailsTab key={report.id} report={report} />
            </TabsContent>
            <TabsContent value="access">
              <AccessTabPlaceholder />
            </TabsContent>
            <TabsContent value="info">
              <InfoTab report={report} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ReplaceHtmlDialog
        reportId={report.id}
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
        onReplaced={() => reloadContent(report.id)}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{report.title}"?</AlertDialogTitle>
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
