# Phase 8 — Claude skill for building reports

## Context

A **skill** is a folder of instructions Claude loads when relevant. It makes every report follow the same workflow, design and quality checks, and keeps token use low. Claude Code loads project skills from `.claude/skills/`. Keep `SKILL.md` short (≈150 lines) and put details in `references/` files that Claude reads only when needed.

Check the current Claude Code skills docs for the exact frontmatter format.

---

## 8.1 Skill structure

**Do:** create

```
.claude/skills/create-report/
├─ SKILL.md
└─ references/
   ├─ helpers.md     window.Report API with examples (from base.js JSDoc)
   ├─ design.md      layout, chart choice, colours, formatting rules
   └─ data.md        build-data.mjs patterns (CSV, Excel, aggregation)
```

`SKILL.md` frontmatter:

```yaml
---
name: create-report
description: Create, update, or refresh a dashboard report (charts, KPIs, tables) in reports/<slug>/ and publish it to the BA-Dashboard app. Use when the user asks to build, change, refresh, publish, or share a report or dashboard.
---
```

**Acceptance:** Claude Code lists the skill.

---

## 8.2 `SKILL.md` — workflow

**Do:** write these sections:

1. **Golden rules**
   - Work only inside `reports/<slug>/`. Never edit `templates/` unless asked.
   - **Never read large raw data into the conversation.** Inspect files with a quick script (column names, row count, 5 sample rows) — then aggregate in `build-data.mjs`.
   - `data.json` holds **aggregated** numbers only (target < 200 KB). No hard-coded numbers in `report.html`.
   - Use `Report.*` helpers; don't write custom chart/table/format code unless a helper can't do it.
   - Make **targeted edits** to existing files; don't rewrite whole files for small changes.
   - Real company data never goes into git (the `reports/` folder is git-ignored — keep it that way).
2. **New report**
   1. Ask (only if unclear): purpose/audience, key questions, data files, who should see it.
   2. `create_report_folder` (MCP) or `npm run report -- new <slug> --title "…"`.
   3. Put source files in `data/` (or read them from where the user points).
   4. Inspect data (row count, columns, sample) with a short script.
   5. Write `build-data.mjs` → run it → check `data.json` size and totals.
   6. Edit `report.html`: header → KPIs → charts → tables, following `references/design.md`.
   7. Fill `report.json` (title, description, tags, access).
   8. `build_report` → fix errors/warnings → `preview_report` → ask the user to check.
   9. `publish_report` → give the user the URL.
3. **Update / refresh**
   - _New data, same design:_ replace files in `data/` → run `build-data.mjs` → `build_report` → `publish_report`. Do **not** touch `report.html`.
   - _Design change:_ targeted edits to `report.html` → build → preview → publish.
4. **Access** — use `set_access` / `get_access`. Emails outside allowed domains must be added as external (ask the user for an expiry date). Never change access on re-publish.
5. **Quality checklist (before publish)**
   - [ ] KPI totals match a direct calculation from the source (state the check you did)
   - [ ] Every chart has a title and units/currency; axes labelled where needed
   - [ ] "Data as of" date set in `data.json.meta.asOf`
   - [ ] Currency/locale set correctly in `meta`
   - [ ] Build has no errors; warnings reviewed
   - [ ] Looks right on mobile width and in dark mode (preview)
6. **Keeping usage low** — one conversation per report; refer to files instead of pasting content; don't re-read files you just wrote; for monthly refreshes only run scripts.

**Acceptance:** file reviewed for clarity; under ~150 lines.

---

## 8.3 Reference files

**Do:**

1. `references/helpers.md` — every `Report.*` function: signature, options table, one short example each (generated from/kept in sync with `base.js` JSDoc; add a note in `base.js`: _"Update .claude/skills/create-report/references/helpers.md when changing this API."_).
2. `references/design.md`:
   - Layout order: header → KPI row (3–6 KPIs) → main trend chart (full width) → 2-column breakdown charts → detail table(s) → footer with source notes.
   - Chart choice: trend over time → line/area; compare categories → horizontal bar (sorted); share of total (≤ 6 parts) → donut, otherwise bar; distribution → histogram; two measures → combo bar+line with two axes only if units differ.
   - Colour: use the palette in order; one highlight colour for the key series; red/green only for good/bad deltas.
   - Formatting: compact numbers on KPIs (`1.2M`), full numbers in tables; percentages with 1 decimal; dates short.
   - Text: titles as statements where possible ("Revenue up 12% vs last quarter"); short notes under charts for caveats.
   - Don'ts: 3D charts, pie with > 6 slices, more than 8 series in one chart, dual axes with the same unit.
3. `references/data.md`:
   - Inspecting CSV/XLSX quickly (Node snippets with `csv-parse` / `exceljs`).
   - Aggregation patterns: group-by-sum, month bucketing, top-N + "Other", period-over-period deltas.
   - Data cleaning: trim headers, parse numbers with thousands separators, dates in multiple formats, drop empty rows; log what was dropped.
   - `data.json` shape convention: `{ meta, kpis, series: {...}, tables: {...} }`.

**Acceptance:** an agent reading only these files could build the `_example` report.

---

## 8.4 End-to-end test

**Do:** in a **new** Claude Code conversation (emulator target) ask:

> "Using reports/_example/data/sales.csv, create a new report `test-skill` focused on regional performance, and share it with Alice."

Check: the skill was used; raw CSV was **not** dumped into the chat; `data.json` is aggregated; checklist was followed; report published and visible to Alice. Note token usage and any improvements to the skill, apply them, then delete the test report and folder.

**Acceptance:** notes recorded under this step; improvements applied.

---

## 8.5 Using the skill in Claude Desktop

**Do:** add to `docs/DEVELOPMENT.md` how to package the skill folder as a `.zip` and upload it in Claude Desktop / claude.ai skill settings (check current Claude docs for the exact menu path). Note that Desktop needs both the MCP server (7.4) and file access to `reports/`.

**Acceptance:** instructions written; tested in Claude Desktop if available.
