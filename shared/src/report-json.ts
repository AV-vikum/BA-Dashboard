// Schema for reports/<slug>/report.json — the local metadata file that the
// CLI/MCP publish from. See docs/plan/phase-5-report-toolkit.md#51.
import { z } from 'zod';
import { LIMITS } from './constants.js';
import { normalizeEmail } from './email.js';

const EMAIL = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'must be a valid email address'));

const DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date as YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00`)), 'must be a real calendar date');

export const ReportJsonSchema = z.object({
  reportId: z.string().min(1).nullable().default(null),
  title: z.string().trim().min(1, 'is required').max(LIMITS.titleMax),
  description: z.string().trim().max(LIMITS.descriptionMax).default(''),
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(LIMITS.tagMax))
    .max(LIMITS.tagsMax)
    .default([])
    .transform((tags) => [...new Set(tags)]),
  status: z.enum(['published', 'draft']).default('published'),
  access: z
    .object({
      emails: z.array(EMAIL).default([]),
      groups: z.array(z.string().trim().min(1)).default([]),
      external: z
        .array(z.object({ email: EMAIL, expires: DATE.nullable().optional() }))
        .default([]),
    })
    .default({ emails: [], groups: [], external: [] }),
});

export type ReportJson = z.infer<typeof ReportJsonSchema>;

/** End of the given local day — external access expires after that day. */
export function expiryDateToDate(date: string): Date {
  return new Date(`${date}T23:59:59`);
}

// Returns a parsed report.json or throws one readable error listing every
// problem as "path: message" — the CLI/MCP print it as-is.
export function parseReportJson(text: string): ReportJson {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new Error(`report.json is not valid JSON: ${(error as Error).message}`, { cause: error });
  }
  const result = ReportJsonSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new Error(`report.json is invalid — ${problems.join('; ')}`);
  }
  return result.data;
}
