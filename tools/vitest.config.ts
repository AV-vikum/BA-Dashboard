import { defineConfig } from 'vitest/config';

// Unit tests only; emulator integration tests (*.int.test.ts) run via `npm run test:tools:int`.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
