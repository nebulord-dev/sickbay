import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { defineConfig, loadConfig } from './config.js';

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

describe('loadConfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `sickbay-config-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns null when no config file exists', async () => {
    const result = await loadConfig(tempDir);
    expect(result).toBeNull();
  });

  it('loads sickbay.config.ts', async () => {
    writeFileSync(
      join(tempDir, 'sickbay.config.ts'),
      `export default { checks: { knip: false } };`,
    );
    const result = await loadConfig(tempDir);
    expect(result).toEqual({ checks: { knip: false } });
  });

  it('loads sickbay.config.js as fallback', async () => {
    writeFileSync(
      join(tempDir, 'sickbay.config.js'),
      `export default { checks: { eslint: false } };`,
    );
    const result = await loadConfig(tempDir);
    expect(result).toEqual({ checks: { eslint: false } });
  });

  it('prefers .ts over .js when both exist', async () => {
    writeFileSync(
      join(tempDir, 'sickbay.config.ts'),
      `export default { checks: { knip: false } };`,
    );
    writeFileSync(
      join(tempDir, 'sickbay.config.js'),
      `export default { checks: { eslint: false } };`,
    );
    const result = await loadConfig(tempDir);
    expect(result).toEqual({ checks: { knip: false } });
  });

  it('returns null and warns on syntax error', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    writeFileSync(join(tempDir, 'sickbay.config.ts'), `export default {{{`);
    const result = await loadConfig(tempDir);
    expect(result).toBeNull();
    expect(stderrSpy).toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it('handles default export from defineConfig', async () => {
    writeFileSync(
      join(tempDir, 'sickbay.config.ts'),
      `
        function defineConfig(c: any) { return c; }
        export default defineConfig({ checks: { git: false } });
      `,
    );
    const result = await loadConfig(tempDir);
    expect(result).toEqual({ checks: { git: false } });
  });
});
