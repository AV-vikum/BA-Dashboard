import { useCallback, useEffect, useState } from 'react';

// Minimal light/dark toggle for step 3.3's AppShell. Step 3.10 replaces
// this with the full light/dark/system implementation (localStorage
// persistence, system preference, resolved theme for the report iframe).
export type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
