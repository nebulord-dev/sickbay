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
    mockReadFileSync.mockReturnValue(
      makePkg({ devDependencies: { vite: '^5.0.0' } }) as never,
    );
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
    mockReadFileSync.mockReturnValue(
      makePkg({ dependencies: { react: '^18.0.0' } }) as never,
    );
    const info = await detectProject('/project');
    expect(info.framework).toBe('react');
  });

  it('returns unknown framework when no match', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ dependencies: { express: '^4.0.0' } }) as never,
    );
    const info = await detectProject('/project');
    expect(info.framework).toBe('unknown');
  });

  it('detects TypeScript via tsconfig.json file', async () => {
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith('package.json') || String(p).endsWith('tsconfig.json'),
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
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith('package.json') || String(p).endsWith('eslint.config.js'),
    );
    const info = await detectProject('/project');
    expect(info.hasESLint).toBe(true);
  });

  it('detects ESLint via .eslintrc.json', async () => {
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith('package.json') || String(p).endsWith('.eslintrc.json'),
    );
    const info = await detectProject('/project');
    expect(info.hasESLint).toBe(true);
  });

  it('detects ESLint via eslint devDependency', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ devDependencies: { eslint: '^8.0.0' } }) as never,
    );
    const info = await detectProject('/project');
    expect(info.hasESLint).toBe(true);
  });

  it('detects Prettier via .prettierrc file', async () => {
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith('package.json') || String(p).endsWith('.prettierrc'),
    );
    const info = await detectProject('/project');
    expect(info.hasPrettier).toBe(true);
  });

  it('detects Prettier via prettier devDependency', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ devDependencies: { prettier: '^3.0.0' } }) as never,
    );
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
    mockExistsSync.mockImplementation((p) =>
      String(p).endsWith('package.json') || String(p).endsWith('pnpm-lock.yaml'),
    );
    const info = await detectProject('/project');
    expect(info.packageManager).toBe('pnpm');
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
    mockReadFileSync.mockReturnValue(makePkg({ dependencies: { next: '^14.0.0', react: '^18.0.0' } }) as never);
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
    mockReadFileSync.mockReturnValue(
      makePkg({ devDependencies: { vitest: '^1.0.0' } }) as never,
    );
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

  it('detects angular framework', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ dependencies: { '@angular/core': '^17.0.0' } }) as never,
    );
    const ctx = await detectContext('/project');
    expect(ctx.frameworks).toContain('angular');
    expect(ctx.runtime).toBe('browser');
  });
});
