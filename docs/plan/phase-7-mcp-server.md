# Phase 7 — MCP server (Claude Desktop / Claude Code)

## Context

A local **stdio** MCP server exposing the tools core as MCP tools, so Claude can create, build, preview, publish and share reports from chat. It reuses `tools/src/core/*` — **no duplicated logic**.

Design goals (keep Claude usage low):

- Tools take **slugs / folder paths**, never HTML content.
- Tools return **short text** (the same one-line format as the CLI).
- Few tools, short descriptions.

Check the current `@modelcontextprotocol/sdk` README for exact API names (`McpServer`, `registerTool`, `StdioServerTransport`).

---

## 7.1 Server skeleton and build

**Do:**

1. Install in tools: `@modelcontextprotocol/sdk tsup` (tsup as dev dep).
2. `tools/src/mcp.ts`: create `McpServer({ name: 'ba-dashboard', version })`, connect `StdioServerTransport`.
3. **Logging goes to `stderr` only** (`console.error`) — `stdout` is the protocol channel. Add an ESLint `no-console` override for `mcp.ts` allowing only `console.error`, and make sure no core function writes to `stdout` when called from MCP (core functions return data; formatting happens in `cli.ts` / `mcp.ts`).
4. `tools/tsup.config.ts`: entries `src/cli.ts`, `src/mcp.ts`; format `esm`; target `node22`; `noExternal: ['@ba/shared']`; `banner` shebang for cli; `clean: true`.
5. Scripts in tools: `"build": "tsup"`; root: `"build:tools": "npm run build -w tools"`, `"mcp": "node tools/dist/mcp.js"`.

**Acceptance:** `npm run build:tools` produces `tools/dist/mcp.js`; `npx @modelcontextprotocol/inspector node tools/dist/mcp.js` connects and lists 0 tools without errors.

> Note (2026-09-24): `REPO_ROOT` is now found by walking up to `firebase.json` (the fixed `../../..` from `paths.ts` would be wrong inside the bundled `tools/dist/*.js`). `npm install` builds the tools (`prepare`), so `tools/dist/mcp.js` always exists. SDK 1.30.1 (`McpServer.registerTool` with zod shapes); the server also sends short `instructions` describing the workflow.

---

## 7.2 Tools

**Do:** register these tools (zod input schemas; descriptions ≤ 2 sentences). Every result starts with the target label on its first line, e.g. `[emulator]`.

| Tool                   | Input                                                                                                                                       | Does                                                                                                | Returns                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `list_reports`         | `{ search?: string }`                                                                                                                       | Same as `report list`                                                                               | One line per report (max 50; say how many more) |
| `list_groups`          | `{}`                                                                                                                                        | Same as `report groups`                                                                             | Group lines                                     |
| `create_report_folder` | `{ slug, title }`                                                                                                                           | Same as `report new`                                                                                | Folder path + list of files to edit             |
| `build_report`         | `{ slug }`                                                                                                                                  | Runs `build-data.mjs` if present, then `buildReport`                                                | Size + warnings/errors                          |
| `preview_report`       | `{ slug }`                                                                                                                                  | Build + open in browser                                                                             | Output path                                     |
| `publish_report`       | `{ slug, draft?: boolean }`                                                                                                                 | `publishReport`                                                                                     | `✓ Created/Updated … → URL` + warnings          |
| `set_access`           | `{ report: string (slug or id), addEmails?, removeEmails?, addGroups?, removeGroups?, addExternal?: {email, expires?}[], removeExternal? }` | Same as `report access`                                                                             | Summary + warnings                              |
| `get_access`           | `{ report }`                                                                                                                                | `report access --show`                                                                              | Current access                                  |
| `unpublish_report`     | `{ report, confirm: boolean }`                                                                                                              | If `confirm` is not `true`, returns what _would_ happen and asks to call again with `confirm: true` | Result                                          |

Descriptions must mention: _"Reports live in folders under reports/<slug>/ — edit report.html, data.json, build-data.mjs there, then call build_report / publish_report."_

**Acceptance:** each tool works from the MCP Inspector against the emulator.

> Note (2026-09-24): verified with a real MCP client (SDK `Client` + `StdioClientTransport`, server started from a different working directory) instead of the Inspector UI: all 9 tools listed; create → build → publish → set_access → get_access → unpublish (dry run, then confirm) → list worked against the emulator. Tool annotations mark read-only / destructive tools.

---

## 7.3 Safety

**Do:**

1. Slugs validated with `assertValidSlug`; all paths resolved through `reportFolder()` (no path traversal).
2. `build_report` runs `build-data.mjs` with `child_process.execFile(process.execPath, [script], { cwd: folder, timeout: 120_000 })` — never through a shell string.
3. Production target: `publish_report`, `set_access`, `unpublish_report` include `[production]` in their result so the user always sees where changes went.
4. Errors are returned as tool errors with the one-line `✗` message, not thrown stack traces.

**Acceptance:** `create_report_folder` with slug `../evil` is rejected; an error in `build-data.mjs` returns a readable error.

> Note (2026-09-24): both checks done via the MCP client. A failing `build-data.mjs` now reports the thrown error line (e.g. `Error: column "revenue" missing in sales.csv`) instead of the tail of the stack trace. ESLint forbids `console.log` in `mcp.ts` and any console output in `tools/src/core/**`.

---

## 7.4 Client configuration

**Do:**

1. `.mcp.json.example` (Claude Code, project scope):
   ```json
   {
     "mcpServers": {
       "ba-dashboard": {
         "command": "node",
         "args": ["tools/dist/mcp.js"],
         "env": { "BA_TARGET": "emulator" }
       }
     }
   }
   ```
2. Add to `docs/DEVELOPMENT.md` a section **"Using Claude with this project"**:
   - Claude Code: `cp .mcp.json.example .mcp.json` → restart Claude Code → approve the server. Use an absolute path in `args` if the relative path doesn't resolve.
   - Claude Desktop (Windows): edit `%APPDATA%\Claude\claude_desktop_config.json`, add the same server with an **absolute** path (`"D:\\…\\BA-Dashboard\\tools\\dist\\mcp.js"`), restart Claude Desktop.
   - Claude Desktop also needs to read/write files in `reports/` → enable its filesystem access for the repo's `reports` folder (Desktop extensions / Filesystem connector — check the current Claude Desktop docs).
   - Switching to production is done in Phase 9 (`BA_TARGET=production`).
   - Rebuild (`npm run build:tools`) after changing tools code.

**Acceptance:** instructions tested in Claude Code at least.

> Note (2026-09-24): `claude mcp list` shows `ba-dashboard: node tools/dist/mcp.js — Pending approval` with the local `.mcp.json` in place — the user approves it once when starting Claude Code in the repo. Claude Desktop instructions written, not tested here.

---

## 7.5 End-to-end test with Claude Code (emulator)

**Do:** with emulators running and `.mcp.json` set up, ask Claude Code:

> "Create a report `test-mcp` titled 'MCP Test' from the example data, publish it and share it with the Finance group."

Verify: folder created, built, published; Alice sees it in the web app. Record the approximate token usage of the publish round-trip (tool call + result). Delete the test report afterwards (web admin) and the folder.

**Acceptance:** flow works end-to-end; notes recorded under this step.

> Note (2026-09-24): Ran as one headless session together with step 8.4: `claude -p … --model sonnet --mcp-config .mcp.json --strict-mcp-config` (only the ba-dashboard MCP server), asked to build a regional-performance report `test-skill` from `_example/data/sales.csv`, publish it and share it with alice@example.com + Finance, without asking questions. Result: 30 turns, 107 s, ≈ $0.47 on Sonnet (≈ 44k new + 875k cached input tokens, 12k output). It inspected the CSV with scripts (no raw dump), wrote an aggregated `data.json` (7.8 KB), published, set access, and independently re-summed revenue (5,535,665 — matches). The publish/access tool round-trips were a few hundred tokens each.
