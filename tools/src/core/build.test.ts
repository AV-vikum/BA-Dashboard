import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildReportFolder, serializeData } from './build.js';
import { createReportFolder } from './report-folder.js';

let dir: string;
let folder: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'ba-build-'));
  folder = createReportFolder(dir, 'test-report', 'Test <Report>');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeHtml(html: string) {
  writeFileSync(path.join(folder, 'report.html'), html);
}

describe('buildReportFolder', () => {
  it('inlines the base template and data, and sets the escaped title', () => {
    const result = buildReportFolder(folder);
    const html = readFileSync(result.outPath, 'utf8');
    expect(html).not.toContain('<!-- @include');
    expect(html).not.toContain('<!-- @data -->');
    expect(html).toContain('window.Report');
    expect(html).toContain('--r-series-1');
    expect(html).toContain('id="report-data"');
    expect(html).toContain('<title>Test &lt;Report&gt;</title>');
    expect(result.bytes).toBe(Buffer.byteLength(html));
    expect(result.warnings).toEqual([]);
  });

  it('escapes </script> inside data so it cannot break out of the data block', () => {
    writeFileSync(
      path.join(folder, 'data.json'),
      JSON.stringify({ meta: { title: 'x' }, note: '</script><script>alert(1)</script>' }),
    );
    const html = readFileSync(buildReportFolder(folder).outPath, 'utf8');
    const dataBlock = html.slice(html.indexOf('id="report-data"'));
    expect(dataBlock.indexOf('</script>')).toBeGreaterThan(dataBlock.indexOf('alert(1)'));
    expect(JSON.parse(serializeData({ a: '</script>' }))).toEqual({ a: '</script>' });
  });

  it('keeps "$&" in data literally', () => {
    writeFileSync(path.join(folder, 'data.json'), JSON.stringify({ meta: {}, v: 'a$&b' }));
    expect(readFileSync(buildReportFolder(folder).outPath, 'utf8')).toContain('a$&b');
  });

  it('fails when the data marker is missing', () => {
    writeHtml('<html><body>no marker</body></html>');
    expect(() => buildReportFolder(folder)).toThrow(/@data/);
  });

  it('fails when the result is over the size limit', () => {
    writeFileSync(
      path.join(folder, 'data.json'),
      JSON.stringify({ meta: {}, big: 'x'.repeat(1_000_000) }),
    );
    expect(() => buildReportFolder(folder)).toThrow(/over the .* limit/);
  });

  it('fails on invalid report.json with the field name', () => {
    writeFileSync(path.join(folder, 'report.json'), JSON.stringify({ title: '' }));
    expect(() => buildReportFolder(folder)).toThrow(/title/);
  });

  it('warns about disallowed hosts, relative files and risky APIs', () => {
    writeHtml(`<html><head><title>x</title>
      <!-- @include base.css -->
      <script src="https://evil.example.com/x.js"></script>
      <link rel="stylesheet" href="local.css" />
      </head><body><!-- @data --><!-- @include base.js -->
      <script>fetch('/api'); localStorage.x = 1;</script></body></html>`);
    const { warnings } = buildReportFolder(folder);
    expect(warnings.join('\n')).toMatch(/evil\.example\.com/);
    expect(warnings.join('\n')).toMatch(/relative link "local\.css"/);
    expect(warnings.join('\n')).toMatch(/fetch\(\)/);
    expect(warnings.join('\n')).toMatch(/browser storage/);
  });
});

describe('createReportFolder', () => {
  it('refuses to overwrite an existing folder', () => {
    expect(() => createReportFolder(dir, 'test-report', 'Again')).toThrow(/already exists/);
  });

  it('rejects path traversal', () => {
    expect(() => createReportFolder(dir, '../evil', 'x')).toThrow(/Invalid report slug/);
  });
});
