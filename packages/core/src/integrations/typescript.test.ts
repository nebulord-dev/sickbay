import { describe, it, expect, vi, beforeEach } from 'vitest';

import { TypeScriptRunner } from './typescript.js';

vi.mock('execa', () => ({ execa: vi.fn() }));
vi.mock('fs', () => ({ existsSync: vi.fn() }));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
}));

import { existsSync } from 'fs';

import { execa } from 'execa';

const mockExeca = vi.mocked(execa);
const mockExistsSync = vi.mocked(existsSync);

function makeErrorLine(
  file = 'src/index.ts',
  line = 10,
  col = 5,
  code = 'TS2345',
  msg = 'Type error',
) {
  return `${file}(${line},${col}): error ${code}: ${msg}`;
}

describe('TypeScriptRunner', () => {
  let runner: TypeScriptRunner;

  beforeEach(() => {
    runner = new TypeScriptRunner();
    vi.clearAllMocks();
  });

  describe('isApplicable', () => {
    it('returns true when tsconfig.json exists', async () => {
      mockExistsSync.mockReturnValue(true);
      expect(await runner.isApplicable('/project')).toBe(true);
    });

    it('returns false when tsconfig.json is absent', async () => {
      mockExistsSync.mockReturnValue(false);
      expect(await runner.isApplicable('/project')).toBe(false);
    });
  });

  it('returns pass with score 100 when no type errors', async () => {
    mockExeca.mockResolvedValue({ stdout: '', stderr: '' } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns warning when 1–20 type errors found', async () => {
    mockExeca.mockResolvedValue({
      stdout: [
        makeErrorLine(),
        makeErrorLine('src/utils.ts', 20, 3, 'TS2304', 'Cannot find name'),
      ].join('\n'),
      stderr: '',
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('warning');
    expect(result.score).toBe(90); // 100 - 2 * 5
    expect(result.issues).toHaveLength(2);
  });

  it('returns fail when more than 20 type errors', async () => {
    const errors = Array.from({ length: 21 }, (_, i) => makeErrorLine(`src/f${i}.ts`)).join('\n');
    mockExeca.mockResolvedValue({ stdout: errors, stderr: '' } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
  });

  it('caps displayed issues at 25 and adds a summary issue', async () => {
    const errors = Array.from({ length: 27 }, (_, i) => makeErrorLine(`src/f${i}.ts`)).join('\n');
    mockExeca.mockResolvedValue({ stdout: errors, stderr: '' } as never);

    const result = await runner.run('/project');

    // 25 parsed + 1 "...and N more" issue
    expect(result.issues).toHaveLength(26);
    expect(result.issues[25].message).toContain('more type errors');
    expect(result.issues[25].severity).toBe('info');
  });

  it('parses tsc error format into readable message', async () => {
    mockExeca.mockResolvedValue({
      stdout: "src/index.ts(10,5): error TS2345: Argument of type 'string' is not assignable.",
      stderr: '',
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].message).toBe(
      "src/index.ts: TS2345: Argument of type 'string' is not assignable.",
    );
  });

  it('includes errors from stderr as well as stdout', async () => {
    mockExeca.mockResolvedValue({
      stdout: '',
      stderr: 'src/index.ts(1,1): error TS2304: Cannot find name "x".',
    } as never);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
  });

  it('uses raw line as message when format does not match regex', async () => {
    mockExeca.mockResolvedValue({
      stdout: 'src/index.ts: error TS2304: Something weird',
      stderr: '',
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].message).toContain('error TS2304');
  });

  it('does not go below score 0', async () => {
    const errors = Array.from({ length: 25 }, (_, i) => makeErrorLine(`src/f${i}.ts`)).join('\n');
    mockExeca.mockResolvedValue({ stdout: errors, stderr: '' } as never);

    const result = await runner.run('/project');

    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('returns fail with score 0 when execa throws', async () => {
    mockExeca.mockRejectedValue(new Error('tsc not found'));

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.issues[0].severity).toBe('critical');
  });
});
