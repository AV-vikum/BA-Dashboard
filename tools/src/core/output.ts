// One-line result formatting shared by the CLI and the MCP server
// (short output keeps Claude's token use low).

export const ok = (message: string): string => `✓ ${message}`;
export const warn = (message: string): string => `! ${message}`;
export const fail = (message: string): string => `✗ ${message}`;

export function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
}

/** Local calendar date, YYYY-MM-DD. */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
