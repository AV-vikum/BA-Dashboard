// `npm run report -- <command>` — create, build, preview and publish reports.
// Commands print one line per result (✓ / ! / ✗); exit code 1 on error.
import { Command } from 'commander';
import open from 'open';
import { collectList as list, parseExternal } from './core/args.js';
import { buildReportFolder, runBuildData } from './core/build.js';
import { errorMessage, fail, formatBytes, ok, warn } from './core/output.js';
import { createReportFolder, EDITABLE_FILES } from './core/report-folder.js';
import { reportFolder, resolveReportsDir } from './core/paths.js';

// Loaded lazily so that a bad production env only fails the commands that need it.
async function loadEnv() {
  return (await import('./core/env.js')).env;
}

async function reportsDir(): Promise<string> {
  return resolveReportsDir(await loadEnv());
}

function print(lines: string | string[]): void {
  for (const line of Array.isArray(lines) ? lines : [lines]) console.log(line);
}

let verbose = false;

function action<A extends unknown[]>(fn: (...args: A) => Promise<void>) {
  return async (...args: A) => {
    try {
      await fn(...args);
    } catch (error) {
      console.error(fail(errorMessage(error)));
      if (verbose && error instanceof Error && error.stack) console.error(error.stack);
      process.exitCode = 1;
    }
  };
}

async function build(slug: string, withData: boolean) {
  const folder = reportFolder(await reportsDir(), slug);
  const lines: string[] = [];
  if (withData) {
    const output = await runBuildData(folder);
    if (output) lines.push(`  build-data: ${output.split('\n').at(-1)}`);
  }
  const result = buildReportFolder(folder);
  lines.unshift(
    ok(`Built ${slug} (${formatBytes(result.bytes)}) → reports/${slug}/dist/report.html`),
  );
  lines.push(...result.warnings.map(warn));
  print(lines);
  return result;
}

const program = new Command('report')
  .description('Create, build, preview and publish BA-Dashboard reports')
  .option('--verbose', 'print stack traces on errors')
  .hook('preAction', (cmd: Command) => {
    verbose = Boolean(cmd.opts().verbose);
  });

program
  .command('new')
  .description('create reports/<slug>/ from the starter template')
  .argument('<slug>', 'folder name: lower-case letters, digits, hyphens')
  .requiredOption('--title <title>', 'report title')
  .action(
    action(async (slug: string, opts: { title: string }) => {
      createReportFolder(await reportsDir(), slug, opts.title);
      print([
        ok(`Created reports/${slug}/`),
        `  edit: ${EDITABLE_FILES.join(', ')}`,
        `  then: npm run report -- preview ${slug}`,
      ]);
    }),
  );

program
  .command('build')
  .description('build reports/<slug>/ into dist/report.html')
  .argument('<slug>')
  .option('--data', 'run build-data.mjs first')
  .action(
    action(async (slug: string, opts: { data?: boolean }) => {
      await build(slug, Boolean(opts.data));
    }),
  );

program
  .command('preview')
  .description('build reports/<slug>/ and open it in the browser')
  .argument('<slug>')
  .option('--data', 'run build-data.mjs first')
  .action(
    action(async (slug: string, opts: { data?: boolean }) => {
      const result = await build(slug, Boolean(opts.data));
      await open(result.outPath);
    }),
  );

// ---- Firestore commands (target: emulator unless BA_TARGET=production) ----

async function printTarget() {
  const { targetLabel } = await import('./core/env.js');
  console.log(`[target: ${targetLabel()}]`);
}

program
  .command('publish')
  .description('build reports/<slug>/ and create or update it in Firestore')
  .argument('<slug>')
  .option('--draft', 'publish as a draft (only admins can see it)')
  .action(
    action(async (slug: string, opts: { draft?: boolean }) => {
      await printTarget();
      const { publishReport } = await import('./core/publish.js');
      const { publishLines } = await import('./core/format.js');
      print(publishLines(await publishReport(slug, { draft: opts.draft })));
    }),
  );

program
  .command('list')
  .description('list reports (id, status, folder, title, viewers/external, last update)')
  .option('--search <query>', 'filter by title, description or tags')
  .action(
    action(async (opts: { search?: string }) => {
      await printTarget();
      const { listReports } = await import('./core/reports.js');
      const { reportListLines } = await import('./core/format.js');
      print(reportListLines(await listReports(opts.search)));
    }),
  );

program
  .command('groups')
  .description('list groups and their members')
  .action(
    action(async () => {
      await printTarget();
      const { listGroups } = await import('./core/reports.js');
      const { groupLines } = await import('./core/format.js');
      print(groupLines(await listGroups()));
    }),
  );

program
  .command('access')
  .description('show or change who can view a report')
  .argument('<report>', 'report folder slug or report id')
  .option('--add <emails>', 'add internal people (comma-separated, repeatable)', list)
  .option('--remove <emails>', 'remove internal people', list)
  .option('--add-group <names>', 'add groups by name', list)
  .option('--remove-group <names>', 'remove groups by name', list)
  .option('--add-external <email[:YYYY-MM-DD]>', 'share with outside people, optional expiry', list)
  .option('--remove-external <emails>', 'remove outside people', list)
  .option('--show', 'print current access')
  .action(
    action(
      async (
        ref: string,
        opts: {
          add?: string[];
          remove?: string[];
          addGroup?: string[];
          removeGroup?: string[];
          addExternal?: string[];
          removeExternal?: string[];
          show?: boolean;
        },
      ) => {
        await printTarget();
        const { getAccess, updateAccess } = await import('./core/access.js');
        const { accessChangeLines, accessLines } = await import('./core/format.js');
        const changing = [
          opts.add,
          opts.remove,
          opts.addGroup,
          opts.removeGroup,
          opts.addExternal,
          opts.removeExternal,
        ].some((v) => v?.length);
        if (!changing) {
          print(accessLines(await getAccess(ref)));
          return;
        }
        const result = await updateAccess(ref, {
          addEmails: opts.add,
          removeEmails: opts.remove,
          addGroups: opts.addGroup,
          removeGroups: opts.removeGroup,
          addExternal: opts.addExternal?.map(parseExternal),
          removeExternal: opts.removeExternal,
        });
        print(accessChangeLines(result));
        if (opts.show) print(accessLines(result.view));
      },
    ),
  );

program
  .command('pull')
  .description('write reports/<slug>/report.json (details + live access) from Firestore')
  .argument('<id>', 'report id')
  .option('--slug <slug>', 'folder name (default: the stored slug or the title)')
  .action(
    action(async (id: string, opts: { slug?: string }) => {
      await printTarget();
      const { pullReport } = await import('./core/reports.js');
      const r = await pullReport(id, opts.slug);
      print(
        ok(
          r.created
            ? `Pulled ${r.id} into new folder reports/${r.slug}/ (built HTML only — see README.txt)`
            : `Updated reports/${r.slug}/report.json from ${r.id}`,
        ),
      );
    }),
  );

program
  .command('unpublish')
  .description('turn a report back into a draft (viewers lose access; nothing is deleted)')
  .argument('<report>', 'report folder slug or report id')
  .option('--yes', 'confirm')
  .action(
    action(async (ref: string, opts: { yes?: boolean }) => {
      await printTarget();
      if (!opts.yes) {
        const { resolveReport } = await import('./core/store.js');
        const { report } = await resolveReport(ref);
        print(
          warn(
            `Would unpublish "${report.title}" (${report.id}) — ${report.viewerEmails.length} ` +
              `viewers and ${report.externalEmails.length} external lose access. Re-run with --yes.`,
          ),
        );
        return;
      }
      const { unpublishReport } = await import('./core/reports.js');
      const report = await unpublishReport(ref);
      print(ok(`Unpublished "${report.title}" (${report.id}) — now a draft`));
    }),
  );

await program.parseAsync();
