import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NextMissingBoundariesRunner } from './next-missing-boundaries.js';

vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  relativeFromRoot: (root: string, p: string) =>
    p.startsWith(root + '/') ? p.slice(root.length + 1) : p,
}));

import { readdirSync, statSync, existsSync } from 'fs';

const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockExistsSync = vi.mocked(existsSync);

describe('NextMissingBoundariesRunner', () => {
  let runner: NextMissingBoundariesRunner;

  beforeEach(() => {
    runner = new NextMissingBoundariesRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for next, category code-quality, name next-missing-boundaries', () => {
    expect(runner.applicableFrameworks).toEqual(['next']);
    expect(runner.category).toBe('code-quality');
    expect(runner.name).toBe('next-missing-boundaries');
  });

  it('returns pass when app/ does not exist (ENOENT)', async () => {
    mockReaddirSync.mockImplementation(() => {
      const err = new Error('ENOENT');
      (err as NodeJS.ErrnoException).code = 'ENOENT';
      throw err;
    });
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns pass when no subdirs with page.tsx', async () => {
    mockReaddirSync
      .mockReturnValueOnce(['utils', 'config'] as never) // app/ returns two non-page dirs
      .mockReturnValueOnce([] as never) // utils/ recursive call
      .mockReturnValueOnce([] as never) // config/ recursive call
      .mockReturnValueOnce([] as never); // src/app/ call
    mockStatSync.mockReturnValue({ isDirectory: () => true } as never);
    mockExistsSync.mockReturnValue(false); // no page.tsx files exist
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns warning when subdir has page.tsx but no loading.tsx', async () => {
    mockReaddirSync
      .mockReturnValueOnce(['dashboard'] as never) // first call to app/ returns dashboard
      .mockReturnValueOnce([] as never) // recursive call to app/dashboard/ returns nothing
      .mockReturnValueOnce([] as never); // src/app/ call
    mockStatSync.mockReturnValue({ isDirectory: () => true } as never);
    mockExistsSync
      .mockReturnValueOnce(true) // page.tsx exists in dashboard
      .mockReturnValueOnce(false) // loading.tsx doesn't exist
      .mockReturnValueOnce(false) // loading.jsx doesn't exist
      .mockReturnValueOnce(true); // error.tsx exists (short-circuits)
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('info');
    expect(result.issues[0].message).toContain('missing loading.tsx');
  });

  it('returns warning when subdir has page.tsx but no error.tsx', async () => {
    mockReaddirSync
      .mockReturnValueOnce(['dashboard'] as never) // first call returns dashboard
      .mockReturnValueOnce([] as never) // recursive call returns nothing
      .mockReturnValueOnce([] as never); // src/app/ call
    mockStatSync.mockReturnValue({ isDirectory: () => true } as never);
    mockExistsSync
      .mockReturnValueOnce(true) // page.tsx exists in dashboard
      .mockReturnValueOnce(true) // loading.tsx exists (short-circuits)
      .mockReturnValueOnce(false) // error.tsx doesn't exist
      .mockReturnValueOnce(false); // error.jsx doesn't exist
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('info');
    expect(result.issues[0].message).toContain('missing error.tsx');
  });

  it('returns pass when subdir has page.tsx AND loading.tsx AND error.tsx', async () => {
    mockReaddirSync
      .mockReturnValueOnce(['dashboard'] as never) // first call returns dashboard
      .mockReturnValueOnce([] as never) // recursive call returns nothing
      .mockReturnValueOnce([] as never); // src/app/ call
    mockStatSync.mockReturnValue({ isDirectory: () => true } as never);
    mockExistsSync
      .mockReturnValueOnce(true) // page.tsx exists (in findPageDirs)
      .mockReturnValueOnce(true) // loading.tsx exists (first boundary check)
      .mockReturnValueOnce(true); // error.tsx exists (second boundary check)
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('does not check app root itself, only subdirectories', async () => {
    mockReaddirSync
      .mockReturnValueOnce(['dashboard'] as never) // first call returns dashboard
      .mockReturnValueOnce([] as never) // recursive call returns nothing
      .mockReturnValueOnce([] as never); // src/app/ call
    mockStatSync.mockReturnValue({ isDirectory: () => true } as never);
    mockExistsSync
      .mockReturnValueOnce(true) // page.tsx exists in dashboard
      .mockReturnValueOnce(true) // loading.tsx exists (short-circuits)
      .mockReturnValueOnce(true); // error.tsx exists
    const result = await runner.run('/project');
    // App root is never checked for page.tsx, only subdirs
    expect(result.status).toBe('pass');
    expect(result.metadata?.segmentsChecked).toBe(1);
  });

  it('issues have severity info', async () => {
    mockReaddirSync
      .mockReturnValueOnce(['dashboard'] as never) // first call returns dashboard
      .mockReturnValueOnce([] as never) // recursive call returns nothing
      .mockReturnValueOnce([] as never); // src/app/ call
    mockStatSync.mockReturnValue({ isDirectory: () => true } as never);
    mockExistsSync
      .mockReturnValueOnce(true) // page.tsx exists
      .mockReturnValueOnce(false) // loading.tsx missing
      .mockReturnValueOnce(false) // loading.jsx missing
      .mockReturnValueOnce(false) // error.tsx missing
      .mockReturnValueOnce(false); // error.jsx missing
    const result = await runner.run('/project');
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
    result.issues.forEach((issue) => {
      expect(issue.severity).toBe('info');
    });
  });

  it('returns fail status when an unexpected error is thrown', async () => {
    mockReaddirSync.mockImplementation(() => {
      const err = new Error('disk error');
      (err as NodeJS.ErrnoException).code = 'EIO';
      throw err;
    });
    const result = await runner.run('/project');
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
  });

  it('scores correctly based on number of issues', async () => {
    // Test just one case: 1 missing file = 1 issue = score 85
    mockReaddirSync
      .mockReturnValueOnce(['dashboard'] as never) // first call returns dashboard
      .mockReturnValueOnce([] as never) // recursive call returns nothing
      .mockReturnValueOnce([] as never); // src/app/ call
    mockStatSync.mockReturnValue({ isDirectory: () => true } as never);
    mockExistsSync
      .mockReturnValueOnce(true) // page.tsx exists
      .mockReturnValueOnce(false) // loading.tsx missing
      .mockReturnValueOnce(false) // loading.jsx missing
      .mockReturnValueOnce(true); // error.tsx exists (short-circuits)
    const result = await runner.run('/project');
    expect(result.score).toBe(85); // 100 - 1*15 = 85
  });

  it('includes metadata with segmentsChecked, missingLoading, missingError', async () => {
    mockReaddirSync
      .mockReturnValueOnce(['dashboard'] as never) // app/ call - just test 1 dir for now
      .mockReturnValueOnce([] as never) // app/dashboard/ recursive call
      .mockReturnValueOnce([] as never); // src/app/ call
    mockStatSync.mockReturnValue({ isDirectory: () => true } as never);
    mockExistsSync
      // dashboard: has page, missing loading, has error
      .mockReturnValueOnce(true) // page.tsx exists
      .mockReturnValueOnce(false) // loading.tsx doesn't exist
      .mockReturnValueOnce(false) // loading.jsx doesn't exist
      .mockReturnValueOnce(true); // error.tsx exists (short-circuits)
    const result = await runner.run('/project');
    expect(result.metadata).toEqual({
      segmentsChecked: 1,
      missingLoading: 1,
      missingError: 0,
    });
  });

  it('checks both app/ and src/app/ paths', async () => {
    mockReaddirSync
      .mockReturnValueOnce(['dashboard'] as never) // app/ call returns dashboard
      .mockReturnValueOnce([] as never) // app/dashboard/ recursive call
      .mockReturnValueOnce([] as never); // src/app/ call returns empty
    mockStatSync.mockReturnValue({ isDirectory: () => true } as never);
    mockExistsSync
      .mockReturnValueOnce(true) // page.tsx exists
      .mockReturnValueOnce(true) // loading.tsx exists
      .mockReturnValueOnce(true); // error.tsx exists
    const result = await runner.run('/project');
    // Should check both paths, but only find one segment (from app/)
    expect(result.metadata?.segmentsChecked).toBe(1);
  });
});
