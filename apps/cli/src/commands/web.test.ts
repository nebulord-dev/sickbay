import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { SickbayReport } from 'sickbay-core';

// We need to mock 'fs' before the module loads so that findWebDist() can be
// controlled. The module calls existsSync at call time (not import time), so a
// factory mock is fine here.
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

const mockLoadConfig = vi.fn();
vi.mock('sickbay-core', () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}));

import { existsSync, readFileSync } from 'fs';
import { resolve as pathResolve } from 'path';

import { serveWeb, resolveSafeStaticPath } from './web.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

// Minimal stub that satisfies the SickbayReport type
function makeReport(overrides: Partial<SickbayReport> = {}): SickbayReport {
  return {
    timestamp: '2024-01-01T00:00:00.000Z',
    projectPath: '/test/project',
    projectInfo: {
      name: 'test-project',
      version: '1.0.0',
      framework: 'react',
      packageManager: 'npm',
      totalDependencies: 0,
      dependencies: {},
      devDependencies: {},
      hasESLint: false,
      hasPrettier: false,
      hasTypeScript: false,
    },
    checks: [],
    overallScore: 85,
    summary: { critical: 0, warnings: 0, info: 0 },
    ...overrides,
  };
}

// Make existsSync return true for index.html so findWebDist() succeeds,
// but false for actual static file requests so the SPA fallback fires.
function setupWebDistFound() {
  mockExistsSync.mockImplementation((p: unknown) => {
    // findWebDist checks for index.html inside candidate dirs — return true so
    // the dist dir is considered found.
    if (String(p).endsWith('index.html')) return true;
    // For all other static file checks (in the request handler), return false
    // so we fall through to the SPA fallback rather than trying to read a real file.
    return false;
  });

  // SPA fallback reads index.html — return minimal HTML
  mockReadFileSync.mockReturnValue(Buffer.from('<html><body>ok</body></html>'));
}

// Track servers to close them after each test
const openServers: Promise<string>[] = [];

afterEach(async () => {
  vi.clearAllMocks();
  openServers.length = 0;
});

describe('serveWeb', () => {
  describe('when web dist is not found', () => {
    it('throws an error when index.html does not exist in any candidate dir', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(serveWeb(makeReport(), 0)).rejects.toThrow(/web dashboard assets not found/i);
    });
  });

  describe('when web dist is found', () => {
    beforeEach(() => {
      setupWebDistFound();
    });

    it('returns a URL string starting with http://localhost:', async () => {
      const url = await serveWeb(makeReport(), 0);
      expect(url).toMatch(/^http:\/\/localhost:\d+$/);
    });

    it('/sickbay-report.json returns the report as JSON', async () => {
      const report = makeReport({ overallScore: 72 });
      const url = await serveWeb(report, 0);

      const res = await fetch(`${url}/sickbay-report.json`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');

      const data = (await res.json()) as SickbayReport;
      expect(data.overallScore).toBe(72);
      expect(data.projectPath).toBe('/test/project');
    });

    it('/sickbay-report.json returns all check data', async () => {
      const report = makeReport({
        checks: [
          {
            id: 'eslint',
            name: 'ESLint',
            category: 'code-quality',
            score: 90,
            status: 'pass',
            issues: [],
            toolsUsed: ['eslint'],
            duration: 100,
          },
        ],
      });
      const url = await serveWeb(report, 0);

      const res = await fetch(`${url}/sickbay-report.json`);
      const data = (await res.json()) as SickbayReport;
      expect(data.checks).toHaveLength(1);
      expect(data.checks[0].id).toBe('eslint');
    });

    it('/sickbay-dep-tree.json returns 200 with cached file content when file exists', async () => {
      const depTree = { name: 'test-project', dependencies: { react: '^18.0.0' } };
      mockExistsSync.mockImplementation((p: unknown) => {
        const s = String(p);
        if (s.endsWith('index.html')) return true;
        if (s.endsWith('dep-tree.json')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: unknown) => {
        const s = String(p);
        if (s.endsWith('dep-tree.json')) return Buffer.from(JSON.stringify(depTree));
        return Buffer.from('<html><body>ok</body></html>');
      });

      const url = await serveWeb(makeReport(), 0);

      const res = await fetch(`${url}/sickbay-dep-tree.json`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');

      const data = (await res.json()) as { name: string; dependencies: Record<string, string> };
      expect(data.name).toBe('test-project');
      expect(data.dependencies.react).toBe('^18.0.0');
    });

    it('/sickbay-dep-tree.json returns 404 when no cache exists', async () => {
      const url = await serveWeb(makeReport(), 0);

      const res = await fetch(`${url}/sickbay-dep-tree.json`);
      expect(res.status).toBe(404);
    });

    it('/ai/summary returns 404 when no aiService provided', async () => {
      const url = await serveWeb(makeReport(), 0);

      const res = await fetch(`${url}/ai/summary`);
      expect(res.status).toBe(404);
    });

    it('/ai/summary returns AI summary when aiService provided', async () => {
      const mockAiService = {
        generateSummary: vi.fn().mockResolvedValue('Great project health!'),
        chat: vi.fn(),
      };

      const url = await serveWeb(makeReport(), 0, mockAiService as any);

      const res = await fetch(`${url}/ai/summary`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { summary: string };
      expect(data.summary).toBe('Great project health!');
      expect(mockAiService.generateSummary).toHaveBeenCalledOnce();
    });

    it('/ai/chat POST calls aiService.chat and returns response', async () => {
      const mockAiService = {
        generateSummary: vi.fn().mockResolvedValue(null),
        chat: vi.fn().mockResolvedValue('Here are my insights.'),
      };

      const url = await serveWeb(makeReport(), 0, mockAiService as any);

      const res = await fetch(`${url}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'What can I improve?', history: [] }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as { response: string };
      expect(data.response).toBe('Here are my insights.');
      expect(mockAiService.chat).toHaveBeenCalledWith(
        'What can I improve?',
        expect.objectContaining({ overallScore: 85 }),
        [],
      );
    });

    it('/ai/chat POST returns 500 when aiService.chat throws', async () => {
      const mockAiService = {
        generateSummary: vi.fn().mockResolvedValue(null),
        chat: vi.fn().mockRejectedValue(new Error('API rate limit')),
      };

      const url = await serveWeb(makeReport(), 0, mockAiService as any);

      const res = await fetch(`${url}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Help?', history: [] }),
      });

      expect(res.status).toBe(500);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain('API rate limit');
    });

    it('/sickbay-config.json returns 200 with config data when config file exists', async () => {
      const configData = { checks: { knip: false }, weights: { security: 0.5 } };
      mockLoadConfig.mockResolvedValue(configData);

      const url = await serveWeb(makeReport(), 0);

      const res = await fetch(`${url}/sickbay-config.json`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');

      const data = (await res.json()) as {
        checks: Record<string, boolean>;
        weights: Record<string, number>;
      };
      expect(data.checks.knip).toBe(false);
      expect(data.weights.security).toBe(0.5);
    });

    it('/sickbay-config.json returns 404 when no config file found', async () => {
      mockLoadConfig.mockResolvedValue(null);

      const url = await serveWeb(makeReport(), 0);

      const res = await fetch(`${url}/sickbay-config.json`);
      expect(res.status).toBe(404);
    });

    it('/sickbay-config.json returns 500 when loadConfig throws', async () => {
      mockLoadConfig.mockRejectedValue(new Error('jiti parse error'));

      const url = await serveWeb(makeReport(), 0);

      const res = await fetch(`${url}/sickbay-config.json`);
      expect(res.status).toBe(500);
    });

    it('serves an existing static file with the correct content-type', async () => {
      // Override: existsSync returns true for everything so static file branch fires (L112-115)
      mockExistsSync.mockImplementation(() => true);
      mockReadFileSync.mockReturnValue(Buffer.from('console.log("hello")'));

      const url = await serveWeb(makeReport(), 0);

      const res = await fetch(`${url}/assets/app.js`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('javascript');
    });

    it('unknown routes return the SPA fallback (index.html)', async () => {
      const url = await serveWeb(makeReport(), 0);

      const res = await fetch(`${url}/some/deep/route`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('<html');
    });

    it('strips query strings before resolving static paths', async () => {
      // Previously the raw `url` (including ?query) was passed to join(), which
      // meant `/app.js?v=1` would look for a literal file named `app.js?v=1`
      // and always 404. Now pathname is used, so this serves the real file.
      mockExistsSync.mockImplementation((p: unknown) => {
        const s = String(p);
        return s.endsWith('index.html') || s.endsWith('app.js');
      });
      mockReadFileSync.mockImplementation((p: unknown) => {
        const s = String(p);
        if (s.endsWith('app.js')) return Buffer.from('console.log("hi")');
        return Buffer.from('<html></html>');
      });

      const url = await serveWeb(makeReport(), 0);
      const res = await fetch(`${url}/app.js?v=cachebuster`);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('javascript');
    });

    it('/ai/chat POST returns a generic error message when a non-Error is thrown', async () => {
      // A bare string throw shouldn't reveal its content in the HTTP response.
      const mockAiService = {
        generateSummary: vi.fn().mockResolvedValue(null),
        chat: vi.fn().mockImplementation(() => {
          // eslint-disable-next-line no-throw-literal -- intentional for this test
          throw 'internal database password abc123';
        }),
      };

      const url = await serveWeb(makeReport(), 0, mockAiService as any);
      const res = await fetch(`${url}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hi', history: [] }),
      });

      expect(res.status).toBe(500);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('Internal error');
      expect(data.error).not.toContain('password');
    });

    it('generateSummary failure does not prevent the server from starting', async () => {
      const mockAiService = {
        generateSummary: vi.fn().mockRejectedValue(new Error('AI unavailable')),
        chat: vi.fn(),
      };

      // Should not throw even though generateSummary fails
      const url = await serveWeb(makeReport(), 0, mockAiService as any);
      expect(url).toMatch(/^http:\/\/localhost:\d+$/);
    });
  });
});

// Direct unit tests for the safe-path resolver. Request-level tests can't
// exercise most traversal payloads because `new URL()` strips `..` segments
// upstream, but a broken implementation of this helper (or any future caller
// that bypasses the URL parser) would re-open the attack surface. These
// tests lock the helper's behavior independently of the HTTP layer.
describe('resolveSafeStaticPath', () => {
  // Use a synthetic absolute base dir — path.resolve handles both POSIX and Win32.
  const BASE = pathResolve('/fake/dist');

  it('resolves a simple relative path inside baseDir', () => {
    const result = resolveSafeStaticPath(BASE, '/index.html');
    expect(result).toBe(pathResolve(BASE, 'index.html'));
  });

  it('resolves a nested path inside baseDir', () => {
    const result = resolveSafeStaticPath(BASE, '/assets/app.js');
    expect(result).toBe(pathResolve(BASE, 'assets/app.js'));
  });

  it('rejects `..` traversal that escapes baseDir', () => {
    expect(resolveSafeStaticPath(BASE, '../../etc/passwd')).toBeNull();
  });

  it('rejects `..` traversal with leading slash', () => {
    expect(resolveSafeStaticPath(BASE, '/../../etc/passwd')).toBeNull();
  });

  it('rejects URL-encoded `..` traversal (%2e%2e)', () => {
    expect(resolveSafeStaticPath(BASE, '/%2e%2e/%2e%2e/etc/passwd')).toBeNull();
  });

  it('rejects mixed-case URL-encoded traversal', () => {
    expect(resolveSafeStaticPath(BASE, '/%2E%2e/%2E%2E/etc/passwd')).toBeNull();
  });

  it('rejects null bytes', () => {
    expect(resolveSafeStaticPath(BASE, '/legit.js%00.png')).toBeNull();
  });

  it('rejects malformed URI encoding', () => {
    expect(resolveSafeStaticPath(BASE, '/%ZZ')).toBeNull();
  });

  it('accepts paths that look like traversal but resolve inside baseDir', () => {
    // `foo/../bar` resolves to `bar`, which is inside baseDir.
    const result = resolveSafeStaticPath(BASE, '/foo/../bar.js');
    expect(result).toBe(pathResolve(BASE, 'bar.js'));
  });
});
