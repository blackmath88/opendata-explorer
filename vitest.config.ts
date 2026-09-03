import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Live tests hit data.bs.ch. They are real and worth running, but CI must
    // never depend on a public API being up: `npm test` stays offline and
    // deterministic, `npm run test:live` opts in.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.live.test.ts'],
  },
});
