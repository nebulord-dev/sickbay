import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __VERSION__: '"0.0.0-test"',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
      ],
    },
  },
});
