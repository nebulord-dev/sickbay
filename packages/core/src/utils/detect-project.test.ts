import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { existsSync, readFileSync } from 'fs';

import { detectProject, detectPackageManager, detectContext } from './detect-project.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

function makePkg(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    dependencies: {},
    devDependencies: {},
    ...overrides,
  });
}

describe('detectProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: only package.json exists
    mockExistsSync.mockImplementation((p) => String(p).endsWith('package.json'));
    mockReadFileSync.mockReturnValue(makePkg() as never);
  });

  it('throws when no package.json is found', async () => {
    mockExistsSync.mockReturnValue(false);
    await expect(detectProject('/no-project')).rejects.toThrow('No package.json found');
  });

  it('returns name and version from package.json', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ name: 'my-app', version: '2.3.4' }) as never);
    const info = await detectProject('/project');
    expect(info.name).toBe('my-app');
    expect(info.version).toBe('2.3.4');
  });

  it('defaults name to "unknown" and version to "0.0.0" when not set', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({}) as never);
    const info = await detectProject('/project');
    expect(info.name).toBe('unknown');
    expect(info.version).toBe('0.0.0');
  });

  it('detects next.js framework', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ dependencies: { next: '^14.0.0' } }) as never);
    const info = await detectProject('/project');
    expect(info.framework).toBe('next');
  });

  it('detects vite from @vitejs/plugin-react devDep', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ devDependencies: { '@vitejs/plugin-react': '^4.0.0' } }) as never,
    );
    const info = await detectProject('/project');
    expect(info.framework).toBe('vite');
  });

  it('detects vite from vite devDep when no plugin-react', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ devDependencies: { vite: '^5.0.0' } }) as never);
    const info = await detectProject('/project');
    expect(info.framework).toBe('vite');
  });

  it('detects cra from react-scripts', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ dependencies: { 'react-scripts': '^5.0.0' } }) as never,
    );
    const info = await detectProject('/project');
    expect(info.framework).toBe('cra');
  });

  it('detects react from react dep', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ dependencies: { react: '^18.0.0' } }) as never);
    const info = await detectProject('/project');
    expect(info.framework).toBe('react');
  });

  it('detects express framework', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ dependencies: { express: '^4.0.0' } }) as never);
    const info = await detectProject('/project');
    expect(info.framework).toBe('express');
  });

  it('detects fastify framework', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ dependencies: { fastify: '^4.0.0' } }) as never);
    const info = await detectProject('/project');
    expect(info.framework).toBe('fastify');
  });

  it('detects koa framework', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ dependencies: { koa: '^2.0.0' } }) as never);
    const info = await detectProject('/project');
    expect(info.framework).toBe('koa');
  });

  it('detects hapi framework', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ dependencies: { '@hapi/hapi': '^21.0.0' } }) as never,
    );
    const info = await detectProject('/project');
    expect(info.framework).toBe('hapi');
  });

  it('returns node when no recognized framework found', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ dependencies: { lodash: '^4.0.0' } }) as never);
    const info = await detectProject('/project');
    expect(info.framework).toBe('node');
  });

  it('detects TypeScript via tsconfig.json file', async () => {
    mockExistsSync.mockImplementation(
      (p) => String(p).endsWith('package.json') || String(p).endsWith('tsconfig.json'),
    );
    const info = await detectProject('/project');
    expect(info.hasTypeScript).toBe(true);
  });

  it('detects TypeScript via typescript devDependency', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ devDependencies: { typescript: '^5.0.0' } }) as never,
    );
    const info = await detectProject('/project');
    expect(info.hasTypeScript).toBe(true);
  });

  it('detects ESLint via eslint.config.js', async () => {
    mockExistsSync.mockImplementation(
      (p) => String(p).endsWith('package.json') || String(p).endsWith('eslint.config.js'),
    );
    const info = await detectProject('/project');
    expect(info.hasESLint).toBe(true);
  });

  it('detects ESLint via .eslintrc.json', async () => {
    mockExistsSync.mockImplementation(
      (p) => String(p).endsWith('package.json') || String(p).endsWith('.eslintrc.json'),
    );
    const info = await detectProject('/project');
    expect(info.hasESLint).toBe(true);
  });

  it('detects ESLint via eslint devDependency', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ devDependencies: { eslint: '^8.0.0' } }) as never);
    const info = await detectProject('/project');
    expect(info.hasESLint).toBe(true);
  });

  it('detects Prettier via .prettierrc file', async () => {
    mockExistsSync.mockImplementation(
      (p) => String(p).endsWith('package.json') || String(p).endsWith('.prettierrc'),
    );
    const info = await detectProject('/project');
    expect(info.hasPrettier).toBe(true);
  });

  it('detects Prettier via prettier devDependency', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ devDependencies: { prettier: '^3.0.0' } }) as never);
    const info = await detectProject('/project');
    expect(info.hasPrettier).toBe(true);
  });

  it('counts total dependencies from both deps and devDeps', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({
        dependencies: { react: '^18', axios: '^1' },
        devDependencies: { vite: '^5', typescript: '^5' },
      }) as never,
    );
    const info = await detectProject('/project');
    expect(info.totalDependencies).toBe(4);
  });

  it('returns packageManager from lock file detection', async () => {
    mockExistsSync.mockImplementation(
      (p) => String(p).endsWith('package.json') || String(p).endsWith('pnpm-lock.yaml'),
    );
    const info = await detectProject('/project');
    expect(info.packageManager).toBe('pnpm');
  });

  it('returns pnpm overrides when pnpm.overrides is present', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ pnpm: { overrides: { minimatch: '>=10.0.0', rollup: '>=4.0.0' } } }) as never,
    );
    const info = await detectProject('/project');
    expect(info.overrides).toEqual({ minimatch: '>=10.0.0', rollup: '>=4.0.0' });
  });

  it('returns npm overrides when overrides is present', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ overrides: { lodash: '^4.17.21' } }) as never);
    const info = await detectProject('/project');
    expect(info.overrides).toEqual({ lodash: '^4.17.21' });
  });

  it('returns yarn resolutions when resolutions is present', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ resolutions: { webpack: '5.90.0' } }) as never);
    const info = await detectProject('/project');
    expect(info.overrides).toEqual({ webpack: '5.90.0' });
  });

  it('returns undefined overrides when none are present', async () => {
    const info = await detectProject('/project');
    expect(info.overrides).toBeUndefined();
  });

  it('resolves pnpm catalog: references to actual versions', async () => {
    const workspaceYaml = [
      'packages:',
      '  - apps/*',
      '',
      'catalog:',
      '  vitest: ^4.1.2',
      "  '@types/react': ^19.2.14",
      '  typescript: ^5.9.3',
    ].join('\n');

    mockExistsSync.mockImplementation((p) => {
      const s = String(p);
      return s.endsWith('package.json') || s.endsWith('pnpm-workspace.yaml');
    });
    mockReadFileSync.mockImplementation((p) => {
      if (String(p).endsWith('pnpm-workspace.yaml')) return workspaceYaml as never;
      return makePkg({
        devDependencies: {
          vitest: 'catalog:',
          '@types/react': 'catalog:',
          'some-other': '^1.0.0',
        },
      }) as never;
    });

    const info = await detectProject('/project');
    expect(info.devDependencies.vitest).toBe('^4.1.2');
    expect(info.devDependencies['@types/react']).toBe('^19.2.14');
    expect(info.devDependencies['some-other']).toBe('^1.0.0');
  });

  it('leaves catalog: unchanged when no workspace yaml is found', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ devDependencies: { vitest: 'catalog:' } }) as never);
    const info = await detectProject('/project');
    expect(info.devDependencies.vitest).toBe('catalog:');
  });
});

describe('detectPackageManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  it('returns pnpm when pnpm-lock.yaml exists', () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('pnpm-lock.yaml'));
    expect(detectPackageManager('/project')).toBe('pnpm');
  });

  it('returns yarn when yarn.lock exists', () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('yarn.lock'));
    expect(detectPackageManager('/project')).toBe('yarn');
  });

  it('returns bun when bun.lockb exists', () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('bun.lockb'));
    expect(detectPackageManager('/project')).toBe('bun');
  });

  it('returns bun when bun.lock exists', () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('bun.lock'));
    expect(detectPackageManager('/project')).toBe('bun');
  });

  it('defaults to npm when no lock file found', () => {
    expect(detectPackageManager('/project')).toBe('npm');
  });

  it('walks up to parent directory to find pnpm-lock.yaml', () => {
    mockExistsSync.mockImplementation((p) => String(p) === '/parent/pnpm-lock.yaml');
    expect(detectPackageManager('/parent/child')).toBe('pnpm');
  });

  it('walks up to parent directory to find yarn.lock', () => {
    mockExistsSync.mockImplementation((p) => String(p) === '/parent/yarn.lock');
    expect(detectPackageManager('/parent/child')).toBe('yarn');
  });

  it('prefers lock file in closer directory over parent', () => {
    mockExistsSync.mockImplementation((p) => {
      if (String(p) === '/parent/child/pnpm-lock.yaml') return true;
      if (String(p) === '/parent/yarn.lock') return true;
      return false;
    });
    expect(detectPackageManager('/parent/child')).toBe('pnpm');
  });
});

describe('detectContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockImplementation((p) => String(p).endsWith('package.json'));
    mockReadFileSync.mockReturnValue(makePkg() as never);
  });

  it('returns node runtime when no frontend framework is detected', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ dependencies: { express: '^4.0.0' } }) as never);
    const ctx = await detectContext('/project');
    expect(ctx.runtime).toBe('node');
    expect(ctx.frameworks).toEqual([]);
  });

  it('returns browser runtime for a React project', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ dependencies: { react: '^18.0.0' } }) as never);
    const ctx = await detectContext('/project');
    expect(ctx.runtime).toBe('browser');
    expect(ctx.frameworks).toContain('react');
  });

  it('includes both react and next for a Next.js project', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ dependencies: { next: '^14.0.0', react: '^18.0.0' } }) as never,
    );
    const ctx = await detectContext('/project');
    expect(ctx.frameworks).toContain('react');
    expect(ctx.frameworks).toContain('next');
  });

  it('detects vite as build tool', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ devDependencies: { vite: '^5.0.0' }, dependencies: { react: '^18.0.0' } }) as never,
    );
    const ctx = await detectContext('/project');
    expect(ctx.buildTool).toBe('vite');
  });

  it('detects vitest as test framework', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ devDependencies: { vitest: '^1.0.0' } }) as never);
    const ctx = await detectContext('/project');
    expect(ctx.testFramework).toBe('vitest');
  });

  it('returns null testFramework when no test framework detected', async () => {
    const ctx = await detectContext('/project');
    expect(ctx.testFramework).toBeNull();
  });

  it('returns unknown runtime when package.json is missing', async () => {
    mockExistsSync.mockReturnValue(false);
    const ctx = await detectContext('/project');
    expect(ctx.runtime).toBe('unknown');
    expect(ctx.frameworks).toEqual([]);
  });

  it('detects webpack as build tool for Next.js projects', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ dependencies: { next: '^14.0.0', react: '^18.0.0' } }) as never,
    );
    const ctx = await detectContext('/project');
    expect(ctx.buildTool).toBe('webpack');
  });

  it('detects angular framework', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ dependencies: { '@angular/core': '^17.0.0' } }) as never,
    );
    const ctx = await detectContext('/project');
    expect(ctx.frameworks).toContain('angular');
    expect(ctx.runtime).toBe('browser');
  });
});
