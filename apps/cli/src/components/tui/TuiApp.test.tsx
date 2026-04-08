import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { SickbayReport, CheckResult } from 'sickbay-core';

// Mock all hooks that TuiApp depends on
vi.mock('./hooks/useSickbayRunner.js', () => ({
  useSickbayRunner: vi.fn(),
}));

vi.mock('./hooks/useFileWatcher.js', () => ({
  useFileWatcher: vi.fn(() => []),
}));

vi.mock('./hooks/useTerminalSize.js', () => ({
  useTerminalSize: vi.fn(() => ({ rows: 40, columns: 120 })),
}));

// Mock history to avoid filesystem access
vi.mock('../../lib/history.js', () => ({
  loadHistory: vi.fn(() => null),
  saveEntry: vi.fn(),
  detectRegressions: vi.fn(() => []),
}));

// Suppress ink's useInput which requires TTY
vi.mock('ink', async () => {
  const actual = await vi.importActual<typeof import('ink')>('ink');
  return {
    ...actual,
    useInput: vi.fn(),
  };
});

import { useSickbayRunner } from './hooks/useSickbayRunner.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { TuiApp } from './TuiApp.js';

const mockUseSickbayRunner = vi.mocked(useSickbayRunner);
const mockUseTerminalSize = vi.mocked(useTerminalSize);

const makeCheckResult = (id: string, score = 80): CheckResult => ({
  id,
  name: id.charAt(0).toUpperCase() + id.slice(1),
  category: 'dependencies',
  score,
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
  checks: [makeCheckResult('eslint'), makeCheckResult('knip')],
  overallScore: 78,
  summary: { critical: 0, warnings: 2, info: 3 },
  ...overrides,
});

const makeDefaultRunnerResult = (report: SickbayReport | null = null) => ({
  report,
  monorepoReport: null,
  isScanning: false,
  progress: [],
  error: null,
  scan: vi.fn().mockResolvedValue(report),
});

describe('TuiApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseTerminalSize.mockReturnValue({ rows: 40, columns: 120 });
    mockUseSickbayRunner.mockReturnValue(makeDefaultRunnerResult());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing (smoke test)', () => {
    expect(() => {
      render(<TuiApp projectPath="/test/project" watchEnabled={false} refreshInterval={0} />);
    }).not.toThrow();
  });

  it('renders HEALTH CHECKS panel title', () => {
    const { lastFrame } = render(
      <TuiApp projectPath="/test/project" watchEnabled={false} refreshInterval={0} />,
    );

    expect(lastFrame()).toContain('HEALTH CHECKS');
  });

  it('renders SCORE panel title', () => {
    const { lastFrame } = render(
      <TuiApp projectPath="/test/project" watchEnabled={false} refreshInterval={0} />,
    );

    expect(lastFrame()).toContain('SCORE');
  });

  it('renders TREND panel title', () => {
    const { lastFrame } = render(
      <TuiApp projectPath="/test/project" watchEnabled={false} refreshInterval={0} />,
    );

    expect(lastFrame()).toContain('TREND');
  });

  it('renders GIT STATUS panel title', () => {
    const { lastFrame } = render(
      <TuiApp projectPath="/test/project" watchEnabled={false} refreshInterval={0} />,
    );

    expect(lastFrame()).toContain('GIT STATUS');
  });

  it('renders QUICK WINS panel title', () => {
    const { lastFrame } = render(
      <TuiApp projectPath="/test/project" watchEnabled={false} refreshInterval={0} />,
    );

    expect(lastFrame()).toContain('QUICK WINS');
  });

  it('renders ACTIVITY panel title', () => {
    const { lastFrame } = render(
      <TuiApp projectPath="/test/project" watchEnabled={false} refreshInterval={0} />,
    );

    expect(lastFrame()).toContain('ACTIVITY');
  });

  it('shows hotkey bar with key hints', () => {
    const { lastFrame } = render(
      <TuiApp projectPath="/test/project" watchEnabled={false} refreshInterval={0} />,
    );

    const output = lastFrame();
    // HotkeyBar renders [h], [g], [t], [r], [w] etc.
    expect(output).toContain('[h]');
    expect(output).toContain('[r]');
    expect(output).toContain('[w]');
  });

  it('shows check names when a report is available', async () => {
    const report = createMockReport();
    mockUseSickbayRunner.mockReturnValue(makeDefaultRunnerResult(report));

    const { frames, lastFrame } = render(
      <TuiApp
        projectPath="/test/project"
        watchEnabled={false}
        refreshInterval={0}
        animateOnMount={false}
      />,
    );

    await new Promise((r) => setImmediate(r));

    const output = frames[frames.length - 1] ?? lastFrame();
    expect(output).toContain('Eslint');
  });

  it('shows overall score when report is available', async () => {
    const report = createMockReport({ overallScore: 78 });
    mockUseSickbayRunner.mockReturnValue(makeDefaultRunnerResult(report));

    const { lastFrame } = render(
      <TuiApp
        projectPath="/test/project"
        watchEnabled={false}
        refreshInterval={0}
        animateOnMount={false}
      />,
    );

    // animateOnMount=false: score comes directly from props (no state update),
    // panels are visible immediately — just need one event-loop cycle to render
    await new Promise((r) => setImmediate(r));

    expect(lastFrame()).toContain('78');
  });

  it('calls useSickbayRunner with the provided projectPath', () => {
    render(<TuiApp projectPath="/special/path" watchEnabled={false} refreshInterval={0} />);

    expect(mockUseSickbayRunner).toHaveBeenCalledWith(
      expect.objectContaining({ projectPath: '/special/path' }),
    );
  });

  it('passes checks filter to useSickbayRunner', () => {
    render(
      <TuiApp
        projectPath="/test/project"
        checks={['eslint', 'knip']}
        watchEnabled={false}
        refreshInterval={0}
      />,
    );

    expect(mockUseSickbayRunner).toHaveBeenCalledWith(
      expect.objectContaining({ checks: ['eslint', 'knip'] }),
    );
  });

  it('shows scanning indicator when isScanning is true', () => {
    mockUseSickbayRunner.mockReturnValue({
      ...makeDefaultRunnerResult(),
      isScanning: true,
      progress: [{ name: 'eslint', status: 'running' }],
    });

    const { lastFrame } = render(
      <TuiApp
        projectPath="/test/project"
        watchEnabled={false}
        refreshInterval={0}
        animateOnMount={false}
      />,
    );

    expect(lastFrame()).toContain('eslint');
  });

  it('renders all panel titles even with no report', () => {
    mockUseSickbayRunner.mockReturnValue(makeDefaultRunnerResult(null));

    const { lastFrame } = render(
      <TuiApp projectPath="/test/project" watchEnabled={false} refreshInterval={0} />,
    );

    const output = lastFrame();
    const panelTitles = ['HEALTH CHECKS', 'SCORE', 'TREND', 'GIT STATUS', 'QUICK WINS', 'ACTIVITY'];
    for (const title of panelTitles) {
      expect(output).toContain(title);
    }
  });
});
