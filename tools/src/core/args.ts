// Parsing of CLI option values (kept separate from cli.ts so it can be unit-tested).

/** Collects repeatable, comma-separated option values: --add a@x.com,b@x.com --add c@x.com */
export function collectList(value: string, previous: string[] = []): string[] {
  return [
    ...previous,
    ...value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  ];
}

/** "email" or "email:YYYY-MM-DD" */
export function parseExternal(value: string): { email: string; expires: string | null } {
  const match = /^(.+):(\d{4}-\d{2}-\d{2})$/.exec(value.trim());
  return match ? { email: match[1]!, expires: match[2]! } : { email: value.trim(), expires: null };
}
