import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AssetSizeRunner } from './asset-size.js';

vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  fileExists: vi.fn(),
  relativeFromRoot: (root: string, p: string) =>
    p.startsWith(root + '/') ? p.slice(root.length + 1) : p,
}));

vi.mock('../utils/exclude.js', () => ({
  createExcludeFilter: vi.fn(() => () => false),
}));

import { readdirSync, statSync } from 'fs';

import { createExcludeFilter } from '../utils/exclude.js';
import { fileExists } from '../utils/file-helpers.js';

const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockFileExists = vi.mocked(fileExists);
const mockCreateExcludeFilter = vi.mocked(createExcludeFilter);

// Byte constants matching the runner's thresholds
const KB = 1024;
const MB = 1024 * 1024;

describe('AssetSizeRunner', () => {
  let runner: AssetSizeRunner;

  beforeEach(() => {
    runner = new AssetSizeRunner();
    vi.clearAllMocks();
  });

  it('only applies to browser runtime', () => {
    expect(runner.applicableRuntimes).toContain('browser');
  });

  describe('run', () => {
    it('returns pass with score 100 when no asset directories have files', async () => {
      // Only public exists; it is empty
      mockFileExists.mockImplementation((_root, dir) => dir === 'public');
      mockReaddirSync.mockReturnValue([] as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
      expect(result.id).toBe('asset-size');
    });

    it('produces no issue for a 200KB jpg (under 500KB threshold)', async () => {
      mockFileExists.mockImplementation((_root, dir) => dir === 'public');
      mockReaddirSync.mockReturnValue(['photo.jpg'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 200 * KB } as never);

      const result = await runner.run('/project');

      expect(result.issues).toHaveLength(0);
      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
    });

    it('produces a warning issue for a 600KB jpg (over 500KB, under 2MB)', async () => {
      mockFileExists.mockImplementation((_root, dir) => dir === 'public');
      mockReaddirSync.mockReturnValue(['photo.jpg'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 600 * KB } as never);

      const result = await runner.run('/project');

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe('warning');
      expect(result.issues[0].message).toContain('photo.jpg');
      expect(result.issues[0].message).toContain('600KB');
      expect(result.status).toBe('warning');
    });

    it('produces a critical issue for a 3MB png (over 2MB)', async () => {
      mockFileExists.mockImplementation((_root, dir) => dir === 'public');
      mockReaddirSync.mockReturnValue(['banner.png'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 3 * MB } as never);

      const result = await runner.run('/project');

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe('critical');
      expect(result.issues[0].message).toContain('banner.png');
      expect(result.issues[0].message).toContain('3.0MB');
      expect(result.status).toBe('fail');
    });

    it('produces a warning issue for a 150KB svg (over 100KB)', async () => {
      mockFileExists.mockImplementation((_root, dir) => dir === 'public');
      mockReaddirSync.mockReturnValue(['logo.svg'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 150 * KB } as never);

      const result = await runner.run('/project');

      const svgIssue = result.issues.find((i) => i.message.includes('logo.svg'));
      expect(svgIssue).toBeDefined();
      expect(svgIssue?.severity).toBe('warning');
      expect(svgIssue?.message).toContain('150KB');
      expect(svgIssue?.message).toContain('SVG');
    });

    it('produces a warning issue for a 600KB font (over 500KB)', async () => {
      mockFileExists.mockImplementation((_root, dir) => dir === 'public');
      mockReaddirSync.mockReturnValue(['custom.woff2'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 600 * KB } as never);

      const result = await runner.run('/project');

      const fontIssue = result.issues.find((i) => i.message.includes('custom.woff2'));
      expect(fontIssue).toBeDefined();
      expect(fontIssue?.severity).toBe('warning');
      expect(fontIssue?.message).toContain('600KB');
      expect(fontIssue?.message).toContain('font');
    });

    it('produces a warning for total asset size over 5MB', async () => {
      // 6 files of 1MB each = 6MB total, each under per-file thresholds
      mockFileExists.mockImplementation((_root, dir) => dir === 'public');
      mockReaddirSync.mockReturnValue([
        'a.jpg',
        'b.jpg',
        'c.jpg',
        'd.jpg',
        'e.jpg',
        'f.jpg',
      ] as never);
      // Each file is 1MB — under IMAGE_CRITICAL (2MB) but over IMAGE_WARN (500KB)
      // That means each also triggers an individual warning — let's use ~900KB to keep
      // individual issues present but verify the total warning is added too
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 900 * KB } as never);

      const result = await runner.run('/project');

      const totalIssue = result.issues.find((i) => i.message.includes('Total asset size'));
      expect(totalIssue).toBeDefined();
      expect(totalIssue?.severity).toBe('warning');
      expect(totalIssue?.message).toContain('MB');
    });

    it('produces a critical issue for total asset size over 10MB', async () => {
      // 12 files of 1MB each = 12MB total
      const files = Array.from({ length: 12 }, (_, i) => `img${i}.jpg`);
      mockFileExists.mockImplementation((_root, dir) => dir === 'public');
      mockReaddirSync.mockReturnValue(files as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 1 * MB } as never);

      const result = await runner.run('/project');

      const totalIssue = result.issues.find(
        (i) => i.message.includes('Total asset size') && i.severity === 'critical',
      );
      expect(totalIssue).toBeDefined();
    });

    it('skips video files (.mp4)', async () => {
      mockFileExists.mockImplementation((_root, dir) => dir === 'public');
      mockReaddirSync.mockReturnValue(['video.mp4'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 * MB } as never);

      const result = await runner.run('/project');

      expect(result.issues).toHaveLength(0);
      expect(result.status).toBe('pass');
      expect(result.metadata?.totalAssets).toBe(0);
    });

    it('skips audio files (.mp3)', async () => {
      mockFileExists.mockImplementation((_root, dir) => dir === 'public');
      mockReaddirSync.mockReturnValue(['audio.mp3'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 50 * MB } as never);

      const result = await runner.run('/project');

      expect(result.issues).toHaveLength(0);
      expect(result.status).toBe('pass');
    });

    it('calculates score correctly: 100 - critical*20 - warning*8, floor at 20', async () => {
      // 1 critical (3MB png) → score = 100 - 20 = 80
      mockFileExists.mockImplementation((_root, dir) => dir === 'public');
      mockReaddirSync.mockReturnValue(['huge.png'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 3 * MB } as never);

      const result = await runner.run('/project');

      expect(result.score).toBe(80); // 100 - 1*20
    });

    it('scans multiple asset directories when they exist', async () => {
      // Both public and src/assets exist
      mockFileExists.mockImplementation((_root, dir) => dir === 'public' || dir === 'src/assets');
      // public has one file, src/assets has one file
      mockReaddirSync
        .mockReturnValueOnce(['logo.png'] as never) // public
        .mockReturnValueOnce(['icon.png'] as never); // src/assets
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 * KB } as never);

      const result = await runner.run('/project');

      expect(result.metadata?.totalAssets).toBe(2);
    });

    it('scans subdirectories within asset dirs recursively', async () => {
      mockFileExists.mockImplementation((_root, dir) => dir === 'public');
      // public has a subdirectory 'images'
      mockReaddirSync
        .mockReturnValueOnce(['images'] as never)
        .mockReturnValueOnce(['photo.jpg'] as never);
      mockStatSync
        .mockReturnValueOnce({ isDirectory: () => true } as never)
        .mockReturnValueOnce({ isDirectory: () => false, size: 200 * KB } as never);

      const result = await runner.run('/project');

      expect(result.metadata?.totalAssets).toBe(1);
      expect(result.status).toBe('pass');
    });

    it('returns fail result when an unexpected error is thrown', async () => {
      mockFileExists.mockImplementation(() => {
        throw new Error('disk error');
      });

      const result = await runner.run('/project');

      expect(result.status).toBe('fail');
      expect(result.score).toBe(0);
      expect(result.issues[0].severity).toBe('critical');
    });

    it('uses custom image threshold from config', async () => {
      // 600KB image — above default imageWarn (512KB) but below custom (1MB)
      mockFileExists.mockImplementation((_root, dir) => dir === 'public');
      mockReaddirSync.mockReturnValue(['photo.jpg'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 600 * KB } as never);

      const result = await runner.run('/project', {
        checkConfig: { thresholds: { imageWarn: 1048576 } },
      });

      expect(result.issues).toHaveLength(0);
      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
    });

    it('excludes files matching exclude patterns', async () => {
      // public dir contains a subdirectory "generated" with a large image
      mockFileExists.mockImplementation((_root, dir) => dir === 'public');
      mockReaddirSync
        .mockReturnValueOnce(['generated'] as never)
        .mockReturnValueOnce(['big.png'] as never);
      mockStatSync
        .mockReturnValueOnce({ isDirectory: () => true } as never)
        .mockReturnValueOnce({ isDirectory: () => false, size: 600 * KB } as never);

      // Mock createExcludeFilter to return a function that excludes "generated" paths
      mockCreateExcludeFilter.mockReturnValue((p: string) => p.includes('generated'));

      const result = await runner.run('/project', {
        checkConfig: { exclude: ['public/generated/**'] },
      });

      const bigPngIssue = result.issues.find((i) => i.message.includes('big.png'));
      expect(bigPngIssue).toBeUndefined();
      expect(result.status).toBe('pass');
    });
  });
});
