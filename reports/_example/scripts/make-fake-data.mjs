// Generates data/sales.csv — FAKE sales data for the example report.
// Deterministic (seeded PRNG), so re-running produces the same file.
// Run: node reports/_example/scripts/make-fake-data.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(here, '..', 'data', 'sales.csv');

// mulberry32 — tiny seeded PRNG
function prng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = prng(20260923);
const pick = (items, weights) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items.at(-1);
};

const regions = ['Western', 'Central', 'Southern', 'Northern'];
const regionWeights = [45, 22, 20, 13];

// [product, category, unit price in LKR]
const products = [
  ['Smartphone X2', 'Electronics', 89000],
  ['Wireless Earbuds', 'Electronics', 14500],
  ['Laptop Pro 14', 'Electronics', 245000],
  ['Smart Watch', 'Electronics', 38000],
  ['Rice Cooker', 'Home & Kitchen', 12500],
  ['Blender 600W', 'Home & Kitchen', 9800],
  ['Ceiling Fan', 'Home & Kitchen', 16800],
  ['Water Filter', 'Home & Kitchen', 22000],
  ['Basmati Rice 5kg', 'Grocery', 3200],
  ['Ceylon Tea 400g', 'Grocery', 1450],
  ['Coconut Oil 1L', 'Grocery', 1100],
  ['Cotton Saree', 'Apparel', 7800],
  ['Men’s Batik Shirt', 'Apparel', 4500],
  ['School Shoes', 'Apparel', 5200],
  ['Kids’ Backpack', 'Apparel', 3900],
];
const productWeights = [8, 12, 3, 6, 9, 8, 6, 5, 16, 18, 14, 7, 9, 6, 7];

// 12 months ending September 2026; orders grow over time with a December peak.
const months = [];
for (let i = 0; i < 12; i++) {
  const d = new Date(2025, 9 + i, 1);
  months.push({ year: d.getFullYear(), month: d.getMonth() });
}
const seasonal = [1.0, 1.05, 1.35, 0.85, 0.9, 1.0, 1.1, 0.95, 1.0, 1.05, 1.1, 1.15];

const rows = [];
months.forEach(({ year, month }, i) => {
  const orders = Math.round((38 + i * 1.6) * seasonal[i]);
  const days = new Date(year, month + 1, 0).getDate();
  for (let n = 0; n < orders; n++) {
    const [product, category, price] = pick(products, productWeights);
    const units =
      category === 'Grocery' ? 1 + Math.floor(random() * 6) : 1 + Math.floor(random() * 2);
    const discount = random() < 0.2 ? 0.9 : 1;
    const day = 1 + Math.floor(random() * days);
    rows.push({
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      order_id: `ORD-${String(rows.length + 1).padStart(5, '0')}`,
      region: pick(regions, regionWeights),
      product,
      category,
      units,
      revenue: Math.round(price * units * discount),
    });
  }
});
rows.sort((a, b) => a.date.localeCompare(b.date) || a.order_id.localeCompare(b.order_id));

const header = Object.keys(rows[0]);
const csvCell = (v) =>
  /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
const csv = [header.join(','), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(','))].join(
  '\n',
);

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, `${csv}\n`);
console.log(`✓ wrote ${rows.length} fake orders to data/sales.csv`);
