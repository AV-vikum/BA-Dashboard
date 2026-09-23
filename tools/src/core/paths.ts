// Resolved from import.meta.url, not process.cwd() — the MCP server can be
// launched by a client (Claude Desktop/Code) from any working directory.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', // src
  '..', // tools
  '..', // repo root
);

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,60}$/;

/** Throws a clear error unless `slug` is a valid report folder name. */
export function assertValidSlug(slug: string): void {
  if (slug === '_example') return;
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      `Invalid report slug "${slug}": must be lower-case letters, digits and hyphens, ` +
        `2–61 characters, starting with a letter or digit (or the literal "_example").`,
    );
  }
}

/** Absolute path to the reports directory (default `<repo>/reports`). */
export function resolveReportsDir(env: { REPORTS_DIR?: string }): string {
  const configured = env.REPORTS_DIR?.trim();
  if (!configured) return path.join(REPO_ROOT, 'reports');
  return path.resolve(REPO_ROOT, configured);
}

/**
 * Absolute path to a single report's folder. Rejects slugs that would
 * resolve outside the reports directory (e.g. containing "..").
 */
export function reportFolder(reportsDir: string, slug: string): string {
  assertValidSlug(slug);
  const folder = path.resolve(reportsDir, slug);
  const relative = path.relative(reportsDir, folder);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Report slug "${slug}" resolves outside the reports directory.`);
  }
  return folder;
}
