import { collectTags, filterReports } from '@ba/shared';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportCard } from '@/components/ReportCard';
import { useAuth } from '@/auth/AuthContext';
import { useMyReports } from '@/hooks/useMyReports';
import { NoAccessPage } from './NoAccessPage';

type Sort = 'updated' | 'title';

export function MyReportsPage() {
  const { isInternal } = useAuth();
  const { reports, loading } = useMyReports();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const appName = import.meta.env.VITE_APP_NAME;

  const query = searchParams.get('q') ?? '';
  const activeTags = useMemo(
    () =>
      (searchParams.get('tags') ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [searchParams],
  );
  const sort: Sort = searchParams.get('sort') === 'title' ? 'title' : 'updated';

  useEffect(() => {
    document.title = `My reports · ${appName}`;
  }, [appName]);

  // "/" focuses search, Esc clears it (when it's not already empty and focused elsewhere).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && target === searchInputRef.current) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete('q');
            return next;
          },
          { replace: true },
        );
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setSearchParams]);

  function updateParam(key: string, value: string | null) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null || value === '') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  }

  function toggleTag(tag: string) {
    const next = activeTags.includes(tag)
      ? activeTags.filter((t) => t !== tag)
      : [...activeTags, tag];
    updateParam('tags', next.join(','));
  }

  const tags = useMemo(() => collectTags(reports), [reports]);

  const filtered = useMemo(() => {
    const result = filterReports(reports, { query, tags: activeTags });
    return [...result].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      return b.updatedAt.toDate().getTime() - a.updatedAt.toDate().getTime();
    });
  }, [reports, query, activeTags, sort]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!isInternal && reports.length === 0) {
    return <NoAccessPage />;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          My reports <span className="text-muted-foreground">({reports.length})</span>
        </h1>
        <Select value={sort} onValueChange={(value) => updateParam('sort', value)}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Sort reports">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="title">Title A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="relative max-w-sm">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={searchInputRef}
          value={query}
          onChange={(e) => updateParam('q', e.target.value)}
          placeholder="Search reports…"
          aria-label="Search reports"
          className="pl-8"
        />
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map(({ tag, count }) => {
            const active = activeTags.includes(tag);
            return (
              <Badge key={tag} variant={active ? 'default' : 'outline'} asChild>
                <button
                  type="button"
                  onClick={() => toggleTag(tag)}
                  aria-pressed={active}
                  className="cursor-pointer"
                >
                  {tag} ({count})
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-muted-foreground">
            {reports.length === 0
              ? 'No reports have been shared with you yet.'
              : 'No reports match your search.'}
          </p>
          {reports.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
