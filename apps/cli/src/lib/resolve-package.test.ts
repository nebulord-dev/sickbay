import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@nebulord/sickbay-core', () => ({
  detectMonorepo: vi.fn(),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, readFileSync: vi.fn() };
});

import { readFileSync } from 'fs';

import { detectMonorepo } from '@nebulord/sickbay-core';

import { resolveProject, shortName } from './resolve-package.js';

const mockDetectMonorepo = vi.mocked(detectMonorepo);
const mockReadFileSync = vi.mocked(readFileSync);

describe('shortName', () => {
  it('strips scope prefix from scoped package name', () => {
    expect(shortName('@scope/my-package')).toBe('my-package');
  });

  it('returns unscoped name as-is', () => {
    expect(shortName('my-package')).toBe('my-package');
  });

  it('handles deeply scoped names', () => {
    expect(shortName('@org/sub/deep')).toBe('deep');
  });
});

describe('resolveProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns single project resolution when not a monorepo', async () => {
    mockDetectMonorepo.mockResolvedValue({ isMonorepo: false });

    const result = await resolveProject('/my/project');

    expect(result).toEqual({ isMonorepo: false, targetPath: '/my/project' });
  });

  it('returns monorepo resolution with package paths and names', async () => {
    mockReadFileSync.mockImplementation((path) => {
      const p = String(path);
      if (p.includes('pkg-a')) return JSON.stringify({ name: '@scope/pkg-a' });
      if (p.includes('pkg-b')) return JSON.stringify({ name: 'pkg-b' });
      return '{}';
    });

    mockDetectMonorepo.mockResolvedValue({
      isMonorepo: true,
      type: 'pnpm',
      packageManager: 'pnpm',
      packagePaths: ['/root/packages/pkg-a', '/root/packages/pkg-b'],
    });

    const result = await resolveProject('/root');

    expect(result.isMonorepo).toBe(true);
    if (result.isMonorepo) {
      expect(result.packagePaths).toHaveLength(2);
      expect(result.packageNames.get('/root/packages/pkg-a')).toBe('@scope/pkg-a');
      expect(result.packageNames.get('/root/packages/pkg-b')).toBe('pkg-b');
      expect(result.targetPath).toBeUndefined();
    }
  });

  it('resolves --package to a specific path by full name', async () => {
    mockReadFileSync.mockImplementation((path) => {
      const p = String(path);
      if (p.includes('pkg-a')) return JSON.stringify({ name: '@scope/pkg-a' });
      return '{}';
    });

    mockDetectMonorepo.mockResolvedValue({
      isMonorepo: true,
      type: 'pnpm',
      packageManager: 'pnpm',
      packagePaths: ['/root/packages/pkg-a'],
    });

    const result = await resolveProject('/root', '@scope/pkg-a');

    expect(result.isMonorepo).toBe(true);
    if (result.isMonorepo) {
      expect(result.targetPath).toBe('/root/packages/pkg-a');
    }
  });

  it('resolves --package by short name suffix', async () => {
    mockReadFileSync.mockImplementation((path) => {
      const p = String(path);
      if (p.includes('pkg-a')) return JSON.stringify({ name: '@scope/pkg-a' });
      return '{}';
    });

    mockDetectMonorepo.mockResolvedValue({
      isMonorepo: true,
      type: 'pnpm',
      packageManager: 'pnpm',
      packagePaths: ['/root/packages/pkg-a'],
    });

    const result = await resolveProject('/root', 'pkg-a');

    expect(result.isMonorepo).toBe(true);
    if (result.isMonorepo) {
      expect(result.targetPath).toBe('/root/packages/pkg-a');
    }
  });

  it('exits when --package is used on a non-monorepo', async () => {
    mockDetectMonorepo.mockResolvedValue({ isMonorepo: false });
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const mockStderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await resolveProject('/my/project', 'some-pkg');

    expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('not a monorepo'));
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockStderr.mockRestore();
  });

  it('exits when --package name is not found in monorepo', async () => {
    mockReadFileSync.mockImplementation(() => JSON.stringify({ name: 'other-pkg' }));

    mockDetectMonorepo.mockResolvedValue({
      isMonorepo: true,
      type: 'pnpm',
      packageManager: 'pnpm',
      packagePaths: ['/root/packages/other-pkg'],
    });

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const mockStderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await resolveProject('/root', 'nonexistent');

    expect(mockStderr).toHaveBeenCalledWith(expect.stringContaining('not found in monorepo'));
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockStderr.mockRestore();
  });
});
