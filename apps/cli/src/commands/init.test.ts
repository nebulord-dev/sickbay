import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { generateConfigFile, syncConfigFile } from './init.js';

describe('generateConfigFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `sickbay-init-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        dependencies: { react: '^19.0.0' },
      }),
    );
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates config file when none exists', async () => {
    await generateConfigFile(tempDir);
    const configPath = join(tempDir, 'sickbay.config.ts');
    expect(existsSync(configPath)).toBe(true);
    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain("@type {import('sickbay/config').SickbayConfig}");
    expect(content).toContain('knip: true');
  });

  it('skips generation when config already exists', async () => {
    const configPath = join(tempDir, 'sickbay.config.ts');
    writeFileSync(configPath, 'existing config');
    await generateConfigFile(tempDir);
    expect(readFileSync(configPath, 'utf-8')).toBe('existing config');
  });

  it('includes framework-specific checks for React projects', async () => {
    await generateConfigFile(tempDir);
    const content = readFileSync(join(tempDir, 'sickbay.config.ts'), 'utf-8');
    expect(content).toContain("'react-perf': true");
  });

  it('excludes framework-specific checks for non-matching frameworks', async () => {
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-api',
        dependencies: { express: '^5.0.0' },
      }),
    );
    await generateConfigFile(tempDir);
    const content = readFileSync(join(tempDir, 'sickbay.config.ts'), 'utf-8');
    expect(content).not.toContain("'react-perf'");
    expect(content).toContain("'node-security': true");
  });

  it('overwrites existing config when force is true', async () => {
    const configPath = join(tempDir, 'sickbay.config.ts');
    writeFileSync(configPath, 'old content');
    await generateConfigFile(tempDir, { force: true });
    const content = readFileSync(configPath, 'utf-8');
    expect(content).not.toBe('old content');
    expect(content).toContain('knip: true');
  });
});

describe('syncConfigFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `sickbay-sync-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        dependencies: { react: '^19.0.0' },
      }),
    );
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('prints message when no config file exists', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await syncConfigFile(tempDir);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No config file found'));
    logSpy.mockRestore();
  });

  it('prints up-to-date when all checks are present', async () => {
    // Generate a full config first
    await generateConfigFile(tempDir);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await syncConfigFile(tempDir);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('up to date'));
    logSpy.mockRestore();
  });

  it('appends missing checks to existing config', async () => {
    // Write a config with only a few checks
    const configPath = join(tempDir, 'sickbay.config.ts');
    writeFileSync(
      configPath,
      `/** @type {import('sickbay/config').SickbayConfig} */
export default {
  checks: {
    knip: true,
    depcheck: true,
  },
}
`,
    );
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await syncConfigFile(tempDir);

    const content = readFileSync(configPath, 'utf-8');
    // Original checks preserved
    expect(content).toContain('knip: true');
    expect(content).toContain('depcheck: true');
    // New checks added
    expect(content).toContain('// --- New:');
    expect(content).toContain('eslint: true');

    // Log reports what was added
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('new check(s)'));
    logSpy.mockRestore();
  });

  it('warns when config has no checks block', async () => {
    writeFileSync(
      join(tempDir, 'sickbay.config.ts'),
      `export default { weights: { security: 0.5 } }`,
    );
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await syncConfigFile(tempDir);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('no `checks` block'));
    logSpy.mockRestore();
  });
});
