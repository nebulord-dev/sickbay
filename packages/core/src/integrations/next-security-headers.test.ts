import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NextSecurityHeadersRunner } from './next-security-headers.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
}));

import { existsSync, readFileSync } from 'fs';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('NextSecurityHeadersRunner', () => {
  let runner: NextSecurityHeadersRunner;

  beforeEach(() => {
    runner = new NextSecurityHeadersRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for next only', () => {
    expect(runner.applicableFrameworks).toEqual(['next']);
    expect(runner.category).toBe('security');
    expect(runner.name).toBe('next-security-headers');
  });

  it('returns fail with score 0 when no config file exists', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await runner.run('/project');
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('critical');
    expect(result.issues[0].message).toContain('No Next.js config file found');
    expect(result.metadata?.configFile).toBeNull();
    expect(result.metadata?.hasHeaders).toBe(false);
  });

  it('returns warning with score 30 when config exists but has no async headers()', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('module.exports = {};');
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.score).toBe(30);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('missing async headers()');
    expect(result.metadata?.configFile).toBeTruthy();
    expect(result.metadata?.hasHeaders).toBe(false);
  });

  it('does not trigger headers() detection on comments containing "headers"', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('// no response headers configured\nmodule.exports = {};');
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.score).toBe(30);
    expect(result.issues[0].message).toContain('missing async headers()');
  });

  it('returns pass with score 100 when config has async headers() with all 4 header names', async () => {
    mockExistsSync.mockReturnValue(true);
    const content = `
      export default {
        async headers() {
          return [
            {
              source: '/:path*',
              headers: [
                { key: 'Content-Security-Policy', value: "default-src 'self'" },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
              ]
            }
          ]
        }
      }
    `;
    mockReadFileSync.mockReturnValue(content);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.metadata?.hasHeaders).toBe(true);
    expect(result.metadata?.missingHeaders).toEqual([]);
  });

  it('returns warning with missing header issues when some headers absent', async () => {
    mockExistsSync.mockReturnValue(true);
    const content = `
      export default {
        async headers() {
          return [
            {
              source: '/:path*',
              headers: [
                { key: 'X-Frame-Options', value: 'DENY' }
              ]
            }
          ]
        }
      }
    `;
    mockReadFileSync.mockReturnValue(content);
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues.length).toBeGreaterThan(0);
    const messages = result.issues.map((i) => i.message);
    expect(messages.some((m) => m.includes('Content-Security-Policy'))).toBe(true);
    expect(messages.some((m) => m.includes('X-Content-Type-Options'))).toBe(true);
    expect(messages.some((m) => m.includes('Referrer-Policy'))).toBe(true);
  });

  it('scores correctly: 0 missing → 100, 1 missing → 85, 2 missing → 70, 4 missing → 40 (floor)', async () => {
    for (const [missing, expected] of [
      [0, 100],
      [1, 85],
      [2, 70],
      [4, 40],
    ] as [number, number][]) {
      vi.clearAllMocks();
      mockExistsSync.mockReturnValue(true);

      // Create content with all 4 headers, then remove `missing` count from the end
      const allHeaders = [
        "{ key: 'Content-Security-Policy', value: '' }",
        "{ key: 'X-Frame-Options', value: '' }",
        "{ key: 'X-Content-Type-Options', value: '' }",
        "{ key: 'Referrer-Policy', value: '' }",
      ];
      const headers = allHeaders.slice(0, 4 - missing).join(',\n');
      const content = `
        export default {
          async headers() {
            return [{
              source: '/:path*',
              headers: [${headers}]
            }]
          }
        }
      `;
      mockReadFileSync.mockReturnValue(content);

      const result = await runner.run('/project');
      expect(result.score).toBe(expected);
    }
  });

  it('returns fail status when an unexpected error is thrown', async () => {
    mockExistsSync.mockImplementation(() => {
      throw new Error('disk error');
    });
    const result = await runner.run('/project');
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.issues[0].severity).toBe('critical');
    expect(result.issues[0].message).toContain('Check failed');
  });

  it('checks config files in order: js, mjs, ts', async () => {
    mockExistsSync.mockImplementation((path: any) => {
      return path.toString().includes('next.config.mjs');
    });
    mockReadFileSync.mockReturnValue('export default { async headers() {} }');
    await runner.run('/project');
    expect(mockExistsSync).toHaveBeenCalledWith(expect.stringContaining('next.config.js'));
    expect(mockExistsSync).toHaveBeenCalledWith(expect.stringContaining('next.config.mjs'));
  });

  it('includes all 4 header names in missing headers when async headers() exists but is empty', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('export default { async headers() { return []; } }');
    const result = await runner.run('/project');
    expect(result.metadata?.missingHeaders).toEqual([
      'Content-Security-Policy',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy',
    ]);
    expect(result.issues).toHaveLength(4);
  });
});
