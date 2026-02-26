import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SourceMapExplorerRunner } from './source-map-explorer.js';

vi.mock('execa', () => ({ execa: vi.fn() }));
vi.mock('globby', () => ({ globby: vi.fn() }));
vi.mock('fs', () => ({ statSync: vi.fn() }));
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

import { execa } from 'execa';
import { globby } from 'globby';
import { statSync } from 'fs';
import { fileExists, isCommandAvailable } from '../utils/file-helpers.js';

const mockExeca = vi.mocked(execa);
const mockGlobby = vi.mocked(globby);
const mockStatSync = vi.mocked(statSync);
const mockFileExists = vi.mocked(fileExists);
const mockIsCommandAvailable = vi.mocked(isCommandAvailable);

const KB = 1024;
const MB = 1024 * 1024;

describe('SourceMapExplorerRunner', () => {
  let runner: SourceMapExplorerRunner;

  beforeEach(() => {
    runner = new SourceMapExplorerRunner();
    vi.clearAllMocks();
  });

  describe('isApplicable', () => {
    it('returns false when neither dist nor build directory exists', async () => {
      mockFileExists.mockReturnValue(false);

      const result = await runner.isApplicable('/project');

      expect(result).toBe(false);
    });

    it('returns true when dist directory exists', async () => {
      mockFileExists.mockImplementation((_root, dir) => dir === 'dist');

      const result = await runner.isApplicable('/project');

      expect(result).toBe(true);
    });

    it('returns true when build directory exists', async () => {
      mockFileExists.mockImplementation((_root, dir) => dir === 'build');

      const result = await runner.isApplicable('/project');

      expect(result).toBe(true);
    });
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
  });

  describe('run — source-map-explorer path', () => {
    beforeEach(() => {
      mockFileExists.mockImplementation((_root, dir) => dir === 'dist');
    });

    it('returns pass with score 100 when SME reports totalBytes under 500KB', async () => {
      mockGlobby.mockResolvedValueOnce(['/project/dist/main.js.map']); // source maps found
      mockIsCommandAvailable.mockResolvedValue(true);

      const smeOutput = JSON.stringify({
        files: { 'src/index.js': { size: 200 * KB } },
        totalBytes: 200 * KB,
      });
      mockExeca.mockResolvedValue({ stdout: smeOutput } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
      expect(result.metadata?.method).toBe('source-map-explorer');
    });

    it('returns warning with score 70 when SME reports totalBytes between 500KB and 1MB', async () => {
      mockGlobby.mockResolvedValueOnce(['/project/dist/main.js.map']);
      mockIsCommandAvailable.mockResolvedValue(true);

      const smeOutput = JSON.stringify({
        files: { 'src/index.js': { size: 700 * KB } },
        totalBytes: 700 * KB,
      });
      mockExeca.mockResolvedValue({ stdout: smeOutput } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('warning');
      expect(result.score).toBe(70);
      expect(result.issues[0].severity).toBe('warning');
      expect(result.issues[0].message).toContain('KB');
    });

    it('returns fail with score 40 when SME reports totalBytes over 1MB', async () => {
      mockGlobby.mockResolvedValueOnce(['/project/dist/main.js.map']);
      mockIsCommandAvailable.mockResolvedValue(true);

      const smeOutput = JSON.stringify({
        files: {
          'src/index.js': { size: 800 * KB },
          'src/vendor.js': { size: 400 * KB },
        },
        totalBytes: 1.2 * MB,
      });
      mockExeca.mockResolvedValue({ stdout: smeOutput } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('fail');
      expect(result.score).toBe(40);
      expect(result.issues[0].severity).toBe('critical');
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

    it('computes totalBytes from files when totalBytes is absent in SME output', async () => {
      mockGlobby.mockResolvedValueOnce(['/project/dist/main.js.map']);
      mockIsCommandAvailable.mockResolvedValue(true);

      // No totalBytes field — runner should sum file sizes
      const smeOutput = JSON.stringify({
        files: {
          'src/a.js': { size: 100 * KB },
          'src/b.js': { size: 100 * KB },
        },
      });
      mockExeca.mockResolvedValue({ stdout: smeOutput } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('pass'); // 200KB total
      expect(result.score).toBe(100);
      expect(result.metadata?.totalBytes).toBe(200 * KB);
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
});
