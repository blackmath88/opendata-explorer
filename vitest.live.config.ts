import { defineConfig } from 'vitest/config';

/** Opt-in configuration for tests that talk to the live Basel API. */
export default defineConfig({
  test: {
    include: ['**/*.live.test.ts'],
    testTimeout: 180000,
    hookTimeout: 180000,
  },
});
