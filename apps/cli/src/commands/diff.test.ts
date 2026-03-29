import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'child_process';
import { loadBaseReport, compareReports } from './diff.js';
import type { SickbayReport, CheckResult } from '@nebulord/sickbay-core';

const mockExecFileSync = vi.mocked(execFileSync);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeReport(overrides: Partial<SickbayReport> = {}): SickbayReport {
  return {
    timestamp: '2026-03-21T00:00:00Z',
    projectPath: '/test/project',
    projectInfo: {
      name: 'test',
      version: '1.0.0',
      hasTypeScript: true,
      hasESLint: true,
      hasPrettier: false,
      framework: 'react',
      packageManager: 'pnpm',
      totalDependencies: 10,
      dependencies: {},
      devDependencies: {},
    },
    checks: [],
    overallScore: 80,
    summary: { critical: 0, warnings: 0, info: 0 },
    ...overrides,
  };
}

function makeCheck(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    id: 'test-check',
    category: 'code-quality',
    name: 'Test Check',
    score: 80,
    status: 'pass',
    issues: [],
    toolsUsed: ['test'],
    duration: 100,
    ...overrides,
  };
}

describe('loadBaseReport', () => {
  it('returns parsed report when git show succeeds', () => {
    const report = makeReport({ overallScore: 75 });
    mockExecFileSync.mockReturnValue(JSON.stringify(report));

    const result = loadBaseReport('/test/project', 'main');

    expect(result).not.toBeNull();
    expect(result!.overallScore).toBe(75);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['show', 'main:.sickbay/last-report.json'],
      expect.objectContaining({ cwd: '/test/project', encoding: 'utf-8' }),
    );
  });

  it('returns null when branch does not exist', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fatal: invalid object name');
    });

    const result = loadBaseReport('/test/project', 'nonexistent');
    expect(result).toBeNull();
  });

  it('returns null when file not found on branch', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fatal: path .sickbay/last-report.json does not exist');
    });

    const result = loadBaseReport('/test/project', 'main');
    expect(result).toBeNull();
  });

  it('returns null when output is not valid JSON', () => {
    mockExecFileSync.mockReturnValue('not json');

    const result = loadBaseReport('/test/project', 'main');
    expect(result).toBeNull();
  });
});

describe('compareReports', () => {
  it('identifies improved checks', () => {
    const base = makeReport({
      checks: [makeCheck({ id: 'knip', name: 'Unused Code', score: 70 })],
      overallScore: 70,
    });
    const current = makeReport({
      checks: [makeCheck({ id: 'knip', name: 'Unused Code', score: 90 })],
      overallScore: 90,
    });

    const diff = compareReports(current, base, 'main');

    expect(diff.checks[0].status).toBe('improved');
    expect(diff.checks[0].delta).toBe(20);
  });

  it('identifies regressed checks', () => {
    const base = makeReport({
      checks: [makeCheck({ id: 'coverage', name: 'Tests & Coverage', score: 85 })],
      overallScore: 85,
    });
    const current = makeReport({
      checks: [makeCheck({ id: 'coverage', name: 'Tests & Coverage', score: 60 })],
      overallScore: 60,
    });

    const diff = compareReports(current, base, 'main');

    expect(diff.checks[0].status).toBe('regressed');
    expect(diff.checks[0].delta).toBe(-25);
  });

  it('identifies unchanged checks', () => {
    const base = makeReport({
      checks: [makeCheck({ id: 'git', name: 'Git Health', score: 100 })],
    });
    const current = makeReport({
      checks: [makeCheck({ id: 'git', name: 'Git Health', score: 100 })],
    });

    const diff = compareReports(current, base, 'main');

    expect(diff.checks[0].status).toBe('unchanged');
    expect(diff.checks[0].delta).toBe(0);
  });

  it('identifies new checks present only in current', () => {
    const base = makeReport({ checks: [] });
    const current = makeReport({
      checks: [makeCheck({ id: 'react-perf', name: 'React Perf', score: 90 })],
    });

    const diff = compareReports(current, base, 'main');

    expect(diff.checks[0].status).toBe('new');
    expect(diff.checks[0].baseScore).toBe(0);
  });

  it('identifies removed checks present only in base', () => {
    const base = makeReport({
      checks: [makeCheck({ id: 'react-perf', name: 'React Perf', score: 90 })],
    });
    const current = makeReport({ checks: [] });

    const diff = compareReports(current, base, 'main');

    expect(diff.checks[0].status).toBe('removed');
    expect(diff.checks[0].currentScore).toBe(0);
  });

  it('calculates correct overall score delta', () => {
    const base = makeReport({ overallScore: 72 });
    const current = makeReport({ overallScore: 87 });

    const diff = compareReports(current, base, 'main');

    expect(diff.currentScore).toBe(87);
    expect(diff.baseScore).toBe(72);
    expect(diff.scoreDelta).toBe(15);
  });

  it('sorts regressions first, then improvements, then unchanged', () => {
    const base = makeReport({
      checks: [
        makeCheck({ id: 'a', name: 'A', score: 80 }),
        makeCheck({ id: 'b', name: 'B', score: 80 }),
        makeCheck({ id: 'c', name: 'C', score: 80 }),
      ],
    });
    const current = makeReport({
      checks: [
        makeCheck({ id: 'a', name: 'A', score: 80 }),  // unchanged
        makeCheck({ id: 'b', name: 'B', score: 90 }),  // improved
        makeCheck({ id: 'c', name: 'C', score: 60 }),  // regressed
      ],
    });

    const diff = compareReports(current, base, 'main');

    expect(diff.checks[0].id).toBe('c');       // regressed first
    expect(diff.checks[1].id).toBe('b');       // improved second
    expect(diff.checks[2].id).toBe('a');       // unchanged last
  });

  it('calculates summary counts correctly', () => {
    const base = makeReport({
      checks: [
        makeCheck({ id: 'a', name: 'A', score: 80 }),
        makeCheck({ id: 'b', name: 'B', score: 80 }),
        makeCheck({ id: 'c', name: 'C', score: 80 }),
        makeCheck({ id: 'd', name: 'D', score: 80 }),
      ],
    });
    const current = makeReport({
      checks: [
        makeCheck({ id: 'a', name: 'A', score: 90 }),  // improved
        makeCheck({ id: 'b', name: 'B', score: 70 }),  // regressed
        makeCheck({ id: 'c', name: 'C', score: 80 }),  // unchanged
        makeCheck({ id: 'e', name: 'E', score: 85 }),  // new
      ],
    });

    const diff = compareReports(current, base, 'main');

    expect(diff.summary.improved).toBe(1);
    expect(diff.summary.regressed).toBe(1);
    expect(diff.summary.unchanged).toBe(1);
    expect(diff.summary.newChecks).toBe(1);
    expect(diff.summary.removedChecks).toBe(1);
  });

  it('includes branch name in result', () => {
    const diff = compareReports(makeReport(), makeReport(), 'develop');
    expect(diff.branch).toBe('develop');
  });
});
