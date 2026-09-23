import { useEffect } from 'react';

// Placeholder — built out in Phase 4 (admin guard, layout and child routes).
export function AdminLayout() {
  const appName = import.meta.env.VITE_APP_NAME;

  useEffect(() => {
    document.title = `Admin · ${appName}`;
  }, [appName]);

  return <h1 className="text-2xl font-bold">Admin</h1>;
}
