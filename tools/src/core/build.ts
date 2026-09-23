// Turns a report folder into one self-contained HTML file:
// report.html + base template (inlined) + data.json (inlined) → dist/report.html.
// See docs/plan/phase-5-report-toolkit.md#55.
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { parseReportJson, REPORT_MAX_BYTES, type ReportJson } from '@ba/shared';
import { REPO_ROOT } from './paths.js';

export const TEMPLATE_DIR = path.join(REPO_ROOT, 'templates', 'report-base');

const MARKERS = {
  css: '<!-- @include base.css -->',
  js: '<!-- @include base.js -->',
  data: '<!-- @data -->',
};

const ALLOWED_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com'];
const RISKY_APIS: [RegExp, string][] = [
  [/\bfetch\s*\(/, 'fetch() — data must be inlined via data.json; network calls may be blocked'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest — data must be inlined via data.json'],
  [
    /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/,
    'browser storage — not available in the sandboxed viewer',
  ],
  [/\bdocument\.cookie\b/, 'document.cookie — not available in the sandboxed viewer'],
];
const BASE64_IMAGE_WARN_BYTES = 100_000;

export interface BuildResult {
  outPath: string;
  bytes: number;
  warnings: string[];
  reportJson: ReportJson;
  html: string;
}

function readText(file: string, label: string): string {
  if (!existsSync(file)) throw new Error(`${label} not found: ${file}`);
  return readFileSync(file, 'utf8');
}

export function readReportJson(folder: string): ReportJson {
  return parseReportJson(readText(path.join(folder, 'report.json'), 'report.json'));
}

// Inside <script type="application/json"> the only dangerous sequence is "</script";
// escaping every "<" also covers "<!--". JSON.parse turns the escape back into "<".
export function serializeData(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// split/join instead of replace() so "$&" etc. in the inserted content stays literal.
function replaceMarker(html: string, marker: string, content: string): string {
  return html.split(marker).join(content);
}

function collectWarnings(source: string, built: string): string[] {
  const warnings: string[] = [];

  const refPattern = /<(script|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  for (const match of source.matchAll(refPattern)) {
    const ref = match[2] ?? '';
    if (/^(https?:)?\/\//i.test(ref)) {
      const host = new URL(ref.startsWith('//') ? `https:${ref}` : ref).host;
      if (!ALLOWED_HOSTS.includes(host)) {
        warnings.push(
          `external ${match[1]} from ${host} — only ${ALLOWED_HOSTS.join(', ')} are allowed by the app's CSP`,
        );
      }
    } else if (!ref.startsWith('data:')) {
      warnings.push(
        `relative ${match[1]} "${ref}" won't exist in the published report — inline it instead`,
      );
    }
  }

  // Check only the report's own code, not the inlined helpers.
  for (const [pattern, message] of RISKY_APIS) {
    if (pattern.test(source)) warnings.push(`uses ${message}`);
  }

  for (const match of built.matchAll(/data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)/gi)) {
    const bytes = Math.round(((match[1] ?? '').length * 3) / 4);
    if (bytes > BASE64_IMAGE_WARN_BYTES) {
      warnings.push(`embedded image of ${Math.round(bytes / 1024)} KB — use a smaller image`);
    }
  }
  if (!source.includes(MARKERS.css) || !source.includes(MARKERS.js)) {
    warnings.push(
      'does not include base.css and base.js — the report will not use the standard look or Report.* helpers',
    );
  }
  return warnings;
}

// Catches broken aggregation before it reaches readers: text like "undefined"/"NaN"
// (a missing key or a failed number parse) and KPIs without a value.
export function dataWarnings(data: unknown): string[] {
  const warnings: string[] = [];
  const visit = (value: unknown, at: string) => {
    if (warnings.length >= 5) return;
    if (typeof value === 'string' && /\b(undefined|NaN)\b/.test(value)) {
      warnings.push(
        `data.json ${at} contains "${value.match(/undefined|NaN/)![0]}": ${value.slice(0, 80)}`,
      );
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => visit(v, `${at}[${i}]`));
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) visit(v, at ? `${at}.${k}` : k);
    }
  };
  visit(data, '');
  const kpis = (data as { kpis?: unknown }).kpis;
  if (Array.isArray(kpis)) {
    kpis.forEach((kpi: { label?: string; value?: unknown }, i) => {
      if (typeof kpi?.value !== 'number') {
        warnings.push(`data.json kpis[${i}] (${kpi?.label ?? 'no label'}) has no numeric value`);
      }
    });
  }
  return warnings;
}

/** Builds reports/<slug>/ (given as an absolute folder) into dist/report.html. */
export function buildReportFolder(folder: string): BuildResult {
  const reportJson = readReportJson(folder);

  const dataText = readText(path.join(folder, 'data.json'), 'data.json');
  let data: unknown;
  try {
    data = JSON.parse(dataText);
  } catch (error) {
    throw new Error(`data.json is not valid JSON: ${(error as Error).message}`, { cause: error });
  }
  if (typeof data !== 'object' || data === null || !('meta' in data)) {
    throw new Error('data.json must be an object with a "meta" section');
  }

  const source = readText(path.join(folder, 'report.html'), 'report.html');
  if (!source.includes(MARKERS.data)) {
    throw new Error(
      `report.html is missing the ${MARKERS.data} marker (where data.json is inserted)`,
    );
  }

  let html = source;
  html = replaceMarker(
    html,
    MARKERS.css,
    `<style>\n${readText(path.join(TEMPLATE_DIR, 'base.css'), 'base.css')}</style>`,
  );
  html = replaceMarker(
    html,
    MARKERS.js,
    `<script>\n${readText(path.join(TEMPLATE_DIR, 'base.js'), 'base.js')}</script>`,
  );
  html = replaceMarker(
    html,
    MARKERS.data,
    `<script type="application/json" id="report-data">${serializeData(data)}</script>`,
  );
  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    () => `<title>${escapeHtml(reportJson.title)}</title>`,
  );

  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > REPORT_MAX_BYTES) {
    throw new Error(
      `built report is ${Math.round(bytes / 1024)} KB — over the ${Math.round(REPORT_MAX_BYTES / 1024)} KB limit. ` +
        'Aggregate more in build-data.mjs or remove embedded images.',
    );
  }

  const outDir = path.join(folder, 'dist');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'report.html');
  writeFileSync(outPath, html);

  const warnings = [...dataWarnings(data), ...collectWarnings(source, html)];
  return { outPath, bytes, warnings, reportJson, html };
}

const execFileAsync = promisify(execFile);

/**
 * Runs the folder's build-data.mjs (if any) with the current Node binary —
 * never through a shell. Returns its output, or null when there is no script.
 */
export async function runBuildData(folder: string): Promise<string | null> {
  const script = path.join(folder, 'build-data.mjs');
  if (!existsSync(script)) return null;
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [script], {
      cwd: folder,
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    });
    return `${stdout}${stderr}`.trim();
  } catch (error) {
    const e = error as { stderr?: string; stdout?: string; message: string };
    // Lead with the thrown error's own line ("Error: …"), not the tail of the stack trace.
    const lines = (e.stderr || e.stdout || e.message).trim().split('\n');
    const errorLine = lines.find((line) => /^\s*\w*Error\b/.test(line));
    const detail = errorLine ? errorLine.trim() : lines.slice(-5).join('\n');
    throw new Error(`build-data.mjs failed:\n${detail}`, { cause: error });
  }
}
