import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'knowledge-base/__tests__/**/*.test.ts'],
  },
});
