import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(import.meta.dirname),
  test: {
    include: ['tests/integration/**/*.test.ts'],
    exclude: [
      // Default vitest excludes
      '**/node_modules/**',
      '**/dist/**',
      // Tests awaiting their feature implementation — re-enable as each feature lands
      'tests/integration/pending/**',
    ],
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
