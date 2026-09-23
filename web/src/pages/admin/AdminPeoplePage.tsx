import {
  isInternalEmail,
  normalizeEmail,
  reportsVisibleTo,
  type AccessConfig,
  type AdminsConfig,
  type Group,
  type Report,
  type UserProfile,
  type WithId,
} from '@ba/shared';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import {
  subscribeAccessConfig,
  subscribeAdmins,
  subscribeAllReports,
  subscribeGroups,
  subscribeUserProfiles,
} from '@/lib/firestore/admin';
import { PersonSheet } from './PersonSheet';

export interface Person {
  email: string;
  displayName: string | null;
  photoURL: string | null;
  isInternal: boolean;
  hasSignedIn: boolean;
  lastLoginAt: UserProfile['lastLoginAt'] | null;
  isAdmin: boolean;
  groupCount: number;
}

function buildPeople(
  profiles: WithId<UserProfile>[],
  reports: WithId<Report>[],
  groups: WithId<Group>[],
  admins: string[],
  allowedDomains: string[],
): Person[] {
  const byEmail = new Map<string, Person>();

  function ensure(email: string): Person {
    const normalized = normalizeEmail(email);
    let person = byEmail.get(normalized);
    if (!person) {
      person = {
        email: normalized,
        displayName: null,
        photoURL: null,
        isInternal: isInternalEmail(normalized, allowedDomains),
        hasSignedIn: false,
        lastLoginAt: null,
        isAdmin: false,
        groupCount: 0,
      };
      byEmail.set(normalized, person);
    }
    return person;
  }

  for (const profile of profiles) {
    const person = ensure(profile.email);
    person.displayName = profile.displayName;
    person.photoURL = profile.photoURL;
    person.hasSignedIn = true;
    person.lastLoginAt = profile.lastLoginAt;
  }
  for (const report of reports) {
    for (const email of report.directEmails) ensure(email);
    for (const email of report.externalEmails) ensure(email);
  }
  for (const group of groups) {
    for (const email of group.memberEmails) ensure(email);
  }
  for (const email of admins) ensure(email).isAdmin = true;

  const groupCounts = new Map<string, number>();
  for (const group of groups) {
    for (const email of group.memberEmails) {
      const normalized = normalizeEmail(email);
      groupCounts.set(normalized, (groupCounts.get(normalized) ?? 0) + 1);
    }
  }
  for (const person of byEmail.values()) {
    person.groupCount = groupCounts.get(person.email) ?? 0;
  }

  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
}

export function AdminPeoplePage() {
  const [profiles, setProfiles] = useState<WithId<UserProfile>[] | null>(null);
  const [reports, setReports] = useState<WithId<Report>[] | null>(null);
  const [groups, setGroups] = useState<WithId<Group>[] | null>(null);
  const [admins, setAdmins] = useState<AdminsConfig | null>(null);
  const [accessConfig, setAccessConfig] = useState<AccessConfig | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'internal' | 'external'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const appName = import.meta.env.VITE_APP_NAME;

  useEffect(() => {
    document.title = `People · Admin · ${appName}`;
  }, [appName]);

  useEffect(
    () => subscribeUserProfiles(setProfiles, () => toast.error('Could not load people.')),
    [],
  );
  useEffect(
    () => subscribeAllReports(setReports, () => toast.error('Could not load reports.')),
    [],
  );
  useEffect(() => subscribeGroups(setGroups, () => toast.error('Could not load groups.')), []);
  useEffect(() => subscribeAdmins(setAdmins, () => toast.error('Could not load admins.')), []);
  useEffect(
    () => subscribeAccessConfig(setAccessConfig, () => toast.error('Could not load settings.')),
    [],
  );

  const loading = !profiles || !reports || !groups || !accessConfig;

  const people = useMemo(() => {
    if (loading) return [];
    return buildPeople(
      profiles,
      reports,
      groups,
      admins?.emails ?? [],
      accessConfig.allowedDomains,
    );
  }, [loading, profiles, reports, groups, admins, accessConfig]);

  const reportCountByEmail = useMemo(() => {
    if (!reports || !accessConfig) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const person of people) {
      const visible = reportsVisibleTo(person.email, reports, {
        isAdmin: person.isAdmin,
        isInternal: person.isInternal,
        allowExternalSharing: accessConfig.allowExternalSharing,
      });
      counts.set(person.email, visible.length);
    }
    return counts;
  }, [people, reports, accessConfig]);

  const filtered = useMemo(() => {
    return people.filter((person) => {
      if (typeFilter === 'internal' && !person.isInternal) return false;
      if (typeFilter === 'external' && person.isInternal) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const haystack = `${person.email} ${person.displayName ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [people, typeFilter, query]);

  const selectedPerson = selected ? (people.find((p) => p.email === selected) ?? null) : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="People" description={`${people.length} people with access or a profile`} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            aria-label="Search people"
            className="pl-8"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-40" aria-label="Filter by type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="internal">Internal</SelectItem>
            <SelectItem value="external">External</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No people match your filters.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead>Reports</TableHead>
                <TableHead>Groups</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((person) => (
                <TableRow
                  key={person.email}
                  className="cursor-pointer"
                  onClick={() => setSelected(person.email)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        {person.photoURL ? <AvatarImage src={person.photoURL} alt="" /> : null}
                        <AvatarFallback>
                          {(person.displayName ?? person.email)[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {person.displayName ?? person.email}
                          {person.isAdmin && (
                            <Badge variant="secondary" className="ml-1.5">
                              Admin
                            </Badge>
                          )}
                        </div>
                        {person.displayName && (
                          <div className="truncate text-xs text-muted-foreground">
                            {person.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{person.isInternal ? 'Internal' : 'External'}</TableCell>
                  <TableCell>
                    <Badge variant={person.hasSignedIn ? 'outline' : 'secondary'}>
                      {person.hasSignedIn ? 'Signed in' : 'Not signed in yet'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {person.lastLoginAt ? (
                      <RelativeDate timestamp={person.lastLoginAt} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{reportCountByEmail.get(person.email) ?? 0}</TableCell>
                  <TableCell>{person.groupCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedPerson && reports && groups && (
        <PersonSheet
          person={selectedPerson}
          reports={reports}
          groups={groups}
          open={selected !== null}
          onOpenChange={(open) => !open && setSelected(null)}
        />
      )}
    </div>
  );
}
