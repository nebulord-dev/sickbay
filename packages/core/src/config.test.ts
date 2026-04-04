import { describe, it, expect } from 'vitest';

import { defineConfig } from './config.js';

describe('defineConfig', () => {
  it('returns the config object unchanged', () => {
    const config = {
      checks: { knip: true, 'react-perf': false },
    };
    expect(defineConfig(config)).toBe(config);
  });

  it('accepts an empty config', () => {
    expect(defineConfig({})).toEqual({});
  });

  it('accepts full config shape', () => {
    const config = {
      checks: {
        complexity: {
          thresholds: { 'react-component': { warn: 400, critical: 600 } },
          exclude: ['src/legacy/**'],
          suppress: [{ path: 'src/Big.tsx', reason: 'migration planned' }],
        },
        knip: false,
      },
      exclude: ['src/generated/**'],
      weights: { security: 0.5 },
    };
    expect(defineConfig(config)).toBe(config);
  });
});
