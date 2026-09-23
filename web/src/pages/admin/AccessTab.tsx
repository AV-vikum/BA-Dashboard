import {
  accessSummary,
  computeViewerEmails,
  isInternalEmail,
  normalizeEmail,
  type AccessChange,
  type AccessConfig,
  type Group,
  type Report,
  type UserProfile,
  type WithId,
} from '@ba/shared';
import { ChevronDown, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  subscribeAccessConfig,
  subscribeGroups,
  subscribeUserProfiles,
  updateReportAccess,
} from '@/lib/firestore/admin';
import { EmailCombobox } from './EmailCombobox';

// Local editable copy of a report's access fields, so Save/Discard can work
// against a draft instead of writing on every click.
interface AccessDraft {
  directEmails: string[];
  groupIds: string[];
  externalEmails: string[];
  externalExpiry: Record<string, Date | null>;
}

function draftFromReport(report: WithId<Report>): AccessDraft {
  return {
    directEmails: [...report.directEmails],
    groupIds: [...report.groupIds],
    externalEmails: [...report.externalEmails],
    externalExpiry: Object.fromEntries(
      report.externalEmails.map((email) => {
        const normalized = normalizeEmail(email);
        const expiry = report.externalExpiry[normalized];
        return [normalized, expiry ? expiry.toDate() : null];
      }),
    ),
  };
}

function draftsEqual(a: AccessDraft, b: AccessDraft): boolean {
  const sameList = (x: string[], y: string[]) =>
    JSON.stringify([...x].sort()) === JSON.stringify([...y].sort());
  const sameExpiry = (x: AccessDraft['externalExpiry'], y: AccessDraft['externalExpiry']) => {
    const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
    return [...keys].every((k) => (x[k]?.getTime() ?? null) === (y[k]?.getTime() ?? null));
  };
  return (
    sameList(a.directEmails, b.directEmails) &&
    sameList(a.groupIds, b.groupIds) &&
    sameList(a.externalEmails, b.externalEmails) &&
    sameExpiry(a.externalExpiry, b.externalExpiry)
  );
}

// Plain helper (not inline in render) so the eslint purity rule doesn't
// flag the Date.now() call — same pattern as accessSummary()'s `now` param.
function isExpired(date: Date | null, now: Date = new Date()): boolean {
  return date !== null && date.getTime() <= now.getTime();
}

function ExpiryPicker({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (date: Date | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="font-normal">
          {value ? value.toLocaleDateString() : 'No expiry'} <ChevronDown className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex items-center justify-between px-2.5 pt-1.5">
          <span className="text-sm font-medium">Expires</span>
          {value && (
            <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
              No expiry
            </Button>
          )}
        </div>
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(date) => {
            if (date) {
              // End of the chosen day, local time (architecture.md §A7).
              date.setHours(23, 59, 59, 999);
              onChange(date);
            }
            setOpen(false);
          }}
          disabled={{ before: new Date() }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function AccessTab({ report }: { report: WithId<Report> }) {
  const [groups, setGroups] = useState<WithId<Group>[]>([]);
  const [profiles, setProfiles] = useState<WithId<UserProfile>[]>([]);
  const [accessConfig, setAccessConfig] = useState<AccessConfig | null>(null);
  const [draft, setDraft] = useState<AccessDraft>(() => draftFromReport(report));
  const [saving, setSaving] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => subscribeGroups(setGroups, () => toast.error('Could not load groups.')), []);
  useEffect(
    () => subscribeUserProfiles(setProfiles, () => toast.error('Could not load people.')),
    [],
  );
  useEffect(
    () => subscribeAccessConfig(setAccessConfig, () => toast.error('Could not load settings.')),
    [],
  );

  // Only reset the draft when a *different* report loads (this component
  // is keyed by report.id from the caller) — not on every live update,
  // which would wipe out in-progress edits.
  const original = useMemo(() => draftFromReport(report), [report]);
  const dirty = !draftsEqual(draft, original);
  const allowedDomains = accessConfig?.allowedDomains ?? [];
  const allowExternalSharing = accessConfig?.allowExternalSharing ?? false;

  const knownEmails = useMemo(() => {
    const emails = new Set<string>();
    for (const p of profiles) emails.add(normalizeEmail(p.email));
    for (const g of groups) for (const e of g.memberEmails) emails.add(normalizeEmail(e));
    return [...emails].sort();
  }, [profiles, groups]);

  function addPeople(emails: string[]) {
    const toExternal: string[] = [];
    const toDirect: string[] = [];
    for (const raw of emails) {
      const email = normalizeEmail(raw);
      if (isInternalEmail(email, allowedDomains)) toDirect.push(email);
      else toExternal.push(email);
    }
    if (toDirect.length > 0) {
      setDraft((d) => ({ ...d, directEmails: [...new Set([...d.directEmails, ...toDirect])] }));
    }
    if (toExternal.length > 0) {
      if (!allowExternalSharing) {
        toast.error(
          `${toExternal.join(', ')} ${toExternal.length > 1 ? 'are' : 'is'} outside your organization, and external sharing is off in Settings.`,
        );
      } else {
        setDraft((d) => ({
          ...d,
          externalEmails: [...new Set([...d.externalEmails, ...toExternal])],
          externalExpiry: {
            ...d.externalExpiry,
            ...Object.fromEntries(toExternal.map((e) => [e, d.externalExpiry[e] ?? null])),
          },
        }));
        toast.info(
          `${toExternal.join(', ')} ${toExternal.length > 1 ? 'are' : 'is'} outside your organization — added as external.`,
        );
      }
    }
  }

  function removeDirect(email: string) {
    setDraft((d) => ({ ...d, directEmails: d.directEmails.filter((e) => e !== email) }));
  }

  function toggleGroup(groupId: string) {
    setDraft((d) => ({
      ...d,
      groupIds: d.groupIds.includes(groupId)
        ? d.groupIds.filter((g) => g !== groupId)
        : [...d.groupIds, groupId],
    }));
  }

  function removeExternal(email: string) {
    setDraft((d) => ({
      ...d,
      externalEmails: d.externalEmails.filter((e) => e !== email),
      externalExpiry: Object.fromEntries(
        Object.entries(d.externalExpiry).filter(([e]) => e !== email),
      ),
    }));
  }

  function setExternalExpiry(email: string, date: Date | null) {
    setDraft((d) => ({ ...d, externalExpiry: { ...d.externalExpiry, [email]: date } }));
  }

  function discard() {
    setDraft(draftFromReport(report));
  }

  async function save() {
    setSaving(true);
    try {
      const change: AccessChange = {
        addEmails: draft.directEmails,
        removeEmails: original.directEmails.filter((e) => !draft.directEmails.includes(e)),
        addGroupIds: draft.groupIds,
        removeGroupIds: original.groupIds.filter((g) => !draft.groupIds.includes(g)),
        addExternal: draft.externalEmails.map((email) => ({
          email,
          expires: draft.externalExpiry[email] ?? null,
        })),
        removeExternal: original.externalEmails.filter((e) => !draft.externalEmails.includes(e)),
      };
      const { warnings } = await updateReportAccess(report.id, change);
      toast.success('Access saved.');
      for (const warning of warnings) toast.warning(warning);
    } catch {
      toast.error('Could not save access.');
    } finally {
      setSaving(false);
    }
  }

  const previewViewerEmails = computeViewerEmails(draft.directEmails, draft.groupIds, groups);
  const summary = accessSummary({
    viewerEmails: previewViewerEmails,
    externalEmails: draft.externalEmails,
    externalExpiry: Object.fromEntries(
      Object.entries(draft.externalExpiry).map(([email, date]) => [
        email,
        date ? { toDate: () => date } : null,
      ]),
    ),
  });

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* People in your organization */}
      <div className="flex flex-col gap-2">
        <Label>People in your organization</Label>
        <EmailCombobox
          suggestions={knownEmails}
          alreadyAdded={[...draft.directEmails, ...draft.externalEmails]}
          onAdd={addPeople}
        />
        {draft.directEmails.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {draft.directEmails.map((email) => (
              <Badge key={email} variant="secondary" className="gap-1">
                {email}
                <button
                  type="button"
                  onClick={() => removeDirect(email)}
                  aria-label={`Remove ${email}`}
                  className="cursor-pointer rounded-full hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Groups */}
      <div className="flex flex-col gap-2">
        <Label>Groups</Label>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No groups yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {groups.map((group) => (
              <label key={group.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.groupIds.includes(group.id)}
                  onCheckedChange={() => toggleGroup(group.id)}
                />
                {group.name}{' '}
                <span className="text-muted-foreground">({group.memberEmails.length} members)</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* External people */}
      <div className="flex flex-col gap-2">
        <Label>External people</Label>
        {!allowExternalSharing && (
          <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
            External sharing is turned off in Settings — these people can&apos;t open the report.
          </p>
        )}
        {draft.externalEmails.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {draft.externalEmails.map((email) => {
              const expiry = draft.externalExpiry[email] ?? null;
              const expired = isExpired(expiry);
              return (
                <div key={email} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{email}</span>
                  <Badge variant={expired ? 'destructive' : 'outline'}>
                    {expired ? 'Expired' : 'Active'}
                  </Badge>
                  <ExpiryPicker value={expiry} onChange={(d) => setExternalExpiry(email, d)} />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${email}`}
                    onClick={() => removeExternal(email)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="rounded-md border p-3">
        <button
          type="button"
          onClick={() => setSummaryOpen((o) => !o)}
          className="flex w-full items-center justify-between text-sm font-medium"
        >
          {report.status === 'draft' ? (
            <span>Only admins can see drafts. Publish to give access.</span>
          ) : (
            <span>{summary.internalCount + summary.externalCount} people can view this report</span>
          )}
          <ChevronDown
            className={`size-4 transition-transform ${summaryOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {summaryOpen && (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            {draft.directEmails.map((email) => (
              <li key={`direct:${email}`}>
                {email} — <span className="text-foreground">Direct</span>
              </li>
            ))}
            {draft.groupIds.map((groupId) => {
              const group = groups.find((g) => g.id === groupId);
              return (group?.memberEmails ?? []).map((email) => (
                <li key={`group:${groupId}:${email}`}>
                  {email} — <span className="text-foreground">Group: {group?.name}</span>
                </li>
              ));
            })}
            {draft.externalEmails.map((email) => (
              <li key={`external:${email}`}>
                {email} — <span className="text-foreground">External</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={() => void save()} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button variant="outline" onClick={discard} disabled={!dirty || saving}>
          Discard
        </Button>
      </div>
    </div>
  );
}
