# Phase 5 — Report authoring toolkit

## Context

A standard way to build reports so they look consistent and Claude writes as little as possible:

- a **base template** (CSS + a `window.Report` helper API) that is inlined at build time,
- a **report folder format** (`report.json`, `report.html`, `data.json`, `build-data.mjs`),
- a **build** step producing one self-contained HTML file,
- CLI commands `new`, `build`, `preview`.

Reference: [A8 report rendering](architecture.md#a8-report-rendering), [A7 ownership rules](architecture.md#who-owns-what-report-folder-vs-web-ui).

---

## 5.1 `report.json` schema

**Do:** `shared/src/report-json.ts` (zod) + tests:

```jsonc
{
  "reportIds": {}, // filled by publish, one id per Firebase project — do not edit
  "title": "Sales Overview Q3 2026", // 1–120
  "description": "Revenue, orders and top products for Q3.", // 0–500
  "tags": ["sales", "quarterly"], // lower-case, max 10
  "status": "published", // "published" | "draft" — used on publish
  "access": {
    // applied ONLY on first publish (see A7)
    "emails": ["alice@example.com"],
    "groups": ["Finance"], // group NAMES (resolved to ids by the CLI)
    "external": [{ "email": "partner@outside.test", "expires": "2026-12-31" }], // expires optional
  },
}
```

Export `ReportJsonSchema`, `type ReportJson`, and `parseReportJson(text)` with friendly error messages (path + problem).

**Acceptance:** tests for a valid file, missing title, bad email, bad date, upper-case tags (normalized).

---

## 5.2 Base styles — `templates/report-base/base.css`

**Do:** plain CSS (no build tools), designed for dashboards:

1. Design tokens as CSS variables on `:root` (light) and `[data-theme="dark"]` + `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`: background, surface, border, text, muted text, accent, positive, negative, and an 8-colour categorical chart palette (colour-blind friendly, readable in both themes).
2. System font stack; tabular numbers (`font-variant-numeric: tabular-nums`) for KPIs and tables.
3. Layout classes: `.r-page` (max-width 1400px, 16px side padding on mobile), `.r-header` (title, subtitle, "Data as of"), `.r-kpis` (auto-fit grid, min 180px), `.r-kpi` (label, value, delta with ▲/▼ colour), `.r-grid` (1 column mobile, 2 columns ≥ 900px; `.r-span-2` for full width), `.r-card` (surface, border, radius, padding, `h2` title + optional `.r-note`), `.r-chart` (height 320px default; `.r-chart--tall` 420px), `.r-table` styles (sticky header, zebra rows, right-aligned numeric columns, horizontal scroll wrapper on mobile), `.r-footer` (source notes).
4. Print styles: white background, avoid breaking cards across pages.

**Acceptance:** a scratch HTML page using every class looks right at 375px and 1400px in both themes (open in a browser; delete the scratch page).

> Note (2026-09-24): palette and chart chrome use the validated reference palette from the dataviz guidance (colour-blind-safe order, separate dark-mode steps). Checked with headless Chrome screenshots of the starter and `_example` reports in light/dark at 1280px and inside a 375px iframe (headless Chrome cannot shrink its window below ~500px, so a plain 375px screenshot is misleading).

---

## 5.3 Helper API — `templates/report-base/base.js`

**Do:** plain browser JavaScript (no modules, no build), exposing `window.Report`. Must work inside the sandboxed iframe (no `localStorage`, no `fetch` of local files). JSDoc every function — this file doubles as the reference Claude reads (step 8.3).

```js
Report.data            // parsed JSON from <script type="application/json" id="report-data">
Report.meta            // Report.data.meta: { title, subtitle, asOf, currency, locale, source }

Report.fmt.number(v, { decimals, compact })   // 1,234,567 or 1.2M
Report.fmt.currency(v, { currency, compact }) // uses meta.currency/locale by default, e.g. "LKR 1.2M"
Report.fmt.percent(v, { decimals })           // 0.123 → "12.3%"
Report.fmt.date(v, { style: 'short'|'long'|'month' })

Report.header(el?)     // fills .r-header from meta (title, subtitle, "Data as of …")
Report.kpis(el, [{ label, value, format: 'number'|'currency'|'percent', delta, deltaLabel, invert }])
                       // delta: fraction vs previous period; invert = lower is better
Report.chart(el, echartsOption)   // applies palette + theme + responsive resize; returns the instance
Report.table(el, {
  columns: [{ key, label, format, align, width }],
  rows,
  sort: { key, dir },   // initial sort; headers clickable to sort
  search: true,         // adds a filter box above the table
  pageSize: 25,         // pagination when rows > pageSize
  totals: ['revenue']   // optional totals row for these keys
})
Report.onThemeChange(cb)          // re-render charts on theme change
```

Rules:

- `el` accepts an element or an id string.
- Charts: read colours from the CSS variables; set `backgroundColor: 'transparent'`, sensible grid/tooltip/legend defaults; observe container size with `ResizeObserver`.
- Theme source: `<html data-theme>` (set by the app) else `prefers-color-scheme`.
- Tables escape all text (no `innerHTML` with data).
- If ECharts failed to load, render a readable message in the chart box instead of throwing.

**Acceptance:** a scratch page with fake data exercises every function in both themes; console has no errors.

> Note (2026-09-24): added beyond the plan — every `Report.chart` gets an automatic **Table** toggle (accessible table view derived from the chart option; `categoryLabel` / `table` options override it); category labels shaped like `YYYY-MM` / `YYYY-MM-DD` are shown as dates; bar/line/pie marks follow the thin-mark spec (24px max bar, 4px rounded ends, 2px lines, 10% area wash); a legend only appears for 2+ series. Also exposed `Report.format`, `Report.colors()`, `Report.isDark()`.

---

## 5.4 Starter files — `templates/report-base/starter/`

**Do:**

1. `report.html`:
   ```html
   <!doctype html>
   <html lang="en">
     <head>
       <meta charset="utf-8" />
       <meta name="viewport" content="width=device-width, initial-scale=1" />
       <title>Report</title>
       <!-- @include base.css -->
       <script src="https://cdn.jsdelivr.net/npm/echarts@<PINNED_VERSION>/dist/echarts.min.js"></script>
     </head>
     <body>
       <main class="r-page">
         <header class="r-header"></header>
         <section class="r-kpis" id="kpis"></section>
         <section class="r-grid">
           <div class="r-card">
             <h2>Trend</h2>
             <div class="r-chart" id="chart-trend"></div>
           </div>
           <div class="r-card">
             <h2>Breakdown</h2>
             <div class="r-chart" id="chart-breakdown"></div>
           </div>
           <div class="r-card r-span-2">
             <h2>Details</h2>
             <div id="table-details"></div>
           </div>
         </section>
         <footer class="r-footer"></footer>
       </main>
       <!-- @data -->
       <!-- @include base.js -->
       <script>
         // Report-specific code: only uses Report.* helpers and Report.data
         Report.header();
         // Report.kpis('kpis', [...]); Report.chart('chart-trend', {...}); Report.table('table-details', {...});
       </script>
     </body>
   </html>
   ```
   Pin ECharts to the **current latest exact version** (look it up; record it in the Decision log).
2. `data.json`: `{ "meta": { "title": "…", "subtitle": "", "asOf": "2026-01-01", "currency": "USD", "locale": "en-US", "source": "" } }` plus example series.
3. `report.json`: template from 5.1 with empty access.
4. `build-data.mjs`: Node script that reads `data/*.csv` (via `csv-parse/sync`) or `data/*.xlsx` (via `exceljs`), aggregates, and writes `data.json`. Starter shows a small example with comments: _"Aggregate here. Never paste raw rows into data.json — keep it small."_ Install `csv-parse exceljs` in `@ba/tools` (hoisted, so report folders can import them).
5. `data/.gitkeep`.

**Acceptance:** files exist; `node templates/report-base/starter/build-data.mjs` runs with no data files (prints "no data files found, keeping data.json").

> Note (2026-09-24): `csv-parse` and `exceljs` are **root** devDependencies (not `@ba/tools`), so `reports/<slug>/build-data.mjs` always resolves the current versions — installed under tools, npm hoisted an older copy from firebase-tools instead. Same issue made npm pick commander 5 / open 6 for tools; they are now pinned to the current majors.

---

## 5.5 Build, validate, and CLI commands `new` / `build` / `preview`

**Do:**

1. Install in tools: `commander open`. Turn `tools/src/cli.ts` into a commander program `report` with a global header line `[target: …]` (from `targetLabel()`), printed only by commands that touch Firestore.
2. `tools/src/core/build.ts` → `buildReport(slug)`:
   1. Read + validate `report.json` (5.1) and `data.json` (valid JSON, has `meta`).
   2. Read `report.html`; replace `<!-- @include base.css -->` with `<style>…</style>` and `<!-- @include base.js -->` with `<script>…</script>` from `templates/report-base/`.
   3. Replace `<!-- @data -->` with `<script type="application/json" id="report-data">…</script>`, JSON-serialized with `<` escaped as `<` (prevents `</script>` injection).
   4. Set `<title>` to `report.json` title.
   5. Validate → **errors**: missing `@data` marker, output > `REPORT_MAX_BYTES`; **warnings**: `<script src>` / `<link href>` hosts other than `cdn.jsdelivr.net` and `cdnjs.cloudflare.com`, use of `fetch(`, `XMLHttpRequest`, `localStorage`, `document.cookie`, large base64 images (> 100 KB).
   6. Write `reports/<slug>/dist/report.html`; return `{ outPath, bytes, warnings }`.
3. Commands:
   - `report new <slug> --title "…"` → copies `starter/` to `reports/<slug>/`, sets title in `report.json` and `data.json.meta.title`; refuses if the folder exists.
   - `report build <slug>` → prints `✓ Built <slug> (212 KB) → reports/<slug>/dist/report.html` + warnings as `! …`.
   - `report preview <slug>` → build, then open the file in the default browser (`open`).
4. Unit tests for `buildReport` using a temp folder: markers replaced, data escaping (`</script>` inside a string), size error, warnings.

**Acceptance:** `npm run report -- new test-report --title "Test"` → `npm run report -- preview test-report` opens a working page; delete `reports/test-report`; tests pass.

> Note (2026-09-24): `report build` / `preview` accept `--data` to run `build-data.mjs` first (the MCP `build_report` always does). Generated `reports/**/data.json` files are in `.prettierignore`.

---

## 5.6 Example report — `reports/_example/`

**Do:**

1. `npm run report -- new _example --title "Example Sales Dashboard"` (allow `_example` in slug validation — already in 1.3).
2. `reports/_example/scripts/make-fake-data.mjs`: generates `data/sales.csv` deterministically (seeded PRNG): ~600 rows, columns `date, region, product, category, units, revenue`, 12 months, 4 regions, 15 products, currency LKR, locale `en-LK`. Commit the script **and** the CSV (fake data only).
3. `build-data.mjs`: aggregate to: KPI totals (revenue, units, orders, avg order value) with deltas vs previous period; monthly revenue series; revenue by region; revenue by category; top 10 products table.
4. `report.html`: header, 4 KPIs, line chart (monthly revenue), bar chart (by region), donut (by category), top-products table with search + totals.
5. `report.json`: tags `["example","sales"]`, access `groups: ["Finance"]`.

**Acceptance:** `node reports/_example/build-data.mjs && npm run report -- preview _example` shows a polished dashboard in both themes at 375px and desktop; built size well under the limit.

> Note (2026-09-24): "revenue by category" uses a sorted horizontal bar instead of a donut (dataviz guidance: bars compare categories more accurately; donuts only for ≤ 6 parts at a glance). KPIs compare the latest 3 months with the 3 before. ECharts pinned to 6.1.0.

---

## 5.7 Seed uses the example report

**Do:** update `seed.ts` so `demo-sales` uses the **built** `_example` HTML (build it inside the seed via `buildReport('_example')`). Then re-run the CSP check from step 3.9 with this real ECharts report — `npm run preview:hosting` (see step 3.9's note: this runs `vite preview`, not the Hosting emulator, since the emulator doesn't apply `firebase.json`'s headers) — and record the result.

**Acceptance:** after `npm run seed`, Alice opens _Sales Overview_ in the app and sees the full example dashboard; `npm run preview:hosting` shows it with no CSP errors.

> Note (2026-09-24): CSP verified by serving the built example inside a sandboxed `srcdoc` iframe with the exact `Content-Security-Policy` header from `firebase.json` and loading it in headless Chrome: the dashboard renders fully (ECharts from cdn.jsdelivr.net) and Chrome logs no CSP violations. The full app sign-in flow was not automated (Google popup) — do one manual pass with `npm run dev` as Alice. Seed also sets `METADATA_SERVER_DETECTION=none` in emulator mode (removes a slow metadata-probe warning from firebase-admin).
