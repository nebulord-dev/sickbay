import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/core/vitest.config.ts',
      'packages/cli/vitest.config.ts',
      'packages/web/vitest.config.ts',
    ],
  },
});
