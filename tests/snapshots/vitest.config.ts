import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      'sickbay-core': resolve(__dirname, '../../packages/core/dist/index.js'),
    },
  },
  test: {
    root: __dirname,
    environment: 'node',
    include: ['*.test.ts'],
    globals: true,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
