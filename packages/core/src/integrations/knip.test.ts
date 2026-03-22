import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnipRunner } from './knip.js';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('../utils/detect-project.js', () => ({
  detectPackageManager: vi.fn().mockReturnValue('npm'),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  isCommandAvailable: vi.fn(),
  coreLocalDir: '/fake/node_modules',
  parseJsonOutput: (str: string, fallback: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return JSON.parse(fallback);
    }
  },
}));

import { execa } from 'execa';
import { isCommandAvailable } from '../utils/file-helpers.js';

const mockExeca = vi.mocked(execa);
const mockIsAvailable = vi.mocked(isCommandAvailable);

describe('KnipRunner', () => {
  let runner: KnipRunner;

  beforeEach(() => {
    runner = new KnipRunner();
    vi.clearAllMocks();
  });

  it('returns a skipped result when knip is not installed', async () => {
    mockIsAvailable.mockResolvedValue(false);

    const result = await runner.run('/project');

    expect(result.status).toBe('skipped');
    expect(result.score).toBe(100);
    expect(result.id).toBe('knip');
  });

  it('returns pass with score 100 when no issues are found', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({ stdout: JSON.stringify({ issues: [] }) } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('reports unused files as warning issues', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ issues: [
        { file: 'src/old.ts', files: [{ name: 'src/old.ts' }] },
        { file: 'src/dead.ts', files: [{ name: 'src/dead.ts' }] },
      ] }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('src/old.ts');
  });

  it('reports unused dependencies as warning issues', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        issues: [{ file: 'src/index.ts', dependencies: [{ name: 'lodash' }] }],
      }),
    } as never);

    const result = await runner.run('/project');

    const depIssue = result.issues.find((i) => i.message.includes('lodash'));
    expect(depIssue).toBeDefined();
    expect(depIssue?.severity).toBe('warning');
    expect(depIssue?.fix?.command).toBe('npm remove lodash');
  });

  it('reports unused devDependencies as info issues', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        issues: [{ file: 'src/index.ts', devDependencies: [{ name: 'jest' }] }],
      }),
    } as never);

    const result = await runner.run('/project');

    const devDepIssue = result.issues.find((i) => i.message.includes('jest'));
    expect(devDepIssue).toBeDefined();
    expect(devDepIssue?.severity).toBe('info');
  });

  it('deduplicates dependencies reported across multiple files', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        issues: [
          { file: 'src/a.ts', dependencies: [{ name: 'lodash' }] },
          { file: 'src/b.ts', dependencies: [{ name: 'lodash' }] },
        ],
      }),
    } as never);

    const result = await runner.run('/project');

    const lodashIssues = result.issues.filter((i) => i.message.includes('lodash'));
    expect(lodashIssues).toHaveLength(1);
  });

  it('caps unused exports display at 5 and adds a summary issue', async () => {
    const exports = Array.from({ length: 7 }, (_, i) => ({ name: `fn${i}` }));
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        issues: [{ file: 'src/index.ts', exports }],
      }),
    } as never);

    const result = await runner.run('/project');

    const exportIssues = result.issues.filter((i) => i.message.includes('Unused export'));
    const summaryIssue = result.issues.find((i) => i.message.includes('more unused exports'));
    expect(exportIssues).toHaveLength(5);
    expect(summaryIssue).toBeDefined();
  });

  it('reduces score by 5 per issue', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        issues: [
          { file: 'a.ts', files: [{ name: 'a.ts' }] },
          { file: 'b.ts', files: [{ name: 'b.ts' }] },
          { file: 'c.ts', files: [{ name: 'c.ts' }] },
          { file: 'd.ts', files: [{ name: 'd.ts' }] },
        ],
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.score).toBe(80); // 100 - 4 * 5
  });

  it('does not let score drop below 0', async () => {
    const issues = Array.from({ length: 25 }, (_, i) => ({
      file: `src/file${i}.ts`,
      files: [{ name: `src/file${i}.ts` }],
    }));
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ issues }),
    } as never);

    const result = await runner.run('/project');

    expect(result.score).toBe(0);
  });

  it('returns status warning when there are 1–10 issues', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ issues: [{ file: 'a.ts', files: [{ name: 'a.ts' }] }] }),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('warning');
  });

  it('returns status fail when there are more than 10 issues', async () => {
    const issues = Array.from({ length: 11 }, (_, i) => ({
      file: `src/f${i}.ts`,
      files: [{ name: `src/f${i}.ts` }],
    }));
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ issues }),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
  });

  it('returns a fail result when execa throws', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockRejectedValue(new Error('spawn failed'));

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.issues[0].severity).toBe('critical');
  });
});
