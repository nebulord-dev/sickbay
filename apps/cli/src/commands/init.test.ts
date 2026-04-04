import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { generateConfigFile } from './init.js';

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
});
