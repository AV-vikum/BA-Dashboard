import { useEffect } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const appName = import.meta.env.VITE_APP_NAME;

  useEffect(() => {
    document.title = `Not found · ${appName}`;
  }, [appName]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
      <Button asChild>
        <Link to="/">Back to my reports</Link>
      </Button>
    </div>
  );
}
