import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ReactBestPracticesAdvisor } from './react-best-practices.js';

import type { ProjectContext } from '../types.js';

vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

import { readdirSync, statSync, readFileSync, existsSync } from 'fs';

const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockExistsSync = vi.mocked(existsSync);

const reactContext: ProjectContext = {
  runtime: 'browser',
  frameworks: ['react'],
  buildTool: 'vite',
  testFramework: 'vitest',
};

const nextContext: ProjectContext = {
  runtime: 'browser',
  frameworks: ['next'],
  buildTool: 'webpack',
  testFramework: 'jest',
};

const nodeContext: ProjectContext = {
  runtime: 'node',
  frameworks: [],
  buildTool: 'tsc',
  testFramework: 'vitest',
};

function mockPackageJson(deps: Record<string, string> = {}, devDeps: Record<string, string> = {}) {
  const pkg = JSON.stringify({ dependencies: deps, devDependencies: devDeps });
  mockReadFileSync.mockImplementation(((path: string) => {
    if (path.endsWith('package.json')) return pkg;
    throw new Error('not found');
  }) as typeof readFileSync);
}

describe('ReactBestPracticesAdvisor', () => {
  let advisor: ReactBestPracticesAdvisor;

  beforeEach(() => {
    advisor = new ReactBestPracticesAdvisor();
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockReturnValue([] as never);
  });

  describe('applicability', () => {
    it('applies to react projects', () => {
      expect(advisor.isApplicableToContext(reactContext)).toBe(true);
    });

    it('applies to next projects', () => {
      expect(advisor.isApplicableToContext(nextContext)).toBe(true);
    });

    it('does not apply to node-only projects', () => {
      expect(advisor.isApplicableToContext(nodeContext)).toBe(false);
    });
  });

  describe('error boundaries', () => {
    it('recommends error boundaries when none detected', async () => {
      mockPackageJson({ react: '^19.0.0' });
      mockExistsSync.mockReturnValue(false);

      const recs = await advisor.run('/project', reactContext);

      const rec = recs.find((r) => r.id === 'react-error-boundary');
      expect(rec).toBeDefined();
      expect(rec?.severity).toBe('recommend');
    });

    it('skips when react-error-boundary is in deps', async () => {
      mockPackageJson({ react: '^19.0.0', 'react-error-boundary': '^4.0.0' });

      const recs = await advisor.run('/project', reactContext);

      expect(recs.find((r) => r.id === 'react-error-boundary')).toBeUndefined();
    });

    it('skips when ErrorBoundary component exists in source', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['ErrorBoundary.tsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as never);

      const content = 'export class ErrorBoundary extends Component {';
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { react: '^19.0.0' } });
        return content;
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', reactContext);

      expect(recs.find((r) => r.id === 'react-error-boundary')).toBeUndefined();
    });
  });

  describe('suspense', () => {
    it('suggests suspense when not used', async () => {
      mockPackageJson({ react: '^19.0.0' });
      mockExistsSync.mockReturnValue(false);

      const recs = await advisor.run('/project', reactContext);

      const rec = recs.find((r) => r.id === 'react-suspense');
      expect(rec).toBeDefined();
      expect(rec?.severity).toBe('suggest');
    });

    it('skips when Suspense is found in source', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['App.tsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as never);

      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { react: '^19.0.0' } });
        return '<Suspense fallback={<Loading />}>';
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', reactContext);

      expect(recs.find((r) => r.id === 'react-suspense')).toBeUndefined();
    });
  });

  describe('react compiler', () => {
    it('suggests react compiler when not in deps', async () => {
      mockPackageJson({ react: '^19.0.0' });

      const recs = await advisor.run('/project', reactContext);

      const rec = recs.find((r) => r.id === 'react-compiler');
      expect(rec).toBeDefined();
      expect(rec?.severity).toBe('suggest');
    });

    it('skips when babel-plugin-react-compiler is in deps', async () => {
      mockPackageJson({ react: '^19.0.0' }, { 'babel-plugin-react-compiler': '^1.0.0' });

      const recs = await advisor.run('/project', reactContext);

      expect(recs.find((r) => r.id === 'react-compiler')).toBeUndefined();
    });

    it('skips when @react-compiler/babel is in deps', async () => {
      mockPackageJson({ react: '^19.0.0' }, { '@react-compiler/babel': '^1.0.0' });

      const recs = await advisor.run('/project', reactContext);

      expect(recs.find((r) => r.id === 'react-compiler')).toBeUndefined();
    });
  });

  describe('strict mode', () => {
    it('recommends StrictMode when not found in entry files', async () => {
      mockPackageJson({ react: '^19.0.0' });

      const recs = await advisor.run('/project', reactContext);

      const rec = recs.find((r) => r.id === 'react-strict-mode');
      expect(rec).toBeDefined();
      expect(rec?.severity).toBe('recommend');
      expect(rec?.framework).toBe('react');
    });

    it('skips when StrictMode is in entry file', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { react: '^19.0.0' } });
        if (path.endsWith('src/main.tsx')) return '<StrictMode><App /></StrictMode>';
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', reactContext);

      expect(recs.find((r) => r.id === 'react-strict-mode')).toBeUndefined();
    });

    it('checks next.config.js for Next.js instead of entry files', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { next: '^15.0.0' } });
        if (path.endsWith('next.config.js')) return 'module.exports = { reactStrictMode: true }';
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', nextContext);

      expect(recs.find((r) => r.id === 'react-strict-mode')).toBeUndefined();
    });

    it('recommends StrictMode for Next.js when not in config', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { next: '^15.0.0' } });
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', nextContext);

      const rec = recs.find((r) => r.id === 'react-strict-mode');
      expect(rec).toBeDefined();
      expect(rec?.framework).toBe('next');
    });
  });

  describe('legacy ReactDOM.render', () => {
    it('recommends migration when ReactDOM.render is found', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { react: '^18.0.0' } });
        if (path.endsWith('src/index.tsx'))
          return "ReactDOM.render(<App />, document.getElementById('root'))";
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', reactContext);

      const rec = recs.find((r) => r.id === 'react-legacy-render');
      expect(rec).toBeDefined();
      expect(rec?.severity).toBe('recommend');
    });

    it('skips when using createRoot', async () => {
      mockPackageJson({ react: '^19.0.0' });

      const recs = await advisor.run('/project', reactContext);

      expect(recs.find((r) => r.id === 'react-legacy-render')).toBeUndefined();
    });

    it('skips legacy render check for Next.js projects', async () => {
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { next: '^15.0.0' } });
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', nextContext);

      expect(recs.find((r) => r.id === 'react-legacy-render')).toBeUndefined();
    });
  });

  describe('error resilience', () => {
    it('returns empty array when package.json is unreadable', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const recs = await advisor.run('/project', reactContext);

      expect(recs).toEqual([]);
    });
  });
});
