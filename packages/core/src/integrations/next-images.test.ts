import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NextImagesRunner } from './next-images.js';

vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
}));

import { readdirSync, statSync, readFileSync } from 'fs';

const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('NextImagesRunner', () => {
  let runner: NextImagesRunner;

  beforeEach(() => {
    runner = new NextImagesRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for next only', () => {
    expect(runner.applicableFrameworks).toEqual(['next']);
    expect(runner.category).toBe('performance');
    expect(runner.name).toBe('next-images');
  });

  it('returns pass with score 100 when no jsx files exist', async () => {
    // First call for app/, second call for src/
    mockReaddirSync.mockReturnValue([] as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.id).toBe('next-images');
  });

  it('returns pass when file has no raw img elements', async () => {
    const content = `
      export default function Page() {
        return <div>No images here</div>;
      }
    `;
    // Mock for app/ directory (no files), then src/ directory (has page.tsx)
    mockReaddirSync.mockReturnValueOnce([] as never).mockReturnValueOnce(['page.tsx'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns warning when file contains <img >', async () => {
    const content = `<img src="pic.jpg" alt="test" />`;
    // Mock for app/ (no files), then src/ (one file with img)
    mockReaddirSync.mockReturnValueOnce([] as never).mockReturnValueOnce(['page.tsx'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('raw image element');
    expect(result.issues[0].fix?.description).toContain('next/image');
  });

  it('returns warning when file contains <img>', async () => {
    const content = `<img>`;
    mockReaddirSync.mockReturnValueOnce([] as never).mockReturnValueOnce(['page.tsx'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
  });

  it('scores: 1 violation → 90, 5 violations → 50, 9 violations → 20 (floor)', async () => {
    const withImg = `<img src="pic.jpg" />`;

    for (const [count, expected] of [
      [1, 90],
      [5, 50],
      [9, 20],
    ] as [number, number][]) {
      vi.clearAllMocks();
      const files = Array.from({ length: count }, (_, i) => `file${i}.tsx`);
      // app/ gets empty, src/ gets the files
      mockReaddirSync.mockReturnValueOnce([] as never).mockReturnValueOnce(files as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
      mockReadFileSync.mockReturnValue(withImg as never);
      const result = await runner.run('/project');
      expect(result.score).toBe(expected);
    }
  });

  it('does not scan non-.tsx/.jsx files', async () => {
    mockReaddirSync
      .mockReturnValueOnce(['app.ts', 'styles.css', 'config.json'] as never)
      .mockReturnValueOnce(['other.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(100);
    expect(result.metadata?.filesScanned).toBe(0);
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('recurses into subdirectories', async () => {
    const content = `<img src="pic.jpg" />`;
    // app/ has components dir with header.tsx inside
    mockReaddirSync
      .mockReturnValueOnce(['components'] as never)
      .mockReturnValueOnce(['header.tsx'] as never)
      .mockReturnValueOnce([] as never);
    mockStatSync
      .mockReturnValueOnce({ isDirectory: () => true } as never)
      .mockReturnValueOnce({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.metadata?.filesScanned).toBe(1);
    expect(result.issues).toHaveLength(1);
  });

  it('returns fail status when an unexpected error is thrown', async () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error('disk error');
    });
    const result = await runner.run('/project');
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
  });
});
