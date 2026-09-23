// `npm run report -- <command>` — create, build, preview and publish reports.
// Commands print one line per result (✓ / ! / ✗); exit code 1 on error.
import { Command } from 'commander';
import open from 'open';
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

await program.parseAsync();
