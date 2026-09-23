import { defineConfig } from 'tsup';

// Bundles the CLI and MCP server into tools/dist. @ba/shared is inlined (it ships as
// TypeScript source); npm dependencies stay external and load from node_modules.
export default defineConfig({
  entry: ['src/cli.ts', 'src/mcp.ts'],
  format: 'esm',
  target: 'node22',
  platform: 'node',
  noExternal: ['@ba/shared'],
  banner: { js: '#!/usr/bin/env node' },
  clean: true,
});
