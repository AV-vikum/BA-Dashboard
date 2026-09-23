import { useCallback, useEffect, useMemo, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'ba-theme';

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // localStorage unavailable (private mode, blocked) — fall back silently.
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(theme: Theme): ResolvedTheme {
  return theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : theme;
}

// light/dark/system, persisted to localStorage, applied as the `dark`
// class on <html> per shadcn's Vite dark-mode guide. The report viewer
// passes `resolvedTheme` (never 'system') to withTheme — the iframe needs
// a concrete value, not a preference.
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  // Only needed to force a re-render when the OS preference changes while
  // theme === 'system'; resolve() itself reads matchMedia synchronously.
  const [systemChangeCount, setSystemChangeCount] = useState(0);

  // systemChangeCount forces recomputation when matchMedia's live value
  // changes; resolve() reads matchMedia directly, not through a tracked
  // dependency, so eslint can't see why it belongs here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolvedTheme = useMemo(() => resolve(theme), [theme, systemChangeCount]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemChangeCount((c) => c + 1);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort persistence only.
    }
  }, []);

  return { theme, resolvedTheme, setTheme };
}
