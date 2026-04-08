import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { SickbayReport } from '@nebulord/sickbay-core';

vi.mock('@nebulord/sickbay-core', () => ({
  runSickbay: vi.fn(),
}));

vi.mock('../commands/diff.js', () => ({
  loadBaseReport: vi.fn(),
  compareReports: vi.fn(),
}));

vi.mock('../lib/history.js', () => ({
  saveEntry: vi.fn(),
  saveLastReport: vi.fn(),
}));

import { runSickbay } from '@nebulord/sickbay-core';

import { loadBaseReport, compareReports } from '../commands/diff.js';
import { DiffApp } from './DiffApp.js';

import type { DiffResult } from '../commands/diff.js';

const mockRunSickbay = vi.mocked(runSickbay);
const mockLoadBaseReport = vi.mocked(loadBaseReport);
const mockCompareReports = vi.mocked(compareReports);

function makeReport(score: number): SickbayReport {
  return {
    timestamp: '2026-03-21T00:00:00Z',
    projectPath: '/test/project',
    projectInfo: {
      name: 'test-project',
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
    checks: [
      {
        id: 'knip',
        category: 'dependencies',
        name: 'Unused Code',
        score: score,
        status: 'pass',
        issues: [],
        toolsUsed: ['knip'],
        duration: 100,
      },
    ],
    overallScore: score,
    summary: { critical: 0, warnings: 0, info: 0 },
  };
}

function makeDiffResult(overrides: Partial<DiffResult> = {}): DiffResult {
  return {
    branch: 'main',
    currentScore: 90,
    baseScore: 80,
    scoreDelta: 10,
    checks: [
      {
        id: 'knip',
        name: 'Unused Code',
        category: 'dependencies',
        currentScore: 90,
        baseScore: 80,
        delta: 10,
        status: 'improved',
      },
    ],
    summary: {
      improved: 1,
      regressed: 0,
      unchanged: 0,
      newChecks: 0,
      removedChecks: 0,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DiffApp', () => {
  // DiffApp's render lifecycle ends with `setTimeout(() => exit(), 100)` after
  // the results phase, which unmounts the component. On slow CI runners
  // (specifically the Windows matrix), this race causes `lastFrame()` to
  // sometimes return the post-unmount empty state ('\n') by the time
  // vi.waitFor's poll runs. The fix is to check ALL rendered frames via
  // ink-testing-library's `frames` array — even if the last frame is post-
  // unmount, an earlier frame contains the rendered content we're asserting on.
  function joinFrames(frames: readonly string[]): string {
    return frames.join('\n');
  }

  it('shows error when base report is not found on branch', async () => {
    mockRunSickbay.mockResolvedValue(makeReport(90));
    mockLoadBaseReport.mockReturnValue(null);

    const { frames } = render(
      React.createElement(DiffApp, {
        projectPath: '/test/project',
        branch: 'main',
        jsonOutput: false,
      }),
    );

    await vi.waitFor(() => {
      const output = joinFrames(frames);
      expect(output).toContain('main');
      expect(output).toContain('No saved report');
      expect(output).toContain('commit');
    });
  });

  it('renders diff table with score deltas', async () => {
    mockRunSickbay.mockResolvedValue(makeReport(90));
    mockLoadBaseReport.mockReturnValue(makeReport(80));
    mockCompareReports.mockReturnValue(makeDiffResult());

    const { frames } = render(
      React.createElement(DiffApp, {
        projectPath: '/test/project',
        branch: 'main',
        jsonOutput: false,
      }),
    );

    await vi.waitFor(() => {
      const output = joinFrames(frames);
      expect(output).toContain('Unused Code');
      expect(output).toContain('+10');
    });
  });

  it('shows overall score delta', async () => {
    mockRunSickbay.mockResolvedValue(makeReport(90));
    mockLoadBaseReport.mockReturnValue(makeReport(80));
    mockCompareReports.mockReturnValue(makeDiffResult());

    const { frames } = render(
      React.createElement(DiffApp, {
        projectPath: '/test/project',
        branch: 'main',
        jsonOutput: false,
      }),
    );

    await vi.waitFor(() => {
      const output = joinFrames(frames);
      expect(output).toContain('90');
      expect(output).toContain('80');
    });
  });

  it('outputs JSON when jsonOutput is true', async () => {
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    mockRunSickbay.mockResolvedValue(makeReport(90));
    mockLoadBaseReport.mockReturnValue(makeReport(80));
    mockCompareReports.mockReturnValue(makeDiffResult());

    render(
      React.createElement(DiffApp, {
        projectPath: '/test/project',
        branch: 'main',
        jsonOutput: true,
      }),
    );

    await vi.waitFor(() => {
      expect(stdoutWrite).toHaveBeenCalled();
      const output = stdoutWrite.mock.calls.map((c) => c[0]).join('');
      expect(output).toContain('"scoreDelta"');
    });

    stdoutWrite.mockRestore();
  });

  it('shows summary counts', async () => {
    mockRunSickbay.mockResolvedValue(makeReport(90));
    mockLoadBaseReport.mockReturnValue(makeReport(80));
    mockCompareReports.mockReturnValue(
      makeDiffResult({
        summary: {
          improved: 3,
          regressed: 1,
          unchanged: 8,
          newChecks: 0,
          removedChecks: 0,
        },
      }),
    );

    const { frames } = render(
      React.createElement(DiffApp, {
        projectPath: '/test/project',
        branch: 'main',
        jsonOutput: false,
      }),
    );

    await vi.waitFor(() => {
      const output = joinFrames(frames);
      expect(output).toContain('3 improved');
      expect(output).toContain('1 regressed');
    });
  });
});
