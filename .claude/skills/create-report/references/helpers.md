# `Report.*` helper API

Defined in `templates/report-base/base.js` and inlined into every report at build time
(keep this file in sync with it). Available in `report.html` after `<!-- @include base.js -->`.

## Page skeleton

```html
<head>
  …
  <!-- @include base.css -->
  <script src="https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js"></script>
</head>
<body>
  <main class="r-page">
    <header class="r-header"></header>
    <section class="r-kpis" id="kpis"></section>
    <section class="r-grid">
      <div class="r-card r-span-2">
        <h2>Revenue up 12% vs last quarter</h2>
        <p class="r-note">Monthly, LKR</p>
        <div class="r-chart" id="chart-trend"></div>
      </div>
      <div class="r-card">…</div>
      <div class="r-card">…</div>
    </section>
    <footer class="r-footer"></footer>
  </main>
  <!-- @data -->
  <!-- @include base.js -->
  <script>
    var d = Report.data; /* … calls below … */
  </script>
</body>
```

Layout classes: `r-page`, `r-header`, `r-kpis`, `r-grid` (2 columns ≥ 900px), `r-card`,
`r-span-2` (full width in the grid), `r-chart` (320px) / `r-chart r-chart--tall` (420px),
`r-note` (muted line under a card title), `r-footer`.
Markers: `<!-- @include base.css -->`, `<!-- @include base.js -->`, `<!-- @data -->` (required).

## Data

| Name          | What                                                                               |
| ------------- | ---------------------------------------------------------------------------------- |
| `Report.data` | The parsed `data.json`                                                             |
| `Report.meta` | `data.meta`: `title, subtitle, asOf, currency, locale, source` (+ your own fields) |

## Formatting — `Report.fmt`

| Call                                               | Example output                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `Report.fmt.number(1234567)`                       | `1,234,567`                                                                      |
| `Report.fmt.number(1234567, { compact: true })`    | `1.2M`                                                                           |
| `Report.fmt.number(3.14159, { decimals: 2 })`      | `3.14`                                                                           |
| `Report.fmt.currency(1234567)`                     | `LKR 1,234,567` (meta.currency)                                                  |
| `Report.fmt.currency(1234567, { compact: true })`  | `LKR 1.2M`                                                                       |
| `Report.fmt.percent(0.123)`                        | `12.3%` (input is a fraction)                                                    |
| `Report.fmt.date('2026-09-30')`                    | `Sep 30, 2026`                                                                   |
| `Report.fmt.date('2026-09')`                       | `Sep 2026`                                                                       |
| `Report.fmt.date('2026-09-30', { style: 'long' })` | `September 30, 2026`                                                             |
| `Report.format(value, kind, opts)`                 | by name: `'number' \| 'currency' \| 'percent' \| 'date' \| 'text'` or a function |

## `Report.header(el?)`

Fills `.r-header` with `meta.title`, `meta.subtitle`, "Data as of `meta.asOf`", sets the page
title, and writes "Source: `meta.source`" into an empty `.r-footer`. Call it first.

## `Report.kpis(el, items)`

```js
Report.kpis('kpis', [
  { label: 'Revenue', value: 5535665, format: 'currency', delta: 0.06, deltaLabel: 'vs Q2' },
  { label: 'Returns', value: 0.031, format: 'percent', delta: 0.2, invert: true },
]);
```

| Field        | Meaning                                                                |
| ------------ | ---------------------------------------------------------------------- |
| `label`      | Sentence case, no colon                                                |
| `value`      | Number                                                                 |
| `format`     | `'number'` (default), `'currency'`, `'percent'` (fraction)             |
| `compact`    | Default `true` for number/currency (`1.2M`; full value in the tooltip) |
| `decimals`   | Optional                                                               |
| `delta`      | Fraction vs the previous period (`0.12` = +12%); omit if none          |
| `deltaLabel` | e.g. `'vs last month'`                                                 |
| `invert`     | `true` when lower is better (costs, returns) — flips green/red         |

KPI items can come straight from `data.json` (`Report.kpis('kpis', d.kpis)`).

## `Report.chart(el, echartsOption, opts?)`

Renders an [ECharts](https://echarts.apache.org/en/option.html) option with the report theme
underneath it: palette in fixed order, light/dark colours, thin marks (bars ≤ 24px with 4px
rounded ends, 2px lines, 10% area wash), hairline grid, legend only for 2+ named series,
hover tooltip, responsive resize, and a **Table** button that shows the chart's values.

```js
Report.chart(
  'chart-trend',
  {
    xAxis: { type: 'category', data: d.series.monthly.labels }, // "2026-01" → "Jan 2026"
    yAxis: { type: 'value' },
    series: [{ type: 'line', name: 'Revenue', data: d.series.monthly.values, areaStyle: {} }],
  },
  { format: 'currency', categoryLabel: 'Month' },
);

// Horizontal bars, largest at the top: reverse both arrays (ECharts draws bottom-up).
Report.chart(
  'chart-region',
  {
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: labels.slice().reverse() },
    series: [{ type: 'bar', name: 'Revenue', data: values.slice().reverse() }],
  },
  { format: 'currency', categoryLabel: 'Region' },
);

// Two or more series: give each a name (legend appears automatically); stack with `stack: 'total'`.
```

| `opts` field    | Meaning                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `format`        | `'number' \| 'currency' \| 'percent'` for value-axis labels and tooltips |
| `categoryLabel` | Header of the first column in the Table view (e.g. `'Month'`)            |
| `table`         | `false` to hide the Table button, or `{ columns, rows }` to supply one   |

Anything you put in the option overrides the defaults. Returns the ECharts instance (or `null`
with a message in the card if the chart library couldn't load).

## `Report.table(el, config)`

```js
Report.table('table-products', {
  caption: 'Top 10 products by revenue',
  columns: [
    { key: 'product', label: 'Product' },
    { key: 'units', label: 'Units', format: 'number' },
    { key: 'revenue', label: 'Revenue', format: 'currency' },
    { key: 'share', label: 'Share of revenue', format: 'percent' },
  ],
  rows: d.tables.topProducts,
  sort: { key: 'revenue', dir: 'desc' },
  search: true,
  pageSize: 25,
  totals: ['units', 'revenue', 'share'],
});
```

| Field      | Meaning                                                                                 |
| ---------- | --------------------------------------------------------------------------------------- |
| `columns`  | `{ key, label, format, align: 'left' \| 'right', width }` — numeric formats align right |
| `rows`     | Array of objects                                                                        |
| `sort`     | Initial sort; headers are clickable                                                     |
| `search`   | Adds a "Filter rows…" box                                                               |
| `pageSize` | Paginate when there are more rows                                                       |
| `totals`   | Keys to sum in a footer row (sums the filtered rows)                                    |
| `caption`  | Screen-reader caption                                                                   |

All text is escaped — data can't inject HTML.

## Other

| Call                       | What                                                          |
| -------------------------- | ------------------------------------------------------------- |
| `Report.colors()`          | Current palette (8 hex colours, theme-aware), fixed order     |
| `Report.isDark()`          | Current theme                                                 |
| `Report.onThemeChange(cb)` | `cb(isDark)` after theme changes (charts re-theme themselves) |

## Not available (sandboxed viewer)

`fetch` / `XMLHttpRequest` (all data must be in `data.json`), `localStorage` / cookies,
scripts or styles from hosts other than `cdn.jsdelivr.net` / `cdnjs.cloudflare.com`, relative
files. `build_report` warns about each of these.
