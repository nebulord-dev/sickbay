import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NextBestPracticesAdvisor } from './next-best-practices.js';

import type { ProjectContext } from '../types.js';

vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

import { readdirSync, readFileSync, existsSync } from 'fs';

const mockReaddirSync = vi.mocked(readdirSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockExistsSync = vi.mocked(existsSync);

const nextContext: ProjectContext = {
  runtime: 'browser',
  frameworks: ['next'],
  buildTool: 'webpack',
  testFramework: 'jest',
};

const reactContext: ProjectContext = {
  runtime: 'browser',
  frameworks: ['react'],
  buildTool: 'vite',
  testFramework: 'vitest',
};

describe('NextBestPracticesAdvisor', () => {
  let advisor: NextBestPracticesAdvisor;

  beforeEach(() => {
    advisor = new NextBestPracticesAdvisor();
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockReturnValue([] as never);
  });

  describe('applicability', () => {
    it('applies to next projects', () => {
      expect(advisor.isApplicableToContext(nextContext)).toBe(true);
    });

    it('does not apply to react-only projects', () => {
      expect(advisor.isApplicableToContext(reactContext)).toBe(false);
    });
  });

  describe('pages router', () => {
    it('suggests App Router when pages/ directory exists', async () => {
      mockExistsSync.mockImplementation(((path: string) => {
        return path.endsWith('pages');
      }) as typeof existsSync);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { next: '^14.0.0' } });
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', nextContext);
      expect(recs.find((r) => r.id === 'next-app-router')).toBeDefined();
    });

    it('skips when no pages/ directory', async () => {
      mockExistsSync.mockReturnValue(false);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { next: '^14.0.0' } });
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', nextContext);
      expect(recs.find((r) => r.id === 'next-app-router')).toBeUndefined();
    });
  });

  describe('turbopack', () => {
    it('suggests turbopack when not in dev script', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({
            dependencies: { next: '^14.0.0' },
            scripts: { dev: 'next dev' },
          });
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', nextContext);
      expect(recs.find((r) => r.id === 'next-turbopack')).toBeDefined();
    });

    it('skips when --turbopack is in dev script', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({
            dependencies: { next: '^14.0.0' },
            scripts: { dev: 'next dev --turbopack' },
          });
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', nextContext);
      expect(recs.find((r) => r.id === 'next-turbopack')).toBeUndefined();
    });
  });

  describe('metadata API', () => {
    it('recommends metadata API when no exports found in pages', async () => {
      mockExistsSync.mockImplementation(((path: string) => {
        return path.endsWith('app');
      }) as typeof existsSync);
      mockReaddirSync.mockImplementation(((dir: string) => {
        if (dir.endsWith('app'))
          return [{ name: 'page.tsx', isDirectory: () => false }] as unknown as ReturnType<
            typeof readdirSync
          >;
        return [] as unknown as ReturnType<typeof readdirSync>;
      }) as typeof readdirSync);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { next: '^14.0.0' } });
        return 'export default function Page() { return <div />; }';
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', nextContext);
      expect(recs.find((r) => r.id === 'next-metadata-api')).toBeDefined();
    });

    it('skips when export const metadata found', async () => {
      mockExistsSync.mockImplementation(((path: string) => {
        return path.endsWith('app');
      }) as typeof existsSync);
      mockReaddirSync.mockImplementation(((dir: string) => {
        if (dir.endsWith('app'))
          return [{ name: 'page.tsx', isDirectory: () => false }] as unknown as ReturnType<
            typeof readdirSync
          >;
        return [] as unknown as ReturnType<typeof readdirSync>;
      }) as typeof readdirSync);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { next: '^14.0.0' } });
        return "export const metadata = { title: 'Home' };\nexport default function Page() {}";
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', nextContext);
      expect(recs.find((r) => r.id === 'next-metadata-api')).toBeUndefined();
    });
  });

  describe('strict mode', () => {
    it('recommends strict mode when not in config', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { next: '^14.0.0' } });
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', nextContext);
      const rec = recs.find((r) => r.id === 'next-strict-mode');
      expect(rec).toBeDefined();
      expect(rec?.severity).toBe('recommend');
    });

    it('skips when reactStrictMode is true in config', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { next: '^14.0.0' } });
        if (path.endsWith('next.config.js')) return 'module.exports = { reactStrictMode: true }';
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', nextContext);
      expect(recs.find((r) => r.id === 'next-strict-mode')).toBeUndefined();
    });
  });

  describe('error resilience', () => {
    it('returns empty array when package.json is unreadable', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const recs = await advisor.run('/project', nextContext);
      expect(recs).toEqual([]);
    });
  });
});
