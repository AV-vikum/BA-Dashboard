// data/sales.csv (one row per order) → data.json (aggregated numbers only).
// Current period = the last 3 months in the data; compared with the 3 months before.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const here = path.dirname(fileURLToPath(import.meta.url));
const rows = parse(readFileSync(path.join(here, 'data', 'sales.csv')), {
  columns: (header) => header.map((h) => h.trim()),
  skip_empty_lines: true,
  trim: true,
});

const orders = rows
  .map((r) => ({
    month: r.date.slice(0, 7),
    date: r.date,
    region: r.region,
    product: r.product,
    category: r.category,
    units: Number(r.units),
    revenue: Number(r.revenue),
  }))
  .filter((r) => r.month && Number.isFinite(r.units) && Number.isFinite(r.revenue));
const dropped = rows.length - orders.length;

const sum = (list, key) => list.reduce((acc, r) => acc + r[key], 0);
function groupSum(list, key, value) {
  const map = new Map();
  for (const r of list) map.set(r[key], (map.get(r[key]) ?? 0) + r[value]);
  return map;
}

const months = [...new Set(orders.map((o) => o.month))].sort();
const current = months.slice(-3);
const previous = months.slice(-6, -3);
const inPeriod = (period) => orders.filter((o) => period.includes(o.month));
const cur = inPeriod(current);
const prev = inPeriod(previous);

const totals = (list) => ({
  revenue: sum(list, 'revenue'),
  units: sum(list, 'units'),
  orders: list.length,
  aov: list.length ? sum(list, 'revenue') / list.length : 0,
});
const t = totals(cur);
const p = totals(prev);
const change = (now, before) => (before ? (now - before) / before : null);

const monthName = (m) =>
  new Date(`${m}-01T00:00:00`).toLocaleString('en', { month: 'short', year: 'numeric' });
const periodLabel = `${monthName(current[0])} – ${monthName(current.at(-1))}`;
const deltaLabel = `vs ${monthName(previous[0])} – ${monthName(previous.at(-1))}`;

const monthly = groupSum(orders, 'month', 'revenue');
// Headline as a statement: change from the first to the latest month.
const firstMonth = monthly.get(months[0]);
const lastMonth = monthly.get(months.at(-1));
const trendChange = Math.round((Math.abs(lastMonth - firstMonth) / firstMonth) * 100);
const trendTitle = `Monthly revenue ${lastMonth >= firstMonth ? 'up' : 'down'} ${trendChange}% over ${months.length} months`;
const byRegion = [...groupSum(cur, 'region', 'revenue')].sort((a, b) => b[1] - a[1]);
const byCategory = [...groupSum(cur, 'category', 'revenue')].sort((a, b) => b[1] - a[1]);

const productRevenue = groupSum(cur, 'product', 'revenue');
const productUnits = groupSum(cur, 'product', 'units');
const productCategory = new Map(cur.map((o) => [o.product, o.category]));
const topProducts = [...productRevenue]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([product, revenue]) => ({
    product,
    category: productCategory.get(product),
    units: productUnits.get(product),
    revenue,
    share: revenue / t.revenue,
  }));

const data = {
  meta: {
    title: 'Example Sales Dashboard',
    subtitle: `Fake data for demonstration · ${periodLabel}`,
    asOf: orders
      .map((o) => o.date)
      .sort()
      .at(-1),
    currency: 'LKR',
    locale: 'en-LK',
    source: 'reports/_example/data/sales.csv (generated fake orders)',
    period: periodLabel,
  },
  kpis: [
    {
      label: 'Revenue',
      value: t.revenue,
      format: 'currency',
      delta: change(t.revenue, p.revenue),
      deltaLabel,
    },
    {
      label: 'Orders',
      value: t.orders,
      format: 'number',
      delta: change(t.orders, p.orders),
      deltaLabel,
    },
    {
      label: 'Units sold',
      value: t.units,
      format: 'number',
      delta: change(t.units, p.units),
      deltaLabel,
    },
    {
      label: 'Average order value',
      value: Math.round(t.aov),
      format: 'currency',
      delta: change(t.aov, p.aov),
      deltaLabel,
    },
  ],
  series: {
    monthlyRevenue: { labels: months, values: months.map((m) => monthly.get(m)) },
    revenueByRegion: { labels: byRegion.map(([k]) => k), values: byRegion.map(([, v]) => v) },
    revenueByCategory: { labels: byCategory.map(([k]) => k), values: byCategory.map(([, v]) => v) },
  },
  text: { trendTitle },
  tables: { topProducts },
};

writeFileSync(path.join(here, 'data.json'), `${JSON.stringify(data, null, 2)}\n`);
console.log(
  `✓ data.json written from ${rows.length} rows (${dropped} dropped) → ${months.length} months, ` +
    `current period revenue ${t.revenue.toLocaleString('en')} · "${trendTitle}"`,
);
