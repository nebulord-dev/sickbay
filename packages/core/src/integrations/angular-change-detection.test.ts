import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AngularChangeDetectionRunner } from './angular-change-detection.js';

// Force POSIX path semantics so mocks comparing forward-slash literals
// (e.g. `endsWith('/src')`) match the path.join output on Windows. The
// real cross-platform path handling is exercised by the relativeFromRoot
// unit tests in file-helpers.test.ts (which uses real `path`).
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return { ...actual.posix, default: actual.posix };
});

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

describe('AngularChangeDetectionRunner', () => {
  let runner: AngularChangeDetectionRunner;

  beforeEach(() => {
    runner = new AngularChangeDetectionRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for angular only', () => {
    expect(runner.applicableFrameworks).toEqual(['angular']);
    expect(runner.category).toBe('performance');
    expect(runner.name).toBe('angular-change-detection');
  });

  it('returns pass with score 100 when no component files exist', async () => {
    mockReaddirSync.mockReturnValue([] as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.id).toBe('angular-change-detection');
  });

  it('returns pass when all components have OnPush', async () => {
    const content = `
      @Component({
        selector: 'app-root',
        changeDetection: ChangeDetectionStrategy.OnPush,
        template: '',
      })
      export class AppComponent {}
    `;
    mockReaddirSync.mockReturnValue(['app.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns warning when a component is missing OnPush', async () => {
    const content = `
      @Component({ selector: 'app-root', template: '' })
      export class AppComponent {}
    `;
    mockReaddirSync.mockReturnValue(['app.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('OnPush');
    expect(result.issues[0].fix?.description).toContain('ChangeDetectionStrategy.OnPush');
  });

  it('scores: 1 missing → 85, 4 missing → 40, 7 missing → 20 (floor)', async () => {
    const missing = `@Component({ selector: 'x', template: '' }) export class C {}`;

    for (const [count, expected] of [
      [1, 85],
      [4, 40],
      [7, 20],
    ] as [number, number][]) {
      vi.clearAllMocks();
      const files = Array.from({ length: count }, (_, i) => `comp${i}.component.ts`);
      mockReaddirSync.mockReturnValue(files as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
      mockReadFileSync.mockReturnValue(missing as never);
      const result = await runner.run('/project');
      expect(result.score).toBe(expected);
    }
  });

  it('does not scan non-.component.ts files', async () => {
    mockReaddirSync.mockReturnValue(['app.service.ts', 'app.routes.ts', 'app.module.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(100);
    expect(result.metadata?.filesScanned).toBe(0);
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('recurses into subdirectories', async () => {
    const content = `@Component({ selector: 'x', template: '' }) export class C {}`;
    mockReaddirSync
      .mockReturnValueOnce(['components'] as never)
      .mockReturnValueOnce(['header.component.ts'] as never);
    mockStatSync
      .mockReturnValueOnce({ isDirectory: () => true } as never)
      .mockReturnValueOnce({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.metadata?.filesScanned).toBe(1);
    expect(result.issues).toHaveLength(1);
  });

  it('includes file path in issue message', async () => {
    const content = `@Component({ selector: 'x', template: '' }) export class C {}`;
    mockReaddirSync.mockReturnValue(['app.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.issues[0].message).toContain('src/app.component.ts');
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
