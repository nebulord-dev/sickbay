import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/core/vitest.config.ts',
      'apps/cli/vitest.config.ts',
      'apps/web/vitest.config.ts',
    ],
  },
});
