import {
  isInternalEmail,
  normalizeEmail,
  reportsVisibleTo,
  type AccessConfig,
  type Report,
  type UserProfile,
  type WithId,
} from '@ba/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageHeader';
import { RelativeDate } from '@/components/RelativeDate';
import {
  subscribeAccessConfig,
  subscribeAdmins,
  subscribeAllReports,
  subscribeUserProfiles,
} from '@/lib/firestore/admin';
import { EmailCombobox } from './EmailCombobox';

export function AdminViewAsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState<WithId<Report>[] | null>(null);
  const [accessConfig, setAccessConfig] = useState<AccessConfig | null>(null);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<WithId<UserProfile>[]>([]);
  const appName = import.meta.env.VITE_APP_NAME;

  const email = searchParams.get('email') ?? '';

  useEffect(() => {
    document.title = `View as · Admin · ${appName}`;
  }, [appName]);

  useEffect(
    () => subscribeAllReports(setReports, () => toast.error('Could not load reports.')),
    [],
  );
  useEffect(
    () => subscribeAccessConfig(setAccessConfig, () => toast.error('Could not load settings.')),
    [],
  );
  useEffect(
    () =>
      subscribeAdmins(
        (admins) => setAdminEmails(admins?.emails ?? []),
        () => undefined,
      ),
    [],
  );
  useEffect(() => subscribeUserProfiles(setProfiles, () => undefined), []);

  function setEmail(next: string) {
    setSearchParams(
      (prev) => {
        const nextParams = new URLSearchParams(prev);
        if (next) nextParams.set('email', next);
        else nextParams.delete('email');
        return nextParams;
      },
      { replace: true },
    );
  }

  const normalized = normalizeEmail(email);
  const isAdminEmail = adminEmails.map(normalizeEmail).includes(normalized);
  const isInternal = accessConfig
    ? isInternalEmail(normalized, accessConfig.allowedDomains)
    : false;

  const visible = useMemo(() => {
    if (!reports || !accessConfig || !email) return [];
    return reportsVisibleTo(normalized, reports, {
      isAdmin: isAdminEmail,
      isInternal,
      allowExternalSharing: accessConfig.allowExternalSharing,
    });
  }, [reports, accessConfig, normalized, isAdminEmail, isInternal, email]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="View as user"
        description="See what a specific person sees on My reports."
      />

      <div className="max-w-sm">
        <EmailCombobox
          suggestions={[...new Set([...profiles.map((p) => p.email), ...adminEmails])].sort()}
          alreadyAdded={email ? [email] : []}
          onAdd={(emails) => setEmail(emails[0] ?? '')}
          placeholder={email || 'Pick a person to view as…'}
        />
      </div>

      {!email ? (
        <p className="py-12 text-center text-muted-foreground">
          Enter an email to preview their view.
        </p>
      ) : (
        <>
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            Viewing as <span className="font-medium">{normalized}</span> — this is what they see.{' '}
            {isAdminEmail && '(They are an admin, so they see every published report.)'}
            {!isAdminEmail && !isInternal && '(Outside your organization — external access only.)'}
          </div>

          {!reports || !accessConfig ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-36 rounded-lg" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              {normalized} can't see any reports.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map(({ report, via }) => (
                <Link
                  key={report.id}
                  to={`/admin/reports/${report.id}`}
                  className="flex flex-col gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold">{report.title}</h2>
                    <Badge variant={via === 'internal' ? 'outline' : 'secondary'}>{via}</Badge>
                  </div>
                  {report.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {report.description}
                    </p>
                  ) : null}
                  {report.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {report.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="mt-auto text-xs text-muted-foreground">
                    <RelativeDate timestamp={report.updatedAt} prefix="Updated " />
                  </p>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
