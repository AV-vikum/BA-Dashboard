# Report design rules

The base template already handles colours, spacing, fonts, dark mode and chart styling.
These rules are about **what to show and how to word it**.

## Layout (top to bottom)

1. **Header** — `Report.header()`: title, subtitle (scope + period), "Data as of".
2. **KPI row** — 3–6 stat tiles: the headline numbers, each with a delta vs a named period.
3. **Main trend** — one full-width chart (`r-card r-span-2`): the key measure over time.
4. **Breakdowns** — 2-column cards: the key measure by the 1–2 most useful dimensions.
5. **Detail table(s)** — full width, searchable, sorted by the key measure, with totals.
6. **Footer** — source (`meta.source`) and any caveats.

Keep it to what answers the user's questions — fewer, clearer cards beat many.

## Choosing the form

| The reader must…                  | Use                                                                    |
| --------------------------------- | ---------------------------------------------------------------------- |
| See one current number            | A **KPI tile**, not a chart                                            |
| See a trend over time             | **Line** (area wash for a single series)                               |
| Compare categories                | **Horizontal bar**, sorted largest first, one colour                   |
| See a few series over time        | Multi-line or grouped bars, ≤ 4 series, each named                     |
| See part-to-whole                 | **Stacked bar**, or a sorted bar with a share % column                 |
| Look up exact values / many items | **Table**                                                              |
| Focus on one item among many      | Highlight it in the first palette colour; others in the grey `#b5b3ab` |

Rules:

- **Never use two y-axes.** Two measures with different units → two charts side by side.
- **No 3D, no pie/donut for close values.** A donut is acceptable only for ≤ 5 clearly different
  parts; a sorted bar is almost always clearer.
- **Colours follow the entity, not its rank** — if "Western" is blue in one chart, keep it blue
  (pass colours per data item when the same categories appear in several charts in a different order).
- More than 8 series → fold the rest into "Other" or use a table. Never invent new colours.
- Don't put a number on every point; the tooltip and Table button carry exact values. Label only
  what the story is about (e.g. the latest value).
- Red/green only for good/bad deltas (the KPI tiles do this); never as series colours for
  "good" and "bad" categories without a label.

## Words

- **Titles as statements** where the data supports one: "Revenue up 12% vs last quarter",
  "Western region drives 35% of sales" — computed in the report script from `Report.data`,
  never typed as a fixed number.
- Every chart card has an `r-note`: period and unit/currency ("Jul – Sep 2026, LKR").
- Sentence case everywhere. Plain words; spell out abbreviations once.
- Caveats (missing data, estimates, definition changes) go in the card note or footer.

## Numbers

- KPI tiles: compact (`LKR 5.5M`); tables: full (`LKR 5,535,665`).
- Percentages: 1 decimal (`12.3%`), 0 decimals in headline titles (`12%`).
- Dates: `Sep 2026` for months, `Sep 30, 2026` for days; set `meta.locale` / `meta.currency`
  for the organization (e.g. `en-LK` / `LKR`).
- Deltas compare like with like (same length period); say which period in `deltaLabel`.

## Before publishing — look at it

`preview_report`, then check: nothing overlaps or is cut off, the narrow (phone) layout stacks
cleanly, dark mode is readable, the Table button shows sensible values.
