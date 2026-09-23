import { format, formatDistanceToNow } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { TimestampLike } from '@ba/shared';

// "Updated 3 days ago", exact date on hover (conventions.md §5).
export function RelativeDate({ timestamp, prefix }: { timestamp: TimestampLike; prefix?: string }) {
  const date = timestamp.toDate();
  const relative = formatDistanceToNow(date, { addSuffix: true });
  const exact = format(date, 'PPPp');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          {prefix}
          {relative}
        </span>
      </TooltipTrigger>
      <TooltipContent>{exact}</TooltipContent>
    </Tooltip>
  );
}
