import type { Group, Report, WithId } from '@ba/shared';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export function GroupDetailSheet({
  group,
  reports,
  open,
  onOpenChange,
}: {
  group: WithId<Group>;
  reports: WithId<Report>[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reportsUsingGroup = reports.filter((r) => r.groupIds.includes(group.id));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{group.name}</SheetTitle>
          {group.description && <SheetDescription>{group.description}</SheetDescription>}
        </SheetHeader>

        <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">
              Members <span className="text-muted-foreground">({group.memberEmails.length})</span>
            </h3>
            {group.memberEmails.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {group.memberEmails.map((email) => (
                  <li key={email}>{email}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">
              Reports using this group{' '}
              <span className="text-muted-foreground">({reportsUsingGroup.length})</span>
            </h3>
            {reportsUsingGroup.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reports yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {reportsUsingGroup.map((report) => (
                  <li key={report.id}>
                    <Link
                      to={`/admin/reports/${report.id}`}
                      className="text-sm underline underline-offset-2"
                    >
                      {report.title}
                    </Link>{' '}
                    <Badge variant={report.status === 'published' ? 'default' : 'secondary'}>
                      {report.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
