import { normalizeEmail, reportsVisibleTo, type Group, type Report, type WithId } from '@ba/shared';
import { Eye, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { updateReportAccess } from '@/lib/firestore/admin';
import type { Person } from './AdminPeoplePage';
import { AddToReportsDialog } from './AddToReportsDialog';

function accessSourceLabel(
  report: WithId<Report>,
  person: Person,
  groups: WithId<Group>[],
): { label: string; removable: boolean } {
  const normalized = person.email;
  if (report.directEmails.map(normalizeEmail).includes(normalized)) {
    return { label: 'Direct', removable: true };
  }
  if (report.externalEmails.map(normalizeEmail).includes(normalized)) {
    const expiry = report.externalExpiry[normalized];
    const expiryText = expiry ? `, expires ${expiry.toDate().toLocaleDateString()}` : '';
    return { label: `External${expiryText}`, removable: true };
  }
  const viaGroup = groups.find(
    (g) =>
      report.groupIds.includes(g.id) && g.memberEmails.map(normalizeEmail).includes(normalized),
  );
  return { label: viaGroup ? `Group: ${viaGroup.name}` : '—', removable: false };
}

export function PersonSheet({
  person,
  reports,
  groups,
  open,
  onOpenChange,
}: {
  person: Person;
  reports: WithId<Report>[];
  groups: WithId<Group>[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const visibleReports = useMemo(
    () =>
      reportsVisibleTo(person.email, reports, {
        isAdmin: person.isAdmin,
        isInternal: person.isInternal,
        allowExternalSharing: true, // shown for admin bookkeeping regardless of the global switch
      }),
    [person, reports],
  );

  async function removeAccess(report: WithId<Report>, viaExternal: boolean) {
    setRemoving(report.id);
    try {
      await updateReportAccess(report.id, {
        removeEmails: viaExternal ? [] : [person.email],
        removeExternal: viaExternal ? [person.email] : [],
      });
      toast.success(`Removed ${person.email} from "${report.title}".`);
    } catch {
      toast.error('Could not remove access.');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{person.displayName ?? person.email}</SheetTitle>
          <SheetDescription>{person.email}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
          <Button size="sm" className="self-start" onClick={() => setAddOpen(true)}>
            <Plus /> Add to reports
          </Button>

          {visibleReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visibleReports.map(({ report, via }) => {
                const source = accessSourceLabel(report, person, groups);
                return (
                  <li key={report.id} className="flex flex-col gap-1 rounded-md border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{report.title}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Open as ${person.email}`}
                        asChild
                      >
                        <Link to={`/admin/view-as?email=${encodeURIComponent(person.email)}`}>
                          <Eye className="size-3.5" />
                        </Link>
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      {source.label.startsWith('Group:') ? (
                        <Link to="/admin/groups" className="underline">
                          via {source.label} — edit the group
                        </Link>
                      ) : (
                        <span>via {source.label}</span>
                      )}
                      {source.removable && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${report.title}`}
                          disabled={removing === report.id}
                          onClick={() => void removeAccess(report, via === 'external')}
                        >
                          <X className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>

      <AddToReportsDialog
        person={person}
        reports={reports}
        alreadyVisibleIds={new Set(visibleReports.map((v) => v.report.id))}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
    </Sheet>
  );
}
