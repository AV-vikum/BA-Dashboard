import { useTheme } from '@/hooks/useTheme';
import { withTheme } from '@/lib/report-frame';

// Sandboxed report iframe — no allow-same-origin, so the report can never
// read the app's cookies/storage/auth (architecture.md §A8). Shared by the
// viewer (step 3.7) and the admin preview (step 4.5).
export function ReportFrame({
  html,
  title,
  className,
}: {
  html: string;
  title: string;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();

  return (
    <iframe
      title={title}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      srcDoc={withTheme(html, resolvedTheme)}
      className={className ?? 'h-full w-full border-0'}
    />
  );
}
