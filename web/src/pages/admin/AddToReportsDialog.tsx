import type { Report, WithId } from '@ba/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { updateReportAccess } from '@/lib/firestore/admin';
import type { Person } from './AdminPeoplePage';

// Adds a person to several reports at once — internal emails go into
// directEmails, external emails into externalEmails with an optional
// expiry (step 4.7).
export function AddToReportsDialog({
  person,
  reports,
  alreadyVisibleIds,
  open,
  onOpenChange,
}: {
  person: Person;
  reports: WithId<Report>[];
  alreadyVisibleIds: Set<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expires, setExpires] = useState<Date | null>(null);
  const [expiryOpen, setExpiryOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const candidates = reports.filter((r) => !alreadyVisibleIds.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        [...selected].map((id) =>
          updateReportAccess(
            id,
            person.isInternal
              ? { addEmails: [person.email] }
              : { addExternal: [{ email: person.email, expires }] },
          ),
        ),
      );
      toast.success(`Added ${person.email} to ${selected.size} report(s).`);
      setSelected(new Set());
      setExpires(null);
      onOpenChange(false);
    } catch {
      toast.error('Could not add to all selected reports.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add {person.email} to reports</DialogTitle>
          <DialogDescription>
            {person.isInternal
              ? 'Added directly to each selected report.'
              : 'Added as external access to each selected report.'}
          </DialogDescription>
        </DialogHeader>

        {!person.isInternal && (
          <Popover open={expiryOpen} onOpenChange={setExpiryOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="self-start font-normal">
                Expiry: {expires ? expires.toLocaleDateString() : 'No expiry'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex items-center justify-between px-2.5 pt-1.5">
                <span className="text-sm font-medium">Expires</span>
                {expires && (
                  <Button variant="ghost" size="sm" onClick={() => setExpires(null)}>
                    No expiry
                  </Button>
                )}
              </div>
              <Calendar
                mode="single"
                selected={expires ?? undefined}
                onSelect={(date) => {
                  if (date) {
                    date.setHours(23, 59, 59, 999);
                    setExpires(date);
                  }
                  setExpiryOpen(false);
                }}
                disabled={{ before: new Date() }}
              />
            </PopoverContent>
          </Popover>
        )}

        <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Already on every report.</p>
          ) : (
            candidates.map((report) => (
              <label key={report.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.has(report.id)}
                  onCheckedChange={() => toggle(report.id)}
                />
                {report.title}
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleAdd()} disabled={selected.size === 0 || saving}>
            {saving
              ? 'Adding…'
              : selected.size > 0
                ? `Add to ${selected.size} report${selected.size > 1 ? 's' : ''}`
                : 'Add to reports'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
