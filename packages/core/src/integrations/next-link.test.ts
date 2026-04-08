import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NextLinkRunner } from './next-link.js';

vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  relativeFromRoot: (root: string, p: string) =>
    p.startsWith(root + '/') ? p.slice(root.length + 1) : p,
}));

import { readdirSync, statSync, readFileSync } from 'fs';

const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('NextLinkRunner', () => {
  let runner: NextLinkRunner;

  beforeEach(() => {
    runner = new NextLinkRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for next only', () => {
    expect(runner.applicableFrameworks).toEqual(['next']);
    expect(runner.category).toBe('performance');
    expect(runner.name).toBe('next-link');
  });

  it('returns pass with score 100 when no jsx files', async () => {
    mockReaddirSync.mockReturnValue([] as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.id).toBe('next-link');
  });

  it('returns pass when file has no anchor tags', async () => {
    const content = `
      export default function Page() {
        return <div>Hello</div>;
      }
    `;
    mockReaddirSync
      .mockReturnValueOnce([] as never) // app/ — empty
      .mockReturnValueOnce(['page.tsx'] as never); // src/ — one file
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns warning for <a href="/about"> (internal absolute)', async () => {
    const content = `<a href="/about">About</a>`;
    mockReaddirSync
      .mockReturnValueOnce(['page.tsx'] as never) // app/ directory
      .mockReturnValueOnce([] as never); // src/ directory
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('raw anchor tag for internal navigation');
    expect(result.issues[0].fix?.description).toContain('next/link');
  });

  it('returns warning for <a href="./dashboard"> (relative)', async () => {
    const content = `<a href="./dashboard">Dashboard</a>`;
    mockReaddirSync
      .mockReturnValueOnce(['page.tsx'] as never) // app/ directory
      .mockReturnValueOnce([] as never); // src/ directory
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
  });

  it('does NOT flag <a href="https://example.com"> (external)', async () => {
    const content = `<a href="https://example.com">External</a>`;
    mockReaddirSync
      .mockReturnValueOnce(['page.tsx'] as never) // app/ directory
      .mockReturnValueOnce([] as never); // src/ directory
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.issues).toHaveLength(0);
  });

  it('does NOT flag <a href="http://example.com"> (external)', async () => {
    const content = `<a href="http://example.com">External</a>`;
    mockReaddirSync
      .mockReturnValueOnce(['page.tsx'] as never) // app/ directory
      .mockReturnValueOnce([] as never); // src/ directory
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.issues).toHaveLength(0);
  });

  it('does NOT flag <a href="mailto:foo@bar.com"> (non-link)', async () => {
    const content = `<a href="mailto:foo@bar.com">Email</a>`;
    mockReaddirSync
      .mockReturnValueOnce(['page.tsx'] as never) // app/ directory
      .mockReturnValueOnce([] as never); // src/ directory
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.issues).toHaveLength(0);
  });

  it('scores: 1 violation → 85, 3 violations → 55, 6 violations → 20 (floor)', async () => {
    const violatingContent = `<a href="/page">Link</a>`;

    for (const [count, expected] of [
      [1, 85],
      [3, 55],
      [6, 20],
    ] as [number, number][]) {
      vi.clearAllMocks();
      const files = Array.from({ length: count }, (_, i) => `page${i}.tsx`);
      mockReaddirSync
        .mockReturnValueOnce(files as never) // app/ directory
        .mockReturnValueOnce([] as never); // src/ directory
      mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
      mockReadFileSync.mockReturnValue(violatingContent as never);
      const result = await runner.run('/project');
      expect(result.score).toBe(expected);
    }
  });

  it('returns fail status when unexpected error thrown', async () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error('disk error');
    });
    const result = await runner.run('/project');
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
  });
});
