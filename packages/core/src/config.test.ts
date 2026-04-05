import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  defineConfig,
  getCheckConfig,
  getUnlistedChecks,
  isCheckDisabled,
  loadConfig,
  mergeConfigs,
  resolveConfigMeta,
  validateConfig,
} from './config.js';

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

describe('isCheckDisabled', () => {
  it('returns false when config is null', () => {
    expect(isCheckDisabled(null, 'knip')).toBe(false);
  });
  it('returns false when check is not in config', () => {
    expect(isCheckDisabled({ checks: {} }, 'knip')).toBe(false);
  });
  it('returns false when check is true', () => {
    expect(isCheckDisabled({ checks: { knip: true } }, 'knip')).toBe(false);
  });
  it('returns true when check is false', () => {
    expect(isCheckDisabled({ checks: { knip: false } }, 'knip')).toBe(true);
  });
  it('returns true when check has enabled: false', () => {
    expect(isCheckDisabled({ checks: { knip: { enabled: false } } }, 'knip')).toBe(true);
  });
  it('returns false when check is an object without enabled: false', () => {
    expect(
      isCheckDisabled(
        { checks: { complexity: { thresholds: { general: { warn: 500, critical: 800 } } } } },
        'complexity',
      ),
    ).toBe(false);
  });
});

describe('getCheckConfig', () => {
  it('returns null when config is null', () => {
    expect(getCheckConfig(null, 'knip')).toBeNull();
  });
  it('returns null when checks is undefined', () => {
    expect(getCheckConfig({}, 'knip')).toBeNull();
  });
  it('returns null when check is true', () => {
    expect(getCheckConfig({ checks: { knip: true } }, 'knip')).toBeNull();
  });
  it('returns null when check is false', () => {
    expect(getCheckConfig({ checks: { knip: false } }, 'knip')).toBeNull();
  });
  it('returns null when check has enabled: false', () => {
    expect(getCheckConfig({ checks: { knip: { enabled: false } } }, 'knip')).toBeNull();
  });
  it('returns CheckConfig when check has thresholds', () => {
    const cfg = { thresholds: { maxErrors: 5 } };
    expect(getCheckConfig({ checks: { eslint: cfg } }, 'eslint')).toBe(cfg);
  });
  it('returns CheckConfig when check has exclude', () => {
    const cfg = { exclude: ['src/generated/**'] };
    expect(getCheckConfig({ checks: { knip: cfg } }, 'knip')).toBe(cfg);
  });
  it('returns null for check not in config', () => {
    expect(getCheckConfig({ checks: { knip: true } }, 'eslint')).toBeNull();
  });
});

describe('resolveConfigMeta', () => {
  it('returns no-config meta when config is null', () => {
    expect(resolveConfigMeta(null)).toEqual({
      hasCustomConfig: false,
      overriddenChecks: [],
      disabledChecks: [],
    });
  });
  it('detects disabled checks', () => {
    const meta = resolveConfigMeta({
      checks: { knip: false, eslint: true, 'react-perf': { enabled: false } },
    });
    expect(meta.hasCustomConfig).toBe(true);
    expect(meta.disabledChecks).toEqual(['knip', 'react-perf']);
  });
  it('detects overridden checks', () => {
    const meta = resolveConfigMeta({
      checks: {
        complexity: { thresholds: { general: { warn: 500, critical: 800 } } },
        knip: true,
      },
    });
    expect(meta.overriddenChecks).toEqual(['complexity']);
  });
  it('detects custom weights as hasCustomConfig', () => {
    const meta = resolveConfigMeta({ weights: { security: 0.5 } });
    expect(meta.hasCustomConfig).toBe(true);
  });
  it('detects global exclude as hasCustomConfig', () => {
    const meta = resolveConfigMeta({ exclude: ['src/generated/**'] });
    expect(meta.hasCustomConfig).toBe(true);
  });
});

describe('validateConfig', () => {
  it('warns on unknown check IDs', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    validateConfig({ checks: { 'nonexistent-check': true } }, ['knip', 'eslint', 'complexity']);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent-check'));
    stderrSpy.mockRestore();
  });
  it('throws on weight values <= 0', () => {
    expect(() => validateConfig({ weights: { security: -1 } }, [])).toThrow();
    expect(() => validateConfig({ weights: { security: 0 } }, [])).toThrow();
  });
  it('does not warn on valid check IDs', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    validateConfig({ checks: { knip: false } }, ['knip']);
    expect(stderrSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
  });
  it('warns on unknown threshold keys', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    validateConfig({ checks: { eslint: { thresholds: { maxErrors: 10, unknownKey: 5 } } } }, [
      'eslint',
    ]);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('unknownKey'));
    expect(stderrSpy).not.toHaveBeenCalledWith(expect.stringContaining('maxErrors'));
    stderrSpy.mockRestore();
  });
  it('does not warn on valid threshold keys', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    validateConfig(
      { checks: { git: { thresholds: { staleMonths: 12, maxRemoteBranches: 30 } } } },
      ['git'],
    );
    expect(stderrSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
  });
  it('skips threshold validation for checks without known keys', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    validateConfig({ checks: { knip: { thresholds: { anything: true } } } }, ['knip']);
    expect(stderrSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
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

describe('getUnlistedChecks', () => {
  it('returns empty array when config is null', () => {
    expect(getUnlistedChecks(null, ['knip', 'eslint'])).toEqual([]);
  });

  it('returns empty array when config has no checks block', () => {
    expect(getUnlistedChecks({ weights: { security: 0.5 } }, ['knip'])).toEqual([]);
  });

  it('returns empty array when all runners are listed', () => {
    expect(
      getUnlistedChecks({ checks: { knip: true, eslint: false } }, ['knip', 'eslint']),
    ).toEqual([]);
  });

  it('returns unlisted runner names', () => {
    expect(getUnlistedChecks({ checks: { knip: true } }, ['knip', 'eslint', 'madge'])).toEqual([
      'eslint',
      'madge',
    ]);
  });
});

describe('mergeConfigs', () => {
  it('returns null when both are null', () => {
    expect(mergeConfigs(null, null)).toBeNull();
  });

  it('returns root when pkg is null', () => {
    const root = { checks: { knip: true as const } };
    expect(mergeConfigs(root, null)).toBe(root);
  });

  it('returns pkg when root is null', () => {
    const pkg = { checks: { eslint: false as const } };
    expect(mergeConfigs(null, pkg)).toBe(pkg);
  });

  it('overrides checks per-key with package winning', () => {
    const root = { checks: { knip: true as const, eslint: true as const } };
    const pkg = { checks: { eslint: false as const } };
    const merged = mergeConfigs(root, pkg)!;
    expect(merged.checks).toEqual({ knip: true, eslint: false });
  });

  it('concatenates exclude arrays', () => {
    const root = { exclude: ['src/generated/**'] };
    const pkg = { exclude: ['src/legacy/**'] };
    const merged = mergeConfigs(root, pkg)!;
    expect(merged.exclude).toEqual(['src/generated/**', 'src/legacy/**']);
  });

  it('handles missing exclude on one side', () => {
    const root = { exclude: ['src/generated/**'] };
    const pkg = { checks: { knip: true as const } };
    const merged = mergeConfigs(root, pkg)!;
    expect(merged.exclude).toEqual(['src/generated/**']);
  });

  it('overrides weights per-category with package winning', () => {
    const root = { weights: { security: 0.5 as const, git: 0.1 as const } };
    const pkg = { weights: { security: 0.3 as const } };
    const merged = mergeConfigs(root, pkg)!;
    expect(merged.weights).toEqual({ security: 0.3, git: 0.1 });
  });

  it('returns undefined weights when neither has them', () => {
    const root = { checks: { knip: true as const } };
    const pkg = { checks: { eslint: false as const } };
    const merged = mergeConfigs(root, pkg)!;
    expect(merged.weights).toBeUndefined();
  });
});
