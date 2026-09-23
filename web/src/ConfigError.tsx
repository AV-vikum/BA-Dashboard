// Rendered instead of the app when required VITE_* variables are missing or
// invalid, so a misconfigured deploy fails loudly instead of breaking later
// at first Firebase call.
export function ConfigError({ problems }: { problems: string[] }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-md space-y-4">
        <h1 className="text-xl font-bold">Configuration error</h1>
        <p className="text-sm text-muted-foreground">
          The app can't start because of a problem with its environment variables:
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Check the <code>.env</code> file for this environment against <code>.env.example</code>.
        </p>
      </div>
    </div>
  );
}
