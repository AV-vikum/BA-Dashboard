import {
  isInternalEmail,
  parseEmailList,
  type AccessConfig,
  type Group,
  type WithId,
} from '@ba/shared';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { saveGroup } from '@/lib/firestore/admin';

// Keyed by group?.id ?? 'new' from the caller, so opening a different
// group (or switching create -> edit) remounts this with fresh initial
// state instead of syncing via a setState-in-effect.
function GroupDialogForm({
  group,
  groups,
  accessConfig,
  onOpenChange,
}: {
  group: WithId<Group> | null;
  groups: WithId<Group>[];
  accessConfig: AccessConfig | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [membersText, setMembersText] = useState(group?.memberEmails.join('\n') ?? '');
  const [saving, setSaving] = useState(false);
  const nameId = useId();
  const descriptionId = useId();
  const membersId = useId();

  const trimmedName = name.trim();
  const nameTaken = groups.some(
    (g) => g.id !== group?.id && g.name.toLowerCase() === trimmedName.toLowerCase(),
  );
  const canSave = trimmedName.length > 0 && !nameTaken && !saving;

  async function handleSave() {
    if (!canSave) return;
    const { emails, invalid } = parseEmailList(membersText);
    const allowedDomains = accessConfig?.allowedDomains ?? [];
    const rejected = emails.filter((e) => !isInternalEmail(e, allowedDomains));
    const memberEmails = emails.filter((e) => isInternalEmail(e, allowedDomains));

    setSaving(true);
    try {
      const { reportsUpdated } = await saveGroup({
        id: group?.id,
        name: trimmedName,
        description,
        memberEmails,
      });
      toast.success(
        reportsUpdated > 0
          ? `Saved — updated access on ${reportsUpdated} report(s).`
          : 'Group saved.',
      );
      if (invalid.length > 0) {
        toast.warning(`Skipped invalid email(s): ${invalid.join(', ')}`);
      }
      if (rejected.length > 0) {
        toast.warning(`Skipped outside your organization: ${rejected.join(', ')}`);
      }
      onOpenChange(false);
    } catch {
      toast.error('Could not save the group.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{group ? 'Edit group' : 'New group'}</DialogTitle>
        <DialogDescription>Members must be from your organization's domains.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={nameId}>Name</Label>
          <Input id={nameId} value={name} onChange={(e) => setName(e.target.value)} required />
          {nameTaken && (
            <p className="text-xs text-destructive">A group with this name already exists.</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={descriptionId}>Description</Label>
          <Textarea
            id={descriptionId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={membersId}>Members</Label>
          <Textarea
            id={membersId}
            value={membersText}
            onChange={(e) => setMembersText(e.target.value)}
            placeholder="One email per line, or paste a comma-separated list"
            className="min-h-32 font-mono text-xs"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => void handleSave()} disabled={!canSave}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </>
  );
}

export function GroupDialog({
  group,
  groups,
  accessConfig,
  open,
  onOpenChange,
}: {
  group: WithId<Group> | null; // null = create
  groups: WithId<Group>[];
  accessConfig: AccessConfig | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <GroupDialogForm
            key={group?.id ?? 'new'}
            group={group}
            groups={groups}
            accessConfig={accessConfig}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
