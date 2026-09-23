// Turns the source files in data/ into data.json (aggregated numbers only).
// Run: node build-data.mjs   (build_report / `npm run report -- build` runs it for you)
//
// Aggregate here. Never paste raw rows into data.json — keep it small (< 200 KB).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, 'data');
const outFile = path.join(here, 'data.json');

const files = existsSync(dataDir)
  ? readdirSync(dataDir).filter((f) => /\.(csv|xlsx)$/i.test(f))
  : [];

if (files.length === 0) {
  console.log('no data files found, keeping data.json');
  process.exit(0);
}

/** Reads a CSV into objects keyed by the (trimmed) header row. */
function readCsv(file) {
  return parse(readFileSync(path.join(dataDir, file)), {
    columns: (header) => header.map((h) => h.trim()),
    skip_empty_lines: true,
    trim: true,
  });
}

/** Reads the first worksheet of an .xlsx into objects keyed by the header row. */
async function readXlsx(file) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(dataDir, file));
  const sheet = workbook.worksheets[0];
  const headers = [];
  const rows = [];
  sheet.eachRow((row, index) => {
    const values = row.values
      .slice(1)
      .map((v) => (v && typeof v === 'object' && 'result' in v ? v.result : v));
    if (index === 1) headers.push(...values.map((h) => String(h ?? '').trim()));
    else rows.push(Object.fromEntries(headers.map((h, i) => [h, values[i] ?? null])));
  });
  return rows;
}

const file = files[0];
const rows = file.toLowerCase().endsWith('.csv') ? readCsv(file) : await readXlsx(file);

// Example aggregation — replace with the report's real logic.
// Expects columns "month" (YYYY-MM) and "value".
const byMonth = new Map();
for (const row of rows) {
  const value = Number(String(row.value ?? '').replace(/,/g, ''));
  if (!row.month || !Number.isFinite(value)) continue;
  byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + value);
}
const months = [...byMonth.keys()].sort();
const values = months.map((m) => byMonth.get(m));
const last = values.at(-1) ?? 0;
const previous = values.at(-2);

const existing = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : {};
const output = {
  meta: { ...existing.meta, asOf: new Date().toISOString().slice(0, 10) },
  kpis: [
    {
      label: 'Latest month',
      value: last,
      format: 'number',
      delta: previous ? (last - previous) / previous : null,
      deltaLabel: 'vs previous month',
    },
  ],
  series: { trend: { labels: months, values } },
  tables: { details: months.map((m, i) => ({ label: m, value: values[i] })) },
};

writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`);
console.log(`✓ data.json written from ${file} (${rows.length} rows → ${months.length} months)`);
