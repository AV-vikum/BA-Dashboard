import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ConfigError } from './ConfigError.tsx';
import { EmulatorBadge } from './EmulatorBadge.tsx';
import { envResult } from './lib/env';
import './index.css';

const root = createRoot(document.getElementById('root')!);

if (!envResult.ok) {
  // Don't import firebase.ts (and anything that imports it) when the env is
  // invalid — it throws on invalid config.
  root.render(
    <StrictMode>
      <ConfigError problems={envResult.problems} />
    </StrictMode>,
  );
} else {
  const { useEmulators } = await import('./lib/firebase');
  root.render(
    <StrictMode>
      <App />
      {useEmulators && <EmulatorBadge />}
    </StrictMode>,
  );
}
