import { useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';

export function LoginPage() {
  const { status, signIn } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const appName = import.meta.env.VITE_APP_NAME;

  useEffect(() => {
    document.title = `Sign in · ${appName}`;
  }, [appName]);

  if (status === 'signedIn') {
    return <Navigate to={searchParams.get('next') ?? '/'} replace />;
  }

  async function handleSignIn() {
    await signIn();
    navigate(searchParams.get('next') ?? '/');
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold">{appName}</h1>
        <p className="text-sm text-muted-foreground">Sign in with your work Google account</p>
        <Button onClick={handleSignIn} className="w-full">
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
