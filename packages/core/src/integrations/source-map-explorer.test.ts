import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SourceMapExplorerRunner } from './source-map-explorer.js';

vi.mock('execa', () => ({ execa: vi.fn() }));
vi.mock('globby', () => ({ globby: vi.fn() }));
vi.mock('fs', () => ({ statSync: vi.fn(), readFileSync: vi.fn() }));
vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  fileExists: vi.fn(),
  isCommandAvailable: vi.fn(),
  coreLocalDir: '/fake/core',
  parseJsonOutput: (str: string, fallback: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return JSON.parse(fallback);
    }
  },
}));

import { statSync, readFileSync } from 'fs';

import { execa } from 'execa';
import { globby } from 'globby';

import { fileExists, isCommandAvailable } from '../utils/file-helpers.js';

const mockExeca = vi.mocked(execa);
const mockGlobby = vi.mocked(globby);
const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockFileExists = vi.mocked(fileExists);
const mockIsCommandAvailable = vi.mocked(isCommandAvailable);

const KB = 1024;
const MB = 1024 * 1024;

describe('SourceMapExplorerRunner', () => {
  let runner: SourceMapExplorerRunner;

  beforeEach(() => {
    runner = new SourceMapExplorerRunner();
    vi.clearAllMocks();
    // Default: no index.html — falls back to total bundle measurement
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
  });

  it('only applies to browser runtime', () => {
    expect(runner.applicableRuntimes).toContain('browser');
  });

  describe('run — fallback path (no source maps)', () => {
    beforeEach(() => {
      // dist exists, build does not
      mockFileExists.mockImplementation((_root, dir) => dir === 'dist');
    });

    it('returns pass with score 100 when total JS size is under 500KB', async () => {
      // No source maps
      mockGlobby
        .mockResolvedValueOnce([]) // **/*.js.map → empty
        .mockResolvedValueOnce(['/project/dist/main.js']); // **/*.js

      mockStatSync.mockReturnValue({ size: 200 * KB } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
      expect(result.id).toBe('source-map-explorer');
    });

    it('returns warning with score 70 when total JS size is between 500KB and 1MB', async () => {
      mockGlobby
        .mockResolvedValueOnce([]) // no source maps
        .mockResolvedValueOnce(['/project/dist/main.js', '/project/dist/vendor.js']);

      // 300KB + 300KB = 600KB total (over 500KB, under 1MB)
      mockStatSync.mockReturnValue({ size: 300 * KB } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('warning');
      expect(result.score).toBe(70);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe('warning');
      expect(result.issues[0].message).toContain('KB');
    });

    it('returns fail with score 40 when total JS size exceeds 1MB', async () => {
      mockGlobby
        .mockResolvedValueOnce([]) // no source maps
        .mockResolvedValueOnce(['/project/dist/main.js', '/project/dist/vendor.js']);

      // 700KB + 700KB = 1400KB total (over 1MB)
      mockStatSync.mockReturnValue({ size: 700 * KB } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('fail');
      expect(result.score).toBe(40);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe('critical');
      expect(result.issues[0].message).toContain('KB');
    });

    it('returns skipped when no JS files are found in the build dir', async () => {
      mockGlobby
        .mockResolvedValueOnce([]) // no source maps
        .mockResolvedValueOnce([]); // no JS files either

      const result = await runner.run('/project');

      expect(result.status).toBe('skipped');
      expect(result.score).toBe(100);
    });

    it('scores on initial bundle when index.html is found, reports total as metadata', async () => {
      mockGlobby
        .mockResolvedValueOnce([]) // no source maps
        .mockResolvedValueOnce([
          '/project/dist/assets/index-abc.js', // entry chunk (200KB)
          '/project/dist/assets/documents-xyz.js', // lazy chunk (900KB)
        ]);

      // index.html references only the entry chunk
      mockReadFileSync.mockReturnValue(
        '<script type="module" src="/assets/index-abc.js"></script>',
      );

      mockStatSync.mockImplementation((file: unknown) => {
        if (String(file).includes('documents')) return { size: 900 * KB } as never;
        return { size: 200 * KB } as never;
      });

      const result = await runner.run('/project');

      // Initial bundle is 200KB — pass
      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
      expect(result.metadata?.initialKB).toBe(200);
      // Total is reported but does not affect score
      expect(result.metadata?.totalKB).toBe(1100);
      expect(result.metadata?.entryChunks).toBe(1);
    });

    it('passes when initial bundle is under threshold even if total bundle would fail', async () => {
      mockGlobby
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          '/project/dist/assets/index-abc.js',
          '/project/dist/assets/chunk-1.js',
          '/project/dist/assets/chunk-2.js',
          '/project/dist/assets/chunk-3.js',
        ]);

      mockReadFileSync.mockReturnValue(
        '<script type="module" src="/assets/index-abc.js"></script>',
      );

      mockStatSync.mockImplementation((file: unknown) => {
        // Entry: 300KB, each lazy chunk: 600KB → total ~2.1MB
        if (String(file).includes('index')) return { size: 300 * KB } as never;
        return { size: 600 * KB } as never;
      });

      const result = await runner.run('/project');

      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
      expect(result.metadata?.initialKB).toBe(300);
      expect(result.metadata?.totalKB).toBe(2100);
    });

    it('fails on initial bundle when entry chunk itself exceeds 1MB', async () => {
      mockGlobby
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['/project/dist/assets/index-abc.js']);

      mockReadFileSync.mockReturnValue(
        '<script type="module" src="/assets/index-abc.js"></script>',
      );

      mockStatSync.mockReturnValue({ size: 1.5 * MB } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('fail');
      expect(result.score).toBe(40);
      expect(result.issues[0].message).toContain('Initial bundle');
    });

    it('falls back to total bundle when index.html has no script tags', async () => {
      mockGlobby.mockResolvedValueOnce([]).mockResolvedValueOnce(['/project/dist/main.js']);

      // HTML with no script src tags
      mockReadFileSync.mockReturnValue('<html><body></body></html>');
      mockStatSync.mockReturnValue({ size: 200 * KB } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('pass');
      expect(result.metadata?.entryChunks).toBe(0);
    });
  });

  describe('run — source-map-explorer path', () => {
    beforeEach(() => {
      mockFileExists.mockImplementation((_root, dir) => dir === 'dist');
    });

    it('returns pass with score 100 when SME reports largest bundle under 500KB', async () => {
      mockGlobby.mockResolvedValueOnce(['/project/dist/main.js.map']); // source maps found
      mockIsCommandAvailable.mockResolvedValue(true);

      const smeOutput = JSON.stringify({
        results: [
          {
            bundleName: 'dist/main.js',
            totalBytes: 200 * KB,
            files: { 'src/index.js': { size: 200 * KB } },
          },
        ],
      });
      mockExeca.mockResolvedValue({ stdout: smeOutput } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
      expect(result.metadata?.method).toBe('source-map-explorer');
    });

    it('returns warning with score 70 when SME reports largest bundle between 500KB and 1MB', async () => {
      mockGlobby.mockResolvedValueOnce(['/project/dist/main.js.map']);
      mockIsCommandAvailable.mockResolvedValue(true);

      const smeOutput = JSON.stringify({
        results: [
          {
            bundleName: 'dist/main.js',
            totalBytes: 700 * KB,
            files: { 'src/index.js': { size: 700 * KB } },
          },
        ],
      });
      mockExeca.mockResolvedValue({ stdout: smeOutput } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('warning');
      expect(result.score).toBe(70);
      expect(result.issues[0].severity).toBe('warning');
      expect(result.issues[0].message).toContain('KB');
    });

    it('returns fail with score 40 when SME reports largest bundle over 1MB', async () => {
      mockGlobby.mockResolvedValueOnce(['/project/dist/main.js.map']);
      mockIsCommandAvailable.mockResolvedValue(true);

      const smeOutput = JSON.stringify({
        results: [
          {
            bundleName: 'dist/main.js',
            totalBytes: 1.2 * MB,
            files: { 'src/index.js': { size: 1.2 * MB } },
          },
        ],
      });
      mockExeca.mockResolvedValue({ stdout: smeOutput } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('fail');
      expect(result.score).toBe(40);
      expect(result.issues[0].severity).toBe('critical');
    });

    it('scores on largest bundle when multiple bundles exist (code-split app passes even with large total)', async () => {
      mockGlobby.mockResolvedValueOnce(['/project/dist/main.js.map']);
      mockIsCommandAvailable.mockResolvedValue(true);

      // Entry chunk 300KB, lazy chunk 900KB — total 1.2MB but largest single is 900KB (warning not fail)
      const smeOutput = JSON.stringify({
        results: [
          { bundleName: 'dist/index.js', totalBytes: 300 * KB, files: {} },
          { bundleName: 'dist/vendor.js', totalBytes: 900 * KB, files: {} },
        ],
      });
      mockExeca.mockResolvedValue({ stdout: smeOutput } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('warning');
      expect(result.score).toBe(70);
      expect(result.metadata?.largestKB).toBe(900);
      expect(result.metadata?.totalKB).toBe(1200);
      expect(result.metadata?.bundleCount).toBe(2);
    });

    it('falls back to file size analysis when SME output is non-JSON', async () => {
      mockGlobby
        .mockResolvedValueOnce(['/project/dist/main.js.map']) // source maps found
        .mockResolvedValueOnce(['/project/dist/main.js']); // fallback JS files

      mockIsCommandAvailable.mockResolvedValue(true);
      // SME returns non-JSON stdout
      mockExeca.mockResolvedValue({ stdout: 'Error: something went wrong' } as never);
      mockStatSync.mockReturnValue({ size: 200 * KB } as never);

      const result = await runner.run('/project');

      // Falls back to file size analysis — 200KB → pass
      expect(result.status).toBe('pass');
      expect(result.metadata?.method).toBe('file-size-analysis');
    });

    it('falls back to file size analysis when SME tool is not available', async () => {
      mockGlobby
        .mockResolvedValueOnce(['/project/dist/main.js.map']) // source maps found
        .mockResolvedValueOnce(['/project/dist/main.js']); // fallback JS files

      mockIsCommandAvailable.mockResolvedValue(false); // tool not available
      mockStatSync.mockReturnValue({ size: 100 * KB } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('pass');
      expect(result.metadata?.method).toBe('file-size-analysis');
    });

    it('falls back to file size analysis when SME execa throws', async () => {
      mockGlobby
        .mockResolvedValueOnce(['/project/dist/main.js.map'])
        .mockResolvedValueOnce(['/project/dist/main.js']);

      mockIsCommandAvailable.mockResolvedValue(true);
      mockExeca.mockRejectedValue(new Error('spawn failed'));
      mockStatSync.mockReturnValue({ size: 100 * KB } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('pass');
      expect(result.metadata?.method).toBe('file-size-analysis');
    });

    it('falls back to file size analysis when SME output has empty results array', async () => {
      mockGlobby
        .mockResolvedValueOnce(['/project/dist/main.js.map'])
        .mockResolvedValueOnce(['/project/dist/main.js']);
      mockIsCommandAvailable.mockResolvedValue(true);

      const smeOutput = JSON.stringify({ results: [] });
      mockExeca.mockResolvedValue({ stdout: smeOutput } as never);
      mockStatSync.mockReturnValue({ size: 200 * KB } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('pass');
      expect(result.metadata?.method).toBe('file-size-analysis');
    });
  });

  describe('run — uses build/ when dist/ absent', () => {
    it('uses build/ directory when dist/ does not exist', async () => {
      mockFileExists.mockImplementation((_root, dir) => dir === 'build');

      mockGlobby
        .mockResolvedValueOnce([]) // no source maps in build/
        .mockResolvedValueOnce(['/project/build/main.js']);

      mockStatSync.mockReturnValue({ size: 100 * KB } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('pass');
      // Verify globby was called with cwd pointing to build path
      expect(mockGlobby).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ cwd: '/project/build' }),
      );
    });
  });

  describe('run — custom thresholds from config', () => {
    it('uses custom size thresholds from config', async () => {
      // 600KB bundle — above default warnSize (512KB) but below custom (1MB)
      mockFileExists.mockImplementation((_root, dir) => dir === 'dist');
      mockGlobby
        .mockResolvedValueOnce([]) // no source maps
        .mockResolvedValueOnce(['/project/dist/main.js']);

      mockStatSync.mockReturnValue({ size: 600 * KB } as never);

      const result = await runner.run('/project', {
        checkConfig: { thresholds: { warnSize: 1048576 } },
      });

      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
    });
  });
});
