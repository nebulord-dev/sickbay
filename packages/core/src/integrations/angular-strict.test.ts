import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AngularStrictRunner } from './angular-strict.js';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
}));

import { readFileSync, existsSync } from 'fs';

const mockReadFileSync = vi.mocked(readFileSync);
const mockExistsSync = vi.mocked(existsSync);

describe('AngularStrictRunner', () => {
  let runner: AngularStrictRunner;

  beforeEach(() => {
    runner = new AngularStrictRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for angular only', () => {
    expect(runner.applicableFrameworks).toEqual(['angular']);
    expect(runner.category).toBe('code-quality');
    expect(runner.name).toBe('angular-strict');
  });

  it('returns pass with score 100 when no tsconfig.json exists', async () => {
    mockExistsSync.mockReturnValue(false as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.id).toBe('angular-strict');
  });

  it('returns pass when all three strict settings are enabled', async () => {
    mockExistsSync.mockReturnValue(true as never);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      compilerOptions: { strict: true },
      angularCompilerOptions: {
        strictTemplates: true,
        strictInjectionParameters: true,
      },
    }) as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.metadata?.strict).toBe(true);
    expect(result.metadata?.strictTemplates).toBe(true);
    expect(result.metadata?.strictInjectionParameters).toBe(true);
  });

  it('emits a warning for each missing strict setting', async () => {
    mockExistsSync.mockReturnValue(true as never);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      compilerOptions: { strict: false },
    }) as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(3);
    expect(result.issues.every((i) => i.severity === 'warning')).toBe(true);
    // Each issue should mention its setting
    expect(result.issues.find((i) => i.message.includes('strict mode'))).toBeDefined();
    expect(result.issues.find((i) => i.message.includes('strictTemplates'))).toBeDefined();
    expect(result.issues.find((i) => i.message.includes('strictInjectionParameters'))).toBeDefined();
  });

  it('scores: 0 missing → 100, 1 missing → 73, 2 missing → 46, 3 missing → 20', async () => {
    mockExistsSync.mockReturnValue(true as never);

    // 1 missing (no strict)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      compilerOptions: {},
      angularCompilerOptions: { strictTemplates: true, strictInjectionParameters: true },
    }) as never);
    let result = await runner.run('/project');
    expect(result.score).toBe(73);

    // 2 missing
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true as never);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      compilerOptions: {},
      angularCompilerOptions: { strictTemplates: true },
    }) as never);
    result = await runner.run('/project');
    expect(result.score).toBe(46);

    // 3 missing → floor 20
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true as never);
    mockReadFileSync.mockReturnValue(JSON.stringify({ compilerOptions: {} }) as never);
    result = await runner.run('/project');
    expect(result.score).toBe(20);
  });

  it('issue messages mention extends limitation for strict setting', async () => {
    mockExistsSync.mockReturnValue(true as never);
    mockReadFileSync.mockReturnValue(JSON.stringify({ compilerOptions: {} }) as never);
    const result = await runner.run('/project');
    expect(result.issues[0].message).toContain('extends');
  });

  it('returns fail status when tsconfig is malformed JSON', async () => {
    mockExistsSync.mockReturnValue(true as never);
    mockReadFileSync.mockReturnValue('not valid json' as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
  });
});
