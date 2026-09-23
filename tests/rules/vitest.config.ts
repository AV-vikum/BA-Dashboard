import { defineConfig } from 'vitest/config';

// Security-rules tests share one emulator instance across the file, so
// they cannot run in parallel with each other (fileParallelism: false),
// and initializeTestEnvironment()/clearFirestore() calls need more than
// vitest's default 5s timeout.
export default defineConfig({
  test: {
    environment: 'node',
    // Otherwise vitest's default include glob picks up every *.test.ts in
    // the repo (shared/, web/, tools/) when run with --config from the root.
    include: ['tests/rules/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
