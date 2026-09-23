import { useEffect } from 'react';

// Placeholder — built out in step 3.6.
export function MyReportsPage() {
  const appName = import.meta.env.VITE_APP_NAME;

  useEffect(() => {
    document.title = `My reports · ${appName}`;
  }, [appName]);

  return <h1 className="text-2xl font-bold">My reports</h1>;
}
