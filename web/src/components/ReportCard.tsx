import { Link, useLocation } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { RelativeDate } from '@/components/RelativeDate';
import type { Report, WithId } from '@ba/shared';

export function ReportCard({ report }: { report: WithId<Report> }) {
  const location = useLocation();

  return (
    <Link
      to={`/r/${report.id}`}
      state={{ from: location.pathname + location.search }}
      className="flex flex-col gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <h2 className="font-semibold">{report.title}</h2>
      {report.description ? (
        <p className="line-clamp-2 text-sm text-muted-foreground">{report.description}</p>
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
  );
}
