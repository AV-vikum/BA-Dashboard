// Fixed badge shown while the app talks to the local Firebase emulators,
// so it's obvious at a glance which environment is active.
export function EmulatorBadge() {
  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-50 rounded-md bg-amber-500 px-2 py-1 text-xs font-medium text-amber-950 shadow">
      Emulator mode
    </div>
  );
}
