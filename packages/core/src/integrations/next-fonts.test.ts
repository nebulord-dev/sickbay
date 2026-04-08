import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NextFontsRunner } from './next-fonts.js';

// Force POSIX path semantics so mocks comparing forward-slash literals
// match the path.join output on Windows.
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return { ...actual.posix, default: actual.posix };
});

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

describe('NextFontsRunner', () => {
  let runner: NextFontsRunner;

  beforeEach(() => {
    runner = new NextFontsRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for next only, category performance, name next-fonts', () => {
    expect(runner.applicableFrameworks).toEqual(['next']);
    expect(runner.category).toBe('performance');
    expect(runner.name).toBe('next-fonts');
  });

  it('returns pass with score 100 when no layout files exist', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.id).toBe('next-fonts');
  });

  it('returns pass when layout file exists but has no font domain', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      'export default function RootLayout() { return <html><body>Content</body></html>; }',
    );
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns warning when fonts.googleapis.com found in app/layout.tsx', async () => {
    mockExistsSync.mockImplementation((path) => path === '/project/app/layout.tsx');
    mockReadFileSync.mockReturnValue(
      '<link href="https://fonts.googleapis.com/css2?family=Roboto" rel="stylesheet" />',
    );
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('app/layout.tsx');
    expect(result.issues[0].message).toContain('Google Fonts');
    expect(result.issues[0].fix?.description).toContain('next/font/google');
  });

  it('returns warning when fonts.gstatic.com found in layout file', async () => {
    mockExistsSync.mockImplementation((path) => path === '/project/src/app/layout.tsx');
    mockReadFileSync.mockReturnValue(
      '<link href="https://fonts.gstatic.com/s/roboto/v30/..." rel="stylesheet" />',
    );
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('Google Fonts');
  });

  it('handles multiple violations correctly: 2 files with fonts → score 40', async () => {
    let callCount = 0;
    mockExistsSync.mockImplementation(() => {
      callCount++;
      return callCount <= 2; // first 2 calls return true
    });
    mockReadFileSync.mockReturnValue(
      '<link href="https://fonts.googleapis.com/css2?family=Roboto" rel="stylesheet" />',
    );
    const result = await runner.run('/project');
    expect(result.issues).toHaveLength(2);
    expect(result.score).toBe(Math.max(40, 100 - 2 * 30)); // 40
    expect(result.status).toBe('warning');
    expect(result.metadata?.violations).toBe(2);
  });

  it('returns fail status when an unexpected error is thrown', async () => {
    mockExistsSync.mockImplementation(() => {
      throw new Error('fs error');
    });
    const result = await runner.run('/project');
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.issues[0].severity).toBe('critical');
  });

  it('checks all 9 layout file paths', async () => {
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('');
    const result = await runner.run('/project');
    expect(result.metadata?.layoutFilesChecked).toBe(9);
  });

  it('includes reportedBy field in issues', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      '<link href="https://fonts.googleapis.com/css2?family=Roboto" rel="stylesheet" />',
    );
    const result = await runner.run('/project');
    expect(result.issues[0].reportedBy).toEqual(['next-fonts']);
  });
});
