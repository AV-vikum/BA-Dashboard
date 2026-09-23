---
name: create-report
description: Create, update, or refresh a dashboard report (KPIs, charts, tables) in reports/<slug>/ and publish or share it in the BA-Dashboard app. Use when the user asks to build, change, refresh, publish, share, or unpublish a report or dashboard.
---

# Create a BA-Dashboard report

A report is a folder `reports/<slug>/` that builds into one self-contained HTML page:

| File             | What it holds                                                         | Who edits it                |
| ---------------- | --------------------------------------------------------------------- | --------------------------- |
| `data/`          | Source files (CSV / XLSX) — real company data, never committed        | the user                    |
| `build-data.mjs` | Node script: source files → aggregated `data.json`                    | you                         |
| `data.json`      | Aggregated numbers only (`meta`, `kpis`, `series`, `tables`)          | generated — don't hand-edit |
| `report.html`    | Layout + a short script calling `Report.*` helpers with `Report.data` | you                         |
| `report.json`    | Title, description, tags, status, initial access, `reportIds`         | you (never `reportIds`)     |

Tools: the **ba-dashboard MCP tools** (`create_report_folder`, `build_report`, `preview_report`,
`publish_report`, `set_access`, `get_access`, `list_reports`, `list_groups`, `unpublish_report`)
or the same commands via `npm run report -- <new|build|preview|publish|access|list|groups|unpublish>`.
Every result starts with the target — **check it says what the user expects** (emulator vs production).

## Golden rules

1. **Never read large raw data into the conversation.** Inspect with a tiny script: row count,
   column names, 5 sample rows, min/max of dates. Then aggregate in `build-data.mjs`.
2. `data.json` holds **aggregated** numbers only (aim < 200 KB). No numbers hard-coded in `report.html`.
3. Use the `Report.*` helpers — see [references/helpers.md](references/helpers.md). Don't write
   custom chart, table or number-format code unless a helper can't do it.
4. Follow [references/design.md](references/design.md) for layout, chart choice and wording.
5. Make **targeted edits** to existing files; don't rewrite whole files for small changes.
6. Work only inside `reports/<slug>/`. Don't edit `templates/` unless the user asks.
7. Real data never goes into git — `reports/` is git-ignored (except `reports/_example`); keep it that way.

## New report

1. Ask only what's unclear: purpose and audience, the questions it must answer, which data
   files, who should see it.
2. `create_report_folder` (slug: lower-case words joined by hyphens, e.g. `sales-q3-2026`).
3. Put / find the source files in `data/`. Inspect them with a short script
   ([references/data.md](references/data.md) has snippets).
4. Write `build-data.mjs` → `build_report` runs it. Check the output line: row counts, nothing
   unexpectedly dropped, `data.json` size.
5. Edit `report.html`: header → KPI row → main trend → breakdowns → detail table. Start from the
   starter's structure; `reports/_example/` is a complete worked example.
6. Fill `report.json`: title, one-sentence description, 1–4 lower-case tags, `access`
   (emails, group names from `list_groups`, external `{ email, expires }`).
7. `build_report` → fix every error; review warnings → `preview_report` → ask the user to look.
8. Run the quality checklist below, then `publish_report` → give the user the URL.

## Update or refresh

- **New data, same design:** replace files in `data/` → `build_report` → `publish_report`.
  Do not touch `report.html`.
- **Design change:** targeted edits to `report.html` → `build_report` → `preview_report` → `publish_report`.
- Publishing again keeps the same URL and **never changes access**.
- Details edited in the web app are overwritten by `report.json` on publish — the tool warns;
  copy the web edits into `report.json` first if they should stay.

## Access

- Use `set_access` / `get_access` (by folder slug or report id); groups by name.
- `access` in `report.json` is applied **only on the first publish**.
- Emails outside the organization's domains must go in `addExternal`. Ask the user for an
  expiry date (last day of access, `YYYY-MM-DD`) before sharing outside.
- Removing a person who is in an assigned group doesn't remove their access — the tool warns;
  change the group in the web app instead.
- `unpublish_report` without `confirm: true` only describes the effect: show it to the user and
  ask before confirming.

## Quality checklist (before publishing)

- [ ] KPI totals match a direct calculation from the source — say which check you ran
- [ ] Every chart has a title (ideally a statement), a note with period and units/currency
- [ ] `meta.asOf` set to the last date in the data; `meta.currency` / `meta.locale` correct
- [ ] `build_report` shows no errors; every warning understood
- [ ] Looks right in the preview on a narrow window and in dark mode
- [ ] `report.json` title/description/tags/access are right; target is the intended one

## Keeping usage low

- One conversation per report. Refer to files by path instead of pasting their content.
- Don't re-read files you just wrote; don't print `data.json` — check its size and a few keys.
- Monthly refresh = replace data → `build_report` → `publish_report`. Nothing else.
