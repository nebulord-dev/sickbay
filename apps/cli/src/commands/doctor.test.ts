import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('@nebulord/sickbay-core', () => ({
  detectProject: vi.fn(),
  detectPackageManager: vi.fn().mockReturnValue('npm'),
}));

import { existsSync, readFileSync } from 'fs';
import { detectProject, detectPackageManager } from '@nebulord/sickbay-core';
import { runDiagnostics } from './doctor.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockDetectProject = vi.mocked(detectProject);
const mockDetectPackageManager = vi.mocked(detectPackageManager);

const PROJECT_PATH = '/test/project';

function makeProjectInfo(overrides: Record<string, unknown> = {}) {
  return {
    name: 'test-project',
    version: '1.0.0',
    framework: 'react',
    packageManager: 'npm',
    totalDependencies: 5,
    dependencies: {},
    devDependencies: {},
    hasESLint: true,
    hasPrettier: true,
    hasTypeScript: true,
    ...overrides,
  };
}

function makePackageJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    scripts: { lint: 'eslint .', test: 'vitest', build: 'tsc' },
    engines: { node: '>=18.0.0' },
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: all files exist, project info is complete
  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockReturnValue(makePackageJson() as never);
  mockDetectProject.mockResolvedValue(makeProjectInfo() as any);
  mockDetectPackageManager.mockReturnValue('npm');
});

describe('runDiagnostics', () => {
  it('returns an array of DiagnosticResult objects', async () => {
    const results = await runDiagnostics(PROJECT_PATH);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('label');
      expect(r).toHaveProperty('status');
      expect(r).toHaveProperty('message');
      expect(['pass', 'fail', 'warn']).toContain(r.status);
    }
  });

  describe('checkGitignore', () => {
    it('returns fail status when .gitignore does not exist', async () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('.gitignore')) return false;
        return true;
      });

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'gitignore');
      expect(check).toBeDefined();
      expect(check!.status).toBe('fail');
      expect(check!.message).toMatch(/no .gitignore/i);
    });

    it('returns pass when .gitignore contains all required entries', async () => {
      mockReadFileSync.mockImplementation((p: unknown, _enc: unknown) => {
        if (String(p).endsWith('.gitignore')) {
          return 'node_modules\n.env\ndist\n.DS_Store\n';
        }
        return makePackageJson();
      });

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'gitignore');
      expect(check!.status).toBe('pass');
    });

    it('returns warn when .gitignore is missing "dist"', async () => {
      mockReadFileSync.mockImplementation((p: unknown, _enc: unknown) => {
        if (String(p).endsWith('.gitignore')) {
          return 'node_modules\n.env\n.DS_Store\n'; // missing dist
        }
        return makePackageJson();
      });

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'gitignore');
      expect(check!.status).toBe('warn');
      expect(check!.message).toContain('dist');
    });

    it('returns warn when .gitignore is missing multiple entries', async () => {
      mockReadFileSync.mockImplementation((p: unknown, _enc: unknown) => {
        if (String(p).endsWith('.gitignore')) {
          return 'node_modules\n'; // missing .env, dist, .DS_Store
        }
        return makePackageJson();
      });

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'gitignore');
      expect(check!.status).toBe('warn');
    });
  });

  describe('checkEnginesField', () => {
    it('returns warn when package.json has no engines field', async () => {
      mockReadFileSync.mockImplementation((p: unknown, _enc: unknown) => {
        if (String(p).endsWith('package.json')) {
          return makePackageJson({ engines: undefined });
        }
        return 'node_modules\n.env\ndist\n.DS_Store\n';
      });

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'engines');
      expect(check!.status).toBe('warn');
      expect(check!.message).toMatch(/node.js version not specified/i);
    });

    it('returns pass when package.json has engines field', async () => {
      mockReadFileSync.mockImplementation((p: unknown, _enc: unknown) => {
        if (String(p).endsWith('package.json')) {
          return makePackageJson({ engines: { node: '>=18.0.0' } });
        }
        return 'node_modules\n.env\ndist\n.DS_Store\n';
      });

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'engines');
      expect(check!.status).toBe('pass');
    });
  });

  describe('checkNpmScripts', () => {
    it('returns fail when build and test scripts are missing', async () => {
      mockReadFileSync.mockImplementation((p: unknown, _enc: unknown) => {
        if (String(p).endsWith('package.json')) {
          return makePackageJson({ scripts: { lint: 'eslint .' } });
        }
        return 'node_modules\n.env\ndist\n.DS_Store\n';
      });

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'npm-scripts');
      expect(check!.status).toBe('fail');
      expect(check!.message).toContain('test');
      expect(check!.message).toContain('build');
    });

    it('returns warn when only lint script is missing', async () => {
      mockReadFileSync.mockImplementation((p: unknown, _enc: unknown) => {
        if (String(p).endsWith('package.json')) {
          return makePackageJson({ scripts: { test: 'vitest', build: 'tsc' } });
        }
        return 'node_modules\n.env\ndist\n.DS_Store\n';
      });

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'npm-scripts');
      expect(check!.status).toBe('warn');
    });

    it('returns pass when all essential scripts are present', async () => {
      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'npm-scripts');
      expect(check!.status).toBe('pass');
    });
  });

  describe('checkLockfile', () => {
    it('returns fail when no lockfile is found', async () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const path = String(p);
        if (
          path.endsWith('package-lock.json') ||
          path.endsWith('pnpm-lock.yaml') ||
          path.endsWith('yarn.lock') ||
          path.endsWith('bun.lockb') ||
          path.endsWith('bun.lock')
        ) {
          return false;
        }
        return true;
      });

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'lockfile');
      expect(check!.status).toBe('fail');
      expect(check!.message).toMatch(/no lockfile/i);
    });

    it('returns pass when pnpm-lock.yaml exists', async () => {
      mockExistsSync.mockReturnValue(true);
      mockDetectPackageManager.mockReturnValue('pnpm');

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'lockfile');
      expect(check!.status).toBe('pass');
    });
  });

  describe('checkPrettier', () => {
    it('returns warn when prettier is not configured', async () => {
      mockDetectProject.mockResolvedValue(makeProjectInfo({ hasPrettier: false }) as any);

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'prettier');
      expect(check!.status).toBe('warn');
    });

    it('returns pass when prettier is configured', async () => {
      mockDetectProject.mockResolvedValue(makeProjectInfo({ hasPrettier: true }) as any);

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'prettier');
      expect(check!.status).toBe('pass');
    });
  });

  describe('checkESLintConfig', () => {
    it('returns fail when eslint is not configured', async () => {
      mockDetectProject.mockResolvedValue(makeProjectInfo({ hasESLint: false }) as any);

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'eslint-config');
      expect(check!.status).toBe('fail');
    });

    it('returns pass when eslint is configured', async () => {
      mockDetectProject.mockResolvedValue(makeProjectInfo({ hasESLint: true }) as any);

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'eslint-config');
      expect(check!.status).toBe('pass');
    });
  });

  describe('checkReactVersions', () => {
    it('returns pass when project has no react dependency', async () => {
      mockReadFileSync.mockImplementation((p: unknown, _enc: unknown) => {
        if (String(p).endsWith('package.json')) {
          return makePackageJson({ dependencies: {}, devDependencies: {} });
        }
        return 'node_modules\n.env\ndist\n.DS_Store\n';
      });

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'react-versions');
      expect(check!.status).toBe('pass');
      expect(check!.message).toMatch(/not a react project/i);
    });

    it('returns fail when react and react-dom versions mismatch', async () => {
      mockReadFileSync.mockImplementation((p: unknown, _enc: unknown) => {
        if (String(p).endsWith('package.json')) {
          return makePackageJson({
            dependencies: { react: '^18.0.0', 'react-dom': '^17.0.0' },
          });
        }
        return 'node_modules\n.env\ndist\n.DS_Store\n';
      });

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'react-versions');
      expect(check!.status).toBe('fail');
      expect(check!.message).toMatch(/mismatch/i);
    });

    it('returns pass when react and react-dom versions match', async () => {
      mockReadFileSync.mockImplementation((p: unknown, _enc: unknown) => {
        if (String(p).endsWith('package.json')) {
          return makePackageJson({
            dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
          });
        }
        return 'node_modules\n.env\ndist\n.DS_Store\n';
      });

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'react-versions');
      expect(check!.status).toBe('pass');
    });

    it('returns warn when react is installed but react-dom is missing', async () => {
      mockReadFileSync.mockImplementation((p: unknown, _enc: unknown) => {
        if (String(p).endsWith('package.json')) {
          return makePackageJson({
            dependencies: { react: '^18.0.0' },
          });
        }
        return 'node_modules\n.env\ndist\n.DS_Store\n';
      });

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'react-versions');
      expect(check!.status).toBe('warn');
      expect(check!.message).toMatch(/react-dom missing/i);
    });
  });

  describe('checkNodeVersion', () => {
    it('returns warn when no version pinning file exists', async () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const path = String(p);
        if (
          path.endsWith('.nvmrc') ||
          path.endsWith('.node-version') ||
          path.endsWith('.tool-versions')
        ) {
          return false;
        }
        return true;
      });

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'node-version');
      expect(check!.status).toBe('warn');
    });

    it('returns pass when .nvmrc exists', async () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('.nvmrc')) return true;
        return true;
      });

      const results = await runDiagnostics(PROJECT_PATH);
      const check = results.find((r) => r.id === 'node-version');
      expect(check!.status).toBe('pass');
      expect(check!.message).toContain('.nvmrc');
    });
  });

  it('handles a check that throws by pushing a fail result', async () => {
    // Force readFileSync to throw so one of the checks blows up
    mockReadFileSync.mockImplementation(() => {
      throw new Error('permission denied');
    });

    const results = await runDiagnostics(PROJECT_PATH);
    // Should still return results (not re-throw), some will be fail
    expect(Array.isArray(results)).toBe(true);
    const fails = results.filter((r) => r.status === 'fail');
    expect(fails.length).toBeGreaterThan(0);
  });
});
