import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">You don't have access to any reports</h1>
      <p className="text-sm text-muted-foreground">Signed in as {user?.email}</p>
      <Button onClick={handleSwitchAccount}>Use a different account</Button>
    </div>
  );
}
