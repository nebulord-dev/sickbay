import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ESLintRunner } from './eslint.js';

vi.mock('execa', () => ({ execa: vi.fn() }));
vi.mock('fs', () => ({ existsSync: vi.fn() }));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  parseJsonOutput: (str: string, fallback: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return JSON.parse(fallback);
    }
  },
}));

import { execa } from 'execa';
import { existsSync } from 'fs';

const mockExeca = vi.mocked(execa);
const mockExistsSync = vi.mocked(existsSync);

const makeFile = (
  filePath: string,
  errorCount = 0,
  warningCount = 0,
) => ({ filePath, messages: [], errorCount, warningCount });

describe('ESLintRunner', () => {
  let runner: ESLintRunner;

  beforeEach(() => {
    runner = new ESLintRunner();
    vi.clearAllMocks();
    // Default: src dir exists so run() doesn't bail out with skipped.
    // Individual isApplicable tests override this as needed.
    mockExistsSync.mockReturnValue(true);
  });

  describe('isApplicable', () => {
    it('returns true when eslint.config.js exists', async () => {
      mockExistsSync.mockImplementation((p) => String(p).endsWith('eslint.config.js'));
      expect(await runner.isApplicable('/project')).toBe(true);
    });

    it('returns true when eslint.config.mjs exists', async () => {
      mockExistsSync.mockImplementation((p) => String(p).endsWith('eslint.config.mjs'));
      expect(await runner.isApplicable('/project')).toBe(true);
    });

    it('returns true when .eslintrc.json exists', async () => {
      mockExistsSync.mockImplementation((p) => String(p).endsWith('.eslintrc.json'));
      expect(await runner.isApplicable('/project')).toBe(true);
    });

    it('returns true when .eslintrc.js exists', async () => {
      mockExistsSync.mockImplementation((p) => String(p).endsWith('.eslintrc.js'));
      expect(await runner.isApplicable('/project')).toBe(true);
    });

    it('returns false when no eslint config found', async () => {
      mockExistsSync.mockReturnValue(false);
      expect(await runner.isApplicable('/project')).toBe(false);
    });
  });

  it('returns pass with score 100 when no lint issues', async () => {
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify([makeFile('/project/src/index.ts')]),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns warning with info severity when only warnings', async () => {
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify([makeFile('/project/src/index.ts', 0, 3)]),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('warning');
    expect(result.issues[0].severity).toBe('info');
  });

  it('returns warning with warning severity when errors present but <= 10', async () => {
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify([makeFile('/project/src/index.ts', 5, 0)]),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('warning');
    expect(result.issues[0].severity).toBe('warning');
  });

  it('returns fail when errors exceed 10', async () => {
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify([makeFile('/project/src/index.ts', 11, 0)]),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
  });

  it('calculates score: 100 - errors*5 - round(warnings*0.5)', async () => {
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify([makeFile('/project/src/index.ts', 4, 4)]),
    } as never);

    const result = await runner.run('/project');

    // 100 - 4*5 - round(4*0.5) = 100 - 20 - 2 = 78
    expect(result.score).toBe(78);
  });

  it('score does not go below 0', async () => {
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify([makeFile('/project/src/index.ts', 100, 0)]),
    } as never);

    const result = await runner.run('/project');

    expect(result.score).toBe(0);
  });

  it('strips project path prefix from issue messages', async () => {
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify([makeFile('/project/src/index.ts', 1, 0)]),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].message).toContain('src/index.ts');
    expect(result.issues[0].message).not.toContain('/project/src/');
  });

  it('aggregates errors across multiple files', async () => {
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify([
        makeFile('/project/src/a.ts', 2, 0),
        makeFile('/project/src/b.ts', 0, 0),
        makeFile('/project/src/c.ts', 1, 2),
      ]),
    } as never);

    const result = await runner.run('/project');

    // a.ts and c.ts have issues; b.ts does not
    expect(result.issues).toHaveLength(2);
    expect(result.metadata?.errors).toBe(3);
    expect(result.metadata?.warnings).toBe(2);
    expect(result.metadata?.files).toBe(3);
  });

  it('includes fix command in each issue', async () => {
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify([makeFile('/project/src/index.ts', 1, 0)]),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].fix?.command).toContain('eslint');
    expect(result.issues[0].fix?.command).toContain('--fix');
    expect(result.issues[0].fix?.modifiesSource).toBe(true);
  });

  it('returns fail with score 0 when execa throws', async () => {
    mockExeca.mockRejectedValue(new Error('spawn failed'));

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.issues[0].severity).toBe('critical');
  });
});
