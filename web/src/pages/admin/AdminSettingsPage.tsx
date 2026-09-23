import {
  domainOf,
  isValidDomain,
  isValidEmail,
  normalizeDomain,
  normalizeEmail,
  type AccessConfig,
  type AdminsConfig,
  type Report,
  type WithId,
} from '@ba/shared';
import { Trash2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/auth/AuthContext';
import {
  cleanupExpiredExternal,
  subscribeAccessConfig,
  subscribeAdmins,
  subscribeAllReports,
  updateAccessConfig,
  updateAdmins,
} from '@/lib/firestore/admin';

function peopleAffectedByDomain(reports: WithId<Report>[], domain: string): number {
  const emails = new Set<string>();
  for (const report of reports) {
    for (const email of [...report.directEmails]) {
      if (domainOf(email) === domain) emails.add(normalizeEmail(email));
    }
  }
  return emails.size;
}

function DomainsCard({
  accessConfig,
  reports,
}: {
  accessConfig: AccessConfig | null;
  reports: WithId<Report>[] | null;
}) {
  const [draft, setDraft] = useState('');
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const domains = accessConfig?.allowedDomains ?? [];

  async function addDomain() {
    const domain = normalizeDomain(draft);
    if (!isValidDomain(domain)) {
      toast.error(`"${draft}" doesn't look like a valid domain.`);
      return;
    }
    if (domains.includes(domain)) {
      setDraft('');
      return;
    }
    setSaving(true);
    try {
      await updateAccessConfig({ allowedDomains: [...domains, domain] });
      setDraft('');
    } catch {
      toast.error('Could not add the domain.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setSaving(true);
    try {
      await updateAccessConfig({ allowedDomains: domains.filter((d) => d !== removeTarget) });
      setRemoveTarget(null);
    } catch {
      toast.error('Could not remove the domain.');
    } finally {
      setSaving(false);
    }
  }

  const affected = removeTarget && reports ? peopleAffectedByDomain(reports, removeTarget) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allowed email domains</CardTitle>
        <CardDescription>People signing in from these domains count as internal.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!accessConfig ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {domains.map((domain) => (
                <Badge key={domain} variant="secondary" className="gap-1">
                  {domain}
                  <button
                    type="button"
                    onClick={() => setRemoveTarget(domain)}
                    aria-label={`Remove ${domain}`}
                    disabled={domains.length <= 1}
                    className="cursor-pointer rounded-full hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void addDomain();
                  }
                }}
                placeholder="example.com"
                aria-label="Add a domain"
              />
              <Button onClick={() => void addDomain()} disabled={!draft.trim() || saving}>
                Add
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{removeTarget}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {affected > 0
                ? `${affected} ${affected === 1 ? 'person' : 'people'} with access will lose it.`
                : "No one's direct access depends on this domain."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void confirmRemove();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function AdminsCard({ admins }: { admins: AdminsConfig | null }) {
  const { user, signOut } = useAuth();
  const [draft, setDraft] = useState('');
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const emails = admins?.emails ?? [];

  async function addAdmin() {
    const email = normalizeEmail(draft);
    if (!isValidEmail(email)) {
      toast.error(`"${draft}" doesn't look like a valid email.`);
      return;
    }
    if (emails.includes(email)) {
      setDraft('');
      return;
    }
    setSaving(true);
    try {
      await updateAdmins([...emails, email]);
      setDraft('');
    } catch {
      toast.error('Could not add the admin.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    const removingSelf = user && normalizeEmail(user.email) === removeTarget;
    setSaving(true);
    try {
      await updateAdmins(emails.filter((e) => e !== removeTarget));
      setRemoveTarget(null);
      if (removingSelf) await signOut();
    } catch {
      toast.error('Could not remove the admin.');
    } finally {
      setSaving(false);
    }
  }

  const removingSelf = user && removeTarget && normalizeEmail(user.email) === removeTarget;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admins</CardTitle>
        <CardDescription>Admins manage reports, people, groups and settings.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!admins ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {emails.map((email) => (
                <Badge key={email} variant="secondary" className="gap-1">
                  {email}
                  <button
                    type="button"
                    onClick={() => setRemoveTarget(email)}
                    aria-label={`Remove ${email}`}
                    disabled={emails.length <= 1}
                    className="cursor-pointer rounded-full hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void addAdmin();
                  }
                }}
                placeholder="person@example.com"
                aria-label="Add an admin"
              />
              <Button onClick={() => void addAdmin()} disabled={!draft.trim() || saving}>
                Add
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{removeTarget}" as admin?</AlertDialogTitle>
            {removingSelf && (
              <AlertDialogDescription>You'll lose admin access immediately.</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void confirmRemove();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

interface ExpiredEntry {
  reportId: string;
  reportTitle: string;
  email: string;
  expiredOn: Date;
}

function ExternalSharingCard({
  accessConfig,
  reports,
}: {
  accessConfig: AccessConfig | null;
  reports: WithId<Report>[] | null;
}) {
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const expired = useMemo<ExpiredEntry[]>(() => {
    if (!reports) return [];
    const now = new Date();
    const entries: ExpiredEntry[] = [];
    for (const report of reports) {
      for (const email of report.externalEmails) {
        const normalized = normalizeEmail(email);
        const expiry = report.externalExpiry[normalized];
        if (expiry && expiry.toDate() <= now) {
          entries.push({
            reportId: report.id,
            reportTitle: report.title,
            email: normalized,
            expiredOn: expiry.toDate(),
          });
        }
      }
    }
    return entries;
  }, [reports]);

  async function toggleSharing(checked: boolean) {
    setSaving(true);
    try {
      await updateAccessConfig({ allowExternalSharing: checked });
    } catch {
      toast.error('Could not update external sharing.');
    } finally {
      setSaving(false);
    }
  }

  async function cleanup() {
    setCleaning(true);
    try {
      const count = await cleanupExpiredExternal();
      toast.success(
        count > 0 ? `Removed expired access from ${count} report(s).` : 'Nothing to clean up.',
      );
    } catch {
      toast.error('Could not clean up expired access.');
    } finally {
      setCleaning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>External sharing</CardTitle>
        <CardDescription>
          Lets admins share individual reports with people outside your organization.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!accessConfig ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={accessConfig.allowExternalSharing}
              onCheckedChange={(checked) => void toggleSharing(checked)}
              disabled={saving}
            />
            {accessConfig.allowExternalSharing ? 'On' : 'Off'} — external people
            {accessConfig.allowExternalSharing ? ' can ' : " can't "}
            open reports shared with them.
          </label>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Expired external access{' '}
              <span className="text-muted-foreground">({expired.length})</span>
            </h3>
            {expired.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void cleanup()}
                disabled={cleaning}
              >
                {cleaning ? 'Removing…' : 'Remove all expired'}
              </Button>
            )}
          </div>
          {expired.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing expired.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {expired.map((entry) => (
                <li key={`${entry.reportId}:${entry.email}`}>
                  {entry.reportTitle} — {entry.email}, expired{' '}
                  {entry.expiredOn.toLocaleDateString()}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminSettingsPage() {
  const [accessConfig, setAccessConfig] = useState<AccessConfig | null>(null);
  const [admins, setAdmins] = useState<AdminsConfig | null>(null);
  const [reports, setReports] = useState<WithId<Report>[] | null>(null);
  const appName = import.meta.env.VITE_APP_NAME;

  useEffect(() => {
    document.title = `Settings · Admin · ${appName}`;
  }, [appName]);

  useEffect(
    () => subscribeAccessConfig(setAccessConfig, () => toast.error('Could not load settings.')),
    [],
  );
  useEffect(() => subscribeAdmins(setAdmins, () => toast.error('Could not load admins.')), []);
  useEffect(
    () => subscribeAllReports(setReports, () => toast.error('Could not load reports.')),
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-4">
        <DomainsCard accessConfig={accessConfig} reports={reports} />
        <AdminsCard admins={admins} />
        <ExternalSharingCard accessConfig={accessConfig} reports={reports} />
      </div>
    </div>
  );
}
