# Working with report data

`build-data.mjs` runs from the report folder with Node (`build_report` runs it; so does
`npm run report -- build <slug> --data`). `csv-parse` and `exceljs` are available.
`reports/_example/build-data.mjs` is a complete worked example.

## 1. Inspect before you aggregate (don't dump the file)

```js
// node -e "…" from the report folder, or a throwaway inspect.mjs — print a summary only
import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
const rows = parse(readFileSync('data/sales.csv'), {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});
console.log(rows.length, 'rows');
console.log(Object.keys(rows[0]));
console.log(rows.slice(0, 5));
```

Excel (first sheet, header row → objects):

```js
import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile('data/sales.xlsx');
const sheet = wb.worksheets[0];
console.log(wb.worksheets.map((s) => `${s.name}: ${s.rowCount} rows`));
console.log(sheet.getRow(1).values.slice(1)); // headers
```

Also check: date range (min/max), distinct values of key dimensions, blanks in numeric columns.

## 2. Clean

- Trim header names; map them to simple keys once (`const month = r['Posting Date'].slice(0, 7)`).
- Numbers: `Number(String(v).replace(/[, ]/g, ''))` — handles `1,234` and `1 234`; treat `''` as missing.
- Dates: normalise to `YYYY-MM-DD` / `YYYY-MM` strings (`Report.fmt.date` and chart labels format them).
  Excel dates arrive as `Date` objects from exceljs.
- Drop rows missing required fields, and **count what you dropped** — print it in the output line.

## 3. Aggregate

```js
const sum = (list, key) => list.reduce((acc, r) => acc + r[key], 0);
function groupSum(list, key, value) {
  const map = new Map();
  for (const r of list) map.set(r[key], (map.get(r[key]) ?? 0) + r[value]);
  return map;
}
// Top N + "Other"
function topN(map, n) {
  const sorted = [...map].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, n);
  const other = sorted.slice(n).reduce((acc, [, v]) => acc + v, 0);
  return other ? [...top, ['Other', other]] : top;
}
// Period over period
const months = [...new Set(rows.map((r) => r.month))].sort();
const current = months.slice(-3),
  previous = months.slice(-6, -3);
const change = (now, before) => (before ? (now - before) / before : null);
```

## 4. `data.json` shape

```json
{
  "meta": {
    "title": "…",
    "subtitle": "…",
    "asOf": "2026-09-30",
    "currency": "LKR",
    "locale": "en-LK",
    "source": "…"
  },
  "kpis": [
    {
      "label": "Revenue",
      "value": 5535665,
      "format": "currency",
      "delta": 0.06,
      "deltaLabel": "vs Apr – Jun 2026"
    }
  ],
  "series": { "monthly": { "labels": ["2026-07", "2026-08"], "values": [1853560, 1560635] } },
  "tables": { "topProducts": [{ "product": "…", "units": 8, "revenue": 1886500, "share": 0.341 }] }
}
```

- Keep it small: aggregated series and top-N tables, not raw rows. Target < 200 KB; the whole
  built report must stay under ~880 KB.
- Keep `meta` fields that the script doesn't compute (read the existing `data.json` and spread
  its `meta`, as the starter does).
- End the script with one summary line, e.g.
  `✓ data.json written from 586 rows (0 dropped) → 12 months, revenue 5,535,665` — that line is
  what `build_report` shows, so make it useful for checking totals.

## 5. Check totals

After building, verify at least one KPI against an independent calculation (e.g. sum the raw
revenue column for the period with a one-off script) and tell the user which check you ran.
