import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { SickbayReport, CheckResult } from 'sickbay-core';

// Mock sickbay-core before importing App — must include all exports used by sub-components
vi.mock('sickbay-core', () => ({
  runSickbay: vi.fn(),
  getScoreEmoji: (score: number) => {
    if (score >= 90) return 'Good';
    if (score >= 80) return 'Fair';
    if (score >= 60) return 'Poor';
    return 'Bad';
  },
  getScoreColor: (score: number) => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    return 'red';
  },
  buildSummary: vi.fn(() => ({ critical: 0, warnings: 0, info: 0 })),
  detectProject: vi.fn(),
  detectPackageManager: vi.fn(),
}));

// Mock dynamic imports used in App's useEffect
vi.mock('../lib/history.js', () => ({
  saveEntry: vi.fn(),
}));

vi.mock('../commands/web.js', () => ({
  serveWeb: vi.fn(),
}));

vi.mock('open', () => ({
  default: vi.fn(),
}));

// Mock ink's useApp so the test process doesn't exit
vi.mock('ink', async () => {
  const actual = await vi.importActual<typeof import('ink')>('ink');
  return { ...actual, useApp: () => ({ exit: vi.fn() }) };
});

import { runSickbay } from 'sickbay-core';

import { serveWeb } from '../commands/web.js';
import { App } from './App.js';

const mockRunSickbay = vi.mocked(runSickbay);
const mockServeWeb = vi.mocked(serveWeb);

const { act } = React;

const makeCheckResult = (id: string, name: string): CheckResult => ({
  id,
  name,
  category: 'dependencies',
  score: 80,
  status: 'pass',
  issues: [],
  toolsUsed: [id],
  duration: 100,
});

const createMockReport = (overrides?: Partial<SickbayReport>): SickbayReport => ({
  timestamp: new Date().toISOString(),
  projectPath: '/test/project',
  projectInfo: {
    name: 'test-project',
    version: '1.0.0',
    framework: 'react',
    packageManager: 'npm',
    totalDependencies: 10,
    devDependencies: {},
    dependencies: {},
    hasESLint: false,
    hasPrettier: false,
    hasTypeScript: false,
  },
  checks: [makeCheckResult('knip', 'Knip'), makeCheckResult('eslint', 'ESLint')],
  overallScore: 82,
  summary: { critical: 0, warnings: 1, info: 2 },
  ...overrides,
});

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading message immediately on render', () => {
    // Never resolves — keep app in loading phase
    mockRunSickbay.mockReturnValue(new Promise(() => {}));

    const { lastFrame } = render(<App projectPath="/test/project" />);

    expect(lastFrame()).toContain('Running health checks...');
  });

  it('shows error message when runSickbay rejects', async () => {
    const error = new Error('Analysis failed: no package.json');
    mockRunSickbay.mockRejectedValue(error);

    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<App projectPath="/test/project" />);
      // Flush microtasks so the rejection propagates
      await Promise.resolve();
      await Promise.resolve();
    });

    const output = result.lastFrame();
    expect(output).toContain('Error');
    expect(output).toContain('Analysis failed: no package.json');
  });

  it('shows check results after runSickbay resolves', async () => {
    const report = createMockReport();
    mockRunSickbay.mockResolvedValue(report);

    const result = render(<App projectPath="/test/project" />);
    // The component's useEffect calls runSickbay → .then() does a dynamic import
    // (await import("../lib/history.js")) before setting phase to "results".
    // setTimeout lets microtasks, the dynamic import, and React's render all flush.
    await new Promise((r) => setTimeout(r, 50));

    const output = result.lastFrame();
    // In results phase, check names are rendered via CheckResultRow
    expect(output).toContain('Knip');
  });

  it('shows sickbay --web hint after results phase', async () => {
    const report = createMockReport();
    mockRunSickbay.mockResolvedValue(report);

    const result = render(<App projectPath="/test/project" />);
    await new Promise((r) => setTimeout(r, 50));

    expect(result.lastFrame()).toContain('sickbay --web');
  });

  it('displays the overall score in results', async () => {
    const report = createMockReport({ overallScore: 91 });
    mockRunSickbay.mockResolvedValue(report);

    const result = render(<App projectPath="/test/project" />);
    await new Promise((r) => setTimeout(r, 50));

    expect(result.lastFrame()).toContain('91');
  });

  it('passes checks filter to runSickbay', () => {
    mockRunSickbay.mockReturnValue(new Promise(() => {}));

    render(<App projectPath="/test/project" checks={['eslint', 'knip']} />);

    expect(mockRunSickbay).toHaveBeenCalledWith(
      expect.objectContaining({ checks: ['eslint', 'knip'] }),
    );
  });

  it('calls runSickbay with the correct projectPath', () => {
    mockRunSickbay.mockReturnValue(new Promise(() => {}));

    render(<App projectPath="/my/special/path" />);

    expect(mockRunSickbay).toHaveBeenCalledWith(
      expect.objectContaining({ projectPath: '/my/special/path' }),
    );
  });

  it('shows progress items for each check in loading phase', async () => {
    mockRunSickbay.mockImplementation((options: Parameters<typeof runSickbay>[0]) => {
      options?.onRunnersReady?.(['eslint', 'knip']);
      return new Promise(() => {});
    });

    // setProgress(initial) is called inside useEffect, which fires after the first
    // render. Wrap in act + Promise.resolve so the effect flushes before we assert.
    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<App projectPath="/test/project" checks={['eslint', 'knip']} />);
      await Promise.resolve();
    });

    const output = result.lastFrame();
    expect(output).toContain('Running health checks...');
    // ProgressList renders each check name
    expect(output).toContain('eslint');
    expect(output).toContain('knip');
  });

  it('calls runSickbay exactly once even in strict mode', () => {
    mockRunSickbay.mockReturnValue(new Promise(() => {}));

    render(<App projectPath="/test/project" />);

    // hasRun ref prevents double execution
    expect(mockRunSickbay).toHaveBeenCalledTimes(1);
  });

  it('invokes onCheckStart and onCheckComplete callbacks without crashing', async () => {
    let capturedOnCheckStart: ((name: string) => void) | undefined;
    let capturedOnCheckComplete: ((result: ReturnType<typeof makeCheckResult>) => void) | undefined;

    mockRunSickbay.mockImplementation((options: Parameters<typeof runSickbay>[0]) => {
      capturedOnCheckStart = options?.onCheckStart;
      capturedOnCheckComplete = options?.onCheckComplete;
      return new Promise(() => {}); // never resolves — stay in loading phase
    });

    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<App projectPath="/test" checks={['eslint']} />);
      await Promise.resolve();
    });

    await act(async () => {
      capturedOnCheckStart?.('eslint');
      capturedOnCheckComplete?.(makeCheckResult('eslint', 'ESLint'));
      await Promise.resolve();
    });

    // Still in loading phase — callbacks fired without error
    expect(result.lastFrame()).toContain('Running health checks...');
  });

  it('enters opening-web phase and shows dashboard URL when openWeb is true', async () => {
    const report = createMockReport();
    mockRunSickbay.mockResolvedValue(report);
    mockServeWeb.mockResolvedValue('http://localhost:3030');

    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<App projectPath="/test" openWeb={true} />);
      // Flush: effect → runSickbay resolves → saveEntry import → web.js import →
      // serveWeb resolves → open import → openBrowser → state settle
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });

    expect(result.lastFrame()).toContain('Dashboard running at');
  });

  it('shows error phase when web server fails to start', async () => {
    const report = createMockReport();
    mockRunSickbay.mockResolvedValue(report);
    mockServeWeb.mockRejectedValue(new Error('Port already in use'));

    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<App projectPath="/test" openWeb={true} />);
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });

    expect(result.lastFrame()).toContain('Port already in use');
  });

  it('shows overall score summary after resolving', async () => {
    const report = createMockReport({
      overallScore: 75,
      summary: { critical: 1, warnings: 3, info: 5 },
    });
    mockRunSickbay.mockResolvedValue(report);

    const result = render(<App projectPath="/test/project" />);
    await new Promise((r) => setTimeout(r, 50));

    const output = result.lastFrame();
    expect(output).toContain('Overall Health Score');
  });
});
