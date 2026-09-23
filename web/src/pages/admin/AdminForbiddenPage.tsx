import { ShieldOff } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { MessagePage } from '@/components/MessagePage';

export function AdminForbiddenPage() {
  const appName = import.meta.env.VITE_APP_NAME;

  useEffect(() => {
    document.title = `Admins only · ${appName}`;
  }, [appName]);

  return (
    <MessagePage
      icon={ShieldOff}
      title="Admins only"
      text="You don't have access to the admin area."
    >
      <Button asChild>
        <Link to="/">Back to my reports</Link>
      </Button>
    </MessagePage>
  );
}
