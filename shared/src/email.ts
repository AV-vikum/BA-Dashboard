// Email/domain normalization and validation. All emails must pass through
// normalizeEmail() before storing or comparing (see conventions.md §5).

export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(s: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(s));
}

export function domainOf(email: string): string {
  const normalized = normalizeEmail(email);
  return normalized.slice(normalized.lastIndexOf('@') + 1);
}

export function normalizeDomain(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, '');
}

const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function isValidDomain(s: string): boolean {
  return DOMAIN_PATTERN.test(normalizeDomain(s));
}

// Exact match only: a sub-domain (a@mail.example.com) is NOT internal for
// allowedDomains = ['example.com']. Sub-domain matching would let anyone who
// controls DNS for a sub-domain of an allowed domain gain access.
export function isInternalEmail(email: string, allowedDomains: string[]): boolean {
  const domain = domainOf(email);
  return allowedDomains.some((allowed) => normalizeDomain(allowed) === domain);
}

export interface ParsedEmailList {
  emails: string[]; // normalized, de-duplicated, in first-seen order
  invalid: string[]; // original (untrimmed) entries that failed validation
}

// Accepts comma- and/or newline-separated input (how people paste lists
// from spreadsheets or email clients).
export function parseEmailList(input: string): ParsedEmailList {
  const rawEntries = input
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const emails: string[] = [];
  const seen = new Set<string>();
  const invalid: string[] = [];

  for (const raw of rawEntries) {
    const normalized = normalizeEmail(raw);
    if (!isValidEmail(normalized)) {
      invalid.push(raw);
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      emails.push(normalized);
    }
  }

  return { emails, invalid };
}
