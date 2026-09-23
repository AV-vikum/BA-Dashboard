import { FileQuestion } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { MessagePage } from '@/components/MessagePage';

export function NotFoundPage() {
  const appName = import.meta.env.VITE_APP_NAME;

  useEffect(() => {
    document.title = `Not found · ${appName}`;
  }, [appName]);

  return (
    <MessagePage
      icon={FileQuestion}
      title="Page not found"
      text="The page you're looking for doesn't exist."
    >
      <Button asChild>
        <Link to="/">Back to my reports</Link>
      </Button>
    </MessagePage>
  );
}
