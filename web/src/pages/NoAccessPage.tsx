import { ShieldOff } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessagePage } from '@/components/MessagePage';
import { useAuth } from '@/auth/AuthContext';

export function NoAccessPage() {
  const { user, signOut, signIn } = useAuth();
  const appName = import.meta.env.VITE_APP_NAME;

  useEffect(() => {
    document.title = `No access · ${appName}`;
  }, [appName]);

  async function handleSwitchAccount() {
    await signOut();
    await signIn();
  }

  return (
    <MessagePage
      icon={ShieldOff}
      title="You don't have access to any reports"
      text={`Signed in as ${user?.email}`}
    >
      <Button onClick={handleSwitchAccount}>Use a different account</Button>
    </MessagePage>
  );
}
