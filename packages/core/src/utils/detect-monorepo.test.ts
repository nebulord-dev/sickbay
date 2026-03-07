import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock globby
vi.mock('globby', () => ({
  globby: vi.fn(),
}));

// Mock detect-project to avoid real file I/O
vi.mock('./detect-project.js', () => ({
  detectPackageManager: vi.fn(() => 'pnpm'),
}));

import { existsSync, readFileSync } from 'fs';
import { globby } from 'globby';
import { detectMonorepo } from './detect-monorepo.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockGlobby = vi.mocked(globby);

const ROOT = '/project';

function setupGlobby(paths: string[]) {
  mockGlobby.mockResolvedValue(paths as never);
}

function packageJsonAt(...paths: string[]) {
  mockExistsSync.mockImplementation((p) => {
    const s = String(p);
    return paths.some((allowed) => s === allowed || s === allowed + '/package.json') ||
      paths.some((dir) => s === `${dir}/package.json`) ||
      s === `${ROOT}/package.json`;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
  mockReadFileSync.mockReturnValue('{}' as never);
  mockGlobby.mockResolvedValue([] as never);
});

describe('detectMonorepo', () => {
  describe('pnpm-workspace.yaml detection', () => {
    it('detects pnpm workspace from pnpm-workspace.yaml', async () => {
      mockExistsSync.mockImplementation((p) => {
        const s = String(p);
        return s === `${ROOT}/pnpm-workspace.yaml` ||
               s === `${ROOT}/packages/pkg-a/package.json` ||
               s === `${ROOT}/packages/pkg-b/package.json`;
      });
      mockReadFileSync.mockReturnValue(
        'packages:\n  - packages/*\n' as never,
      );
      setupGlobby([`${ROOT}/packages/pkg-a`, `${ROOT}/packages/pkg-b`]);

      const result = await detectMonorepo(ROOT);

      expect(result.isMonorepo).toBe(true);
      if (!result.isMonorepo) return;
      expect(result.type).toBe('pnpm');
      expect(result.packageManager).toBe('pnpm');
      expect(result.packagePaths).toEqual([`${ROOT}/packages/pkg-a`, `${ROOT}/packages/pkg-b`]);
    });

    it('falls back to default patterns when pnpm-workspace.yaml has no packages key', async () => {
      mockExistsSync.mockImplementation((p) => {
        const s = String(p);
        return s === `${ROOT}/pnpm-workspace.yaml` ||
               s === `${ROOT}/packages/a/package.json`;
      });
      mockReadFileSync.mockReturnValue('catalog:\n  react: ^18\n' as never);
      setupGlobby([`${ROOT}/packages/a`]);

      const result = await detectMonorepo(ROOT);
      expect(result.isMonorepo).toBe(true);
    });

    it('parses quoted glob patterns in pnpm-workspace.yaml', async () => {
      mockExistsSync.mockImplementation((p) => {
        const s = String(p);
        return s === `${ROOT}/pnpm-workspace.yaml` ||
               s === `${ROOT}/apps/web/package.json`;
      });
      mockReadFileSync.mockReturnValue(
        "packages:\n  - 'packages/*'\n  - 'apps/*'\n" as never,
      );
      setupGlobby([`${ROOT}/apps/web`]);

      const result = await detectMonorepo(ROOT);
      expect(result.isMonorepo).toBe(true);
      if (!result.isMonorepo) return;
      expect(mockGlobby).toHaveBeenCalledWith(
        expect.arrayContaining(["packages/*", "apps/*"]),
        expect.any(Object),
      );
    });
  });

  describe('package.json workspaces detection', () => {
    it('detects npm workspaces', async () => {
      mockExistsSync.mockImplementation((p) => {
        const s = String(p);
        return s === `${ROOT}/package.json` ||
               s === `${ROOT}/packages/core/package.json`;
      });
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ workspaces: ['packages/*'] }) as never,
      );
      setupGlobby([`${ROOT}/packages/core`]);

      const result = await detectMonorepo(ROOT);
      expect(result.isMonorepo).toBe(true);
      if (!result.isMonorepo) return;
      expect(result.type).toBe('npm');
    });

    it('detects yarn workspaces', async () => {
      mockExistsSync.mockImplementation((p) => {
        const s = String(p);
        return s === `${ROOT}/package.json` ||
               s === `${ROOT}/yarn.lock` ||
               s === `${ROOT}/packages/core/package.json`;
      });
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ workspaces: ['packages/*'] }) as never,
      );
      setupGlobby([`${ROOT}/packages/core`]);

      const result = await detectMonorepo(ROOT);
      expect(result.isMonorepo).toBe(true);
      if (!result.isMonorepo) return;
      expect(result.type).toBe('yarn');
    });

    it('detects turbo when turbo.json is present alongside workspaces', async () => {
      mockExistsSync.mockImplementation((p) => {
        const s = String(p);
        return s === `${ROOT}/package.json` ||
               s === `${ROOT}/turbo.json` ||
               s === `${ROOT}/packages/a/package.json`;
      });
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ workspaces: ['packages/*'] }) as never,
      );
      setupGlobby([`${ROOT}/packages/a`]);

      const result = await detectMonorepo(ROOT);
      expect(result.isMonorepo).toBe(true);
      if (!result.isMonorepo) return;
      expect(result.type).toBe('turbo');
    });

    it('handles workspaces.packages object form', async () => {
      mockExistsSync.mockImplementation((p) => {
        const s = String(p);
        return s === `${ROOT}/package.json` ||
               s === `${ROOT}/packages/a/package.json`;
      });
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ workspaces: { packages: ['packages/*'] } }) as never,
      );
      setupGlobby([`${ROOT}/packages/a`]);

      const result = await detectMonorepo(ROOT);
      expect(result.isMonorepo).toBe(true);
    });
  });

  describe('lerna.json detection', () => {
    it('detects lerna monorepo', async () => {
      mockExistsSync.mockImplementation((p) => {
        const s = String(p);
        return s === `${ROOT}/lerna.json` ||
               s === `${ROOT}/packages/alpha/package.json`;
      });
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ version: '1.0.0', packages: ['packages/*'] }) as never,
      );
      setupGlobby([`${ROOT}/packages/alpha`]);

      const result = await detectMonorepo(ROOT);
      expect(result.isMonorepo).toBe(true);
      if (!result.isMonorepo) return;
      expect(result.type).toBe('lerna');
    });
  });

  describe('turbo.json / nx.json standalone detection', () => {
    it('detects turbo without package.json workspaces', async () => {
      mockExistsSync.mockImplementation((p) => {
        const s = String(p);
        return s === `${ROOT}/turbo.json` ||
               s === `${ROOT}/packages/a/package.json`;
      });
      setupGlobby([`${ROOT}/packages/a`]);

      const result = await detectMonorepo(ROOT);
      expect(result.isMonorepo).toBe(true);
      if (!result.isMonorepo) return;
      expect(result.type).toBe('turbo');
    });

    it('detects nx without package.json workspaces', async () => {
      mockExistsSync.mockImplementation((p) => {
        const s = String(p);
        return s === `${ROOT}/nx.json` ||
               s === `${ROOT}/libs/shared/package.json`;
      });
      setupGlobby([`${ROOT}/libs/shared`]);

      const result = await detectMonorepo(ROOT);
      expect(result.isMonorepo).toBe(true);
      if (!result.isMonorepo) return;
      expect(result.type).toBe('nx');
    });
  });

  describe('non-monorepo cases', () => {
    it('returns isMonorepo: false when no signals found', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await detectMonorepo(ROOT);
      expect(result.isMonorepo).toBe(false);
    });

    it('returns isMonorepo: false when signals found but no packages have package.json', async () => {
      mockExistsSync.mockImplementation((p) => {
        const s = String(p);
        // workspace.yaml exists but discovered dirs have no package.json
        return s === `${ROOT}/pnpm-workspace.yaml`;
      });
      mockReadFileSync.mockReturnValue('packages:\n  - packages/*\n' as never);
      // globby returns dirs, but none have package.json (existsSync returns false for those)
      setupGlobby([`${ROOT}/packages/empty-dir`]);

      const result = await detectMonorepo(ROOT);
      expect(result.isMonorepo).toBe(false);
    });

    it('returns isMonorepo: false when globby finds no directories', async () => {
      mockExistsSync.mockImplementation((p) => String(p) === `${ROOT}/pnpm-workspace.yaml`);
      mockReadFileSync.mockReturnValue('packages:\n  - packages/*\n' as never);
      setupGlobby([]);

      const result = await detectMonorepo(ROOT);
      expect(result.isMonorepo).toBe(false);
    });

    it('excludes the root itself from package paths', async () => {
      mockExistsSync.mockImplementation((p) => {
        const s = String(p);
        return s === `${ROOT}/pnpm-workspace.yaml` ||
               s === `${ROOT}/package.json` ||
               s === `${ROOT}/packages/a/package.json`;
      });
      mockReadFileSync.mockReturnValue('packages:\n  - packages/*\n' as never);
      // globby returns root + a subpackage
      setupGlobby([ROOT, `${ROOT}/packages/a`]);

      const result = await detectMonorepo(ROOT);
      expect(result.isMonorepo).toBe(true);
      if (!result.isMonorepo) return;
      expect(result.packagePaths).not.toContain(ROOT);
      expect(result.packagePaths).toContain(`${ROOT}/packages/a`);
    });
  });
});
