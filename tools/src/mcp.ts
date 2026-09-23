// BA-Dashboard MCP server (stdio) — lets Claude Desktop / Claude Code create, build,
// preview, publish and share reports. Reuses tools/src/core/* (same logic as the CLI).
//
// stdout is the MCP protocol channel: log with console.error only.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import open from 'open';
import { z } from 'zod';
import { errorMessage, fail, formatBytes, ok, warn } from './core/output.js';

const FOLDERS =
  'Reports live in folders under reports/<slug>/ — edit report.html, data.json, build-data.mjs there, then call build_report / publish_report.';

// Env and Firestore modules load lazily so a broken production setup is reported as a
// tool error instead of crashing the server.
const core = {
  env: () => import('./core/env.js'),
  build: () => import('./core/build.js'),
  folder: () => import('./core/report-folder.js'),
  paths: () => import('./core/paths.js'),
  publish: () => import('./core/publish.js'),
  access: () => import('./core/access.js'),
  reports: () => import('./core/reports.js'),
  store: () => import('./core/store.js'),
  format: () => import('./core/format.js'),
};

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

/** Runs a tool body; every result starts with the target so changes are never ambiguous. */
async function run(body: () => Promise<string[]>): Promise<ToolResult> {
  try {
    const { targetLabel } = await core.env();
    const lines = await body();
    return { content: [{ type: 'text', text: [`[${targetLabel()}]`, ...lines].join('\n') }] };
  } catch (error) {
    return { content: [{ type: 'text', text: fail(errorMessage(error)) }], isError: true };
  }
}

async function folderFor(slug: string): Promise<string> {
  const [{ reportFolder }, { reportsDir }] = await Promise.all([core.paths(), core.store()]);
  return reportFolder(reportsDir(), slug);
}

async function buildLines(
  slug: string,
  withData: boolean,
): Promise<{ lines: string[]; outPath: string }> {
  const { buildReportFolder, runBuildData } = await core.build();
  const folder = await folderFor(slug);
  const lines: string[] = [];
  if (withData) {
    const output = await runBuildData(folder);
    if (output) lines.push(`build-data: ${output.split('\n').at(-1)}`);
  }
  const result = buildReportFolder(folder);
  lines.unshift(ok(`Built ${slug} (${formatBytes(result.bytes)}) → ${result.outPath}`));
  lines.push(...result.warnings.map(warn));
  return { lines, outPath: result.outPath };
}

const slug = z
  .string()
  .describe('Report folder name under reports/ (lower-case letters, digits, hyphens)');
const reportRef = z.string().describe('Report folder slug, or a report id');
const emails = z.array(z.string()).optional();

const server = new McpServer(
  { name: 'ba-dashboard', version: '1.0.0' },
  {
    instructions:
      'Create and share BA-Dashboard reports. ' +
      FOLDERS +
      ' New report: create_report_folder → edit files → build_report → preview_report → publish_report. ' +
      'Access: set_access (outside-domain emails go in addExternal). Every result starts with the target (emulator or production).',
  },
);

server.registerTool(
  'list_reports',
  {
    title: 'List reports',
    description:
      'List published and draft reports (id, status, folder, title, viewers). Optional search.',
    inputSchema: { search: z.string().optional().describe('Filter by title, description or tags') },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  ({ search }) =>
    run(async () => {
      const [{ listReports }, { reportListLines }] = await Promise.all([
        core.reports(),
        core.format(),
      ]);
      return reportListLines(await listReports(search), 50);
    }),
);

server.registerTool(
  'list_groups',
  {
    title: 'List groups',
    description: 'List access groups and their members (use group names with set_access).',
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  () =>
    run(async () => {
      const [{ listGroups }, { groupLines }] = await Promise.all([core.reports(), core.format()]);
      return groupLines(await listGroups());
    }),
);

server.registerTool(
  'create_report_folder',
  {
    title: 'Create report folder',
    description: `Create reports/<slug>/ from the starter template. ${FOLDERS}`,
    inputSchema: { slug, title: z.string().describe('Report title') },
    annotations: { openWorldHint: false },
  },
  ({ slug: s, title }) =>
    run(async () => {
      const [{ createReportFolder, EDITABLE_FILES }, { reportsDir }] = await Promise.all([
        core.folder(),
        core.store(),
      ]);
      const folder = createReportFolder(reportsDir(), s, title);
      return [ok(`Created ${folder}`), `edit: ${EDITABLE_FILES.join(', ')}`];
    }),
);

server.registerTool(
  'build_report',
  {
    title: 'Build report',
    description: `Run build-data.mjs (if present), then build reports/<slug>/ into one self-contained dist/report.html. Returns size and warnings. ${FOLDERS}`,
    inputSchema: { slug },
    annotations: { openWorldHint: false },
  },
  ({ slug: s }) => run(async () => (await buildLines(s, true)).lines),
);

server.registerTool(
  'preview_report',
  {
    title: 'Preview report',
    description:
      'Build reports/<slug>/ (without re-running build-data.mjs) and open it in the browser.',
    inputSchema: { slug },
    annotations: { openWorldHint: false },
  },
  ({ slug: s }) =>
    run(async () => {
      const { lines, outPath } = await buildLines(s, false);
      await open(outPath);
      return [...lines, 'opened in the browser'];
    }),
);

server.registerTool(
  'publish_report',
  {
    title: 'Publish report',
    description:
      'Build reports/<slug>/ and create or update it in the app; returns its URL. First publish applies access from report.json; later publishes update content and details only.',
    inputSchema: {
      slug,
      draft: z.boolean().optional().describe('Publish as a draft (admins only)'),
    },
    annotations: { destructiveHint: false, openWorldHint: false },
  },
  ({ slug: s, draft }) =>
    run(async () => {
      const [{ publishReport }, { publishLines }] = await Promise.all([
        core.publish(),
        core.format(),
      ]);
      return publishLines(await publishReport(s, { draft }));
    }),
);

server.registerTool(
  'set_access',
  {
    title: 'Change report access',
    description:
      'Add or remove viewers of a report. Internal people: addEmails/removeEmails; groups by name; people outside the allowed domains: addExternal (optional expires YYYY-MM-DD).',
    inputSchema: {
      report: reportRef,
      addEmails: emails,
      removeEmails: emails,
      addGroups: z.array(z.string()).optional().describe('Group names'),
      removeGroups: z.array(z.string()).optional().describe('Group names'),
      addExternal: z
        .array(
          z.object({
            email: z.string(),
            expires: z.string().optional().describe('Last day of access, YYYY-MM-DD'),
          }),
        )
        .optional(),
      removeExternal: emails,
    },
    annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  ({ report, ...change }) =>
    run(async () => {
      const [{ updateAccess }, { accessChangeLines }] = await Promise.all([
        core.access(),
        core.format(),
      ]);
      return accessChangeLines(await updateAccess(report, change));
    }),
);

server.registerTool(
  'get_access',
  {
    title: 'Show report access',
    description: 'Show who can view a report: direct people, groups, external people with expiry.',
    inputSchema: { report: reportRef },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  ({ report }) =>
    run(async () => {
      const [{ getAccess }, { accessLines }] = await Promise.all([core.access(), core.format()]);
      return accessLines(await getAccess(report));
    }),
);

server.registerTool(
  'unpublish_report',
  {
    title: 'Unpublish report',
    description:
      'Turn a report back into a draft so viewers lose access (nothing is deleted). Without confirm: true it only describes what would happen.',
    inputSchema: {
      report: reportRef,
      confirm: z.boolean().optional().describe('Must be true to actually unpublish'),
    },
    annotations: { destructiveHint: true, openWorldHint: false },
  },
  ({ report, confirm }) =>
    run(async () => {
      if (confirm !== true) {
        const { resolveReport } = await core.store();
        const { report: r } = await resolveReport(report);
        return [
          warn(
            `Would unpublish "${r.title}" (${r.id}) — ${r.viewerEmails.length} viewers and ` +
              `${r.externalEmails.length} external lose access. Ask the user, then call again with confirm: true.`,
          ),
        ];
      }
      const { unpublishReport } = await core.reports();
      const r = await unpublishReport(report);
      return [ok(`Unpublished "${r.title}" (${r.id}) — now a draft`)];
    }),
);

await server.connect(new StdioServerTransport());
console.error('ba-dashboard MCP server running on stdio');
