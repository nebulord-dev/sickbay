import { describe, it, expect, vi, beforeEach } from 'vitest';

import { UniversalBestPracticesAdvisor } from './universal-best-practices.js';

import type { ProjectContext } from '../types.js';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

import { readFileSync, existsSync } from 'fs';

const mockReadFileSync = vi.mocked(readFileSync);
const mockExistsSync = vi.mocked(existsSync);

const anyContext: ProjectContext = {
  runtime: 'node',
  frameworks: [],
  buildTool: 'tsc',
  testFramework: 'vitest',
};

const reactContext: ProjectContext = {
  runtime: 'browser',
  frameworks: ['react'],
  buildTool: 'vite',
  testFramework: 'vitest',
};

describe('UniversalBestPracticesAdvisor', () => {
  let advisor: UniversalBestPracticesAdvisor;

  beforeEach(() => {
    advisor = new UniversalBestPracticesAdvisor();
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  describe('applicability', () => {
    it('applies to all projects (empty frameworks array)', () => {
      expect(advisor.isApplicableToContext(anyContext)).toBe(true);
    });

    it('applies to react projects too', () => {
      expect(advisor.isApplicableToContext(reactContext)).toBe(true);
    });
  });

  describe('node version pinning', () => {
    it('recommends version pinning when no .nvmrc, .node-version, or engines.node', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json')) return JSON.stringify({});
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', anyContext);
      const rec = recs.find((r) => r.id === 'universal-node-version');
      expect(rec).toBeDefined();
      expect(rec?.severity).toBe('recommend');
    });

    it('skips when .nvmrc exists', async () => {
      mockExistsSync.mockImplementation(((path: string) => {
        return path.endsWith('.nvmrc');
      }) as typeof existsSync);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json')) return JSON.stringify({});
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', anyContext);
      expect(recs.find((r) => r.id === 'universal-node-version')).toBeUndefined();
    });

    it('skips when engines.node in package.json', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json')) return JSON.stringify({ engines: { node: '>=20' } });
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', anyContext);
      expect(recs.find((r) => r.id === 'universal-node-version')).toBeUndefined();
    });
  });

  describe('editorconfig', () => {
    it('suggests editorconfig when missing', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json')) return JSON.stringify({});
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', anyContext);
      expect(recs.find((r) => r.id === 'universal-editorconfig')).toBeDefined();
    });

    it('skips when .editorconfig exists', async () => {
      mockExistsSync.mockImplementation(((path: string) => {
        return path.endsWith('.editorconfig');
      }) as typeof existsSync);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json')) return JSON.stringify({});
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', anyContext);
      expect(recs.find((r) => r.id === 'universal-editorconfig')).toBeUndefined();
    });
  });

  describe('engines field', () => {
    it('suggests engines when missing', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json')) return JSON.stringify({});
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', anyContext);
      expect(recs.find((r) => r.id === 'universal-engines')).toBeDefined();
    });

    it('skips when engines present', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json')) return JSON.stringify({ engines: { node: '>=20' } });
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', anyContext);
      expect(recs.find((r) => r.id === 'universal-engines')).toBeUndefined();
    });
  });

  describe('packageManager field', () => {
    it('suggests packageManager when missing', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json')) return JSON.stringify({});
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', anyContext);
      expect(recs.find((r) => r.id === 'universal-package-manager')).toBeDefined();
    });

    it('skips when packageManager present', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json')) return JSON.stringify({ packageManager: 'pnpm@9.0.0' });
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', anyContext);
      expect(recs.find((r) => r.id === 'universal-package-manager')).toBeUndefined();
    });
  });

  describe('license file', () => {
    it('recommends LICENSE when missing', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json')) return JSON.stringify({});
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', anyContext);
      const rec = recs.find((r) => r.id === 'universal-license');
      expect(rec).toBeDefined();
      expect(rec?.severity).toBe('recommend');
    });

    it('skips when LICENSE file exists', async () => {
      mockExistsSync.mockImplementation(((path: string) => {
        return path.endsWith('LICENSE');
      }) as typeof existsSync);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json')) return JSON.stringify({});
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', anyContext);
      expect(recs.find((r) => r.id === 'universal-license')).toBeUndefined();
    });
  });

  describe('conflicting lock files', () => {
    it('recommends cleanup when multiple lock files found', async () => {
      mockExistsSync.mockImplementation(((path: string) => {
        return path.endsWith('package-lock.json') || path.endsWith('pnpm-lock.yaml');
      }) as typeof existsSync);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json')) return JSON.stringify({});
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', anyContext);
      const rec = recs.find((r) => r.id === 'universal-conflicting-lockfiles');
      expect(rec).toBeDefined();
      expect(rec?.severity).toBe('recommend');
      expect(rec?.message).toContain('package-lock.json');
      expect(rec?.message).toContain('pnpm-lock.yaml');
    });

    it('skips when only one lock file present', async () => {
      mockExistsSync.mockImplementation(((path: string) => {
        return path.endsWith('pnpm-lock.yaml');
      }) as typeof existsSync);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json')) return JSON.stringify({});
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', anyContext);
      expect(recs.find((r) => r.id === 'universal-conflicting-lockfiles')).toBeUndefined();
    });
  });

  describe('error resilience', () => {
    it('returns empty array when package.json is unreadable', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const recs = await advisor.run('/project', anyContext);
      expect(recs).toEqual([]);
    });
  });
});
