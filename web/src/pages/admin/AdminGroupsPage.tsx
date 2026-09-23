import type { AccessConfig, Group, Report, WithId } from '@ba/shared';
import { Pencil, Plus, Trash2, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageHeader';
import {
  subscribeAccessConfig,
  subscribeAllReports,
  subscribeGroups,
  deleteGroup,
} from '@/lib/firestore/admin';
import { GroupDetailSheet } from './GroupDetailSheet';
import { GroupDialog } from './GroupDialog';

export function AdminGroupsPage() {
  const [groups, setGroups] = useState<WithId<Group>[] | null>(null);
  const [reports, setReports] = useState<WithId<Report>[] | null>(null);
  const [accessConfig, setAccessConfig] = useState<AccessConfig | null>(null);
  const [dialogGroup, setDialogGroup] = useState<WithId<Group> | null | undefined>(undefined); // undefined = closed
  const [detailGroup, setDetailGroup] = useState<WithId<Group> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WithId<Group> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const appName = import.meta.env.VITE_APP_NAME;

  useEffect(() => {
    document.title = `Groups · Admin · ${appName}`;
  }, [appName]);

  useEffect(() => subscribeGroups(setGroups, () => toast.error('Could not load groups.')), []);
  useEffect(
    () => subscribeAllReports(setReports, () => toast.error('Could not load reports.')),
    [],
  );
  useEffect(
    () => subscribeAccessConfig(setAccessConfig, () => toast.error('Could not load settings.')),
    [],
  );

  const reportCountByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    for (const report of reports ?? []) {
      for (const groupId of report.groupIds) {
        counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
      }
    }
    return counts;
  }, [reports]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { reportsUpdated } = await deleteGroup(deleteTarget.id);
      toast.success(
        reportsUpdated > 0
          ? `Deleted "${deleteTarget.name}" — updated ${reportsUpdated} report(s).`
          : `Deleted "${deleteTarget.name}".`,
      );
      setDeleteTarget(null);
    } catch {
      toast.error('Could not delete the group.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Groups"
        actions={
          <Button onClick={() => setDialogGroup(null)}>
            <Plus /> New group
          </Button>
        }
      />

      {groups === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No groups yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id} className="cursor-pointer" onClick={() => setDetailGroup(group)}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <UsersRound
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <CardTitle className="truncate">{group.name}</CardTitle>
                </div>
                <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${group.name}`}
                    onClick={() => setDialogGroup(group)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${group.name}`}
                    onClick={() => setDeleteTarget(group)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                {group.description && <p className="line-clamp-2">{group.description}</p>}
                <p>
                  {group.memberEmails.length} member{group.memberEmails.length === 1 ? '' : 's'} ·{' '}
                  {reportCountByGroup.get(group.id) ?? 0} report
                  {(reportCountByGroup.get(group.id) ?? 0) === 1 ? '' : 's'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GroupDialog
        group={dialogGroup ?? null}
        groups={groups ?? []}
        accessConfig={accessConfig}
        open={dialogGroup !== undefined}
        onOpenChange={(open) => !open && setDialogGroup(undefined)}
      />

      {detailGroup && (
        <GroupDetailSheet
          group={detailGroup}
          reports={reports ?? []}
          open={detailGroup !== null}
          onOpenChange={(open) => !open && setDetailGroup(null)}
        />
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove "{deleteTarget?.name}" from{' '}
              {reportCountByGroup.get(deleteTarget?.id ?? '') ?? 0} report(s) and delete it?
            </AlertDialogTitle>
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
