import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { TrendHistory } from '../../lib/history.js';

vi.mock('../../lib/history.js', () => ({
  loadHistory: vi.fn(),
}));

import { loadHistory } from '../../lib/history.js';
import { TrendPanel } from './TrendPanel.js';

const mockLoadHistory = vi.mocked(loadHistory);

// React.act flushes passive effects (useEffect callbacks)
const { act } = React;

const makeTrendHistory = (
  scores: number[],
  categoryScores?: Record<string, number>,
): TrendHistory => ({
  projectPath: '/test/project',
  projectName: 'test-project',
  entries: scores.map((score, i) => ({
    timestamp: new Date(Date.now() - (scores.length - i) * 60000).toISOString(),
    overallScore: score,
    categoryScores: categoryScores ?? { dependencies: score, security: score },
    summary: { critical: 0, warnings: 0, info: 0 },
    checksRun: 5,
  })),
});

/** Render and flush all pending React passive effects (useEffect). */
async function renderAndFlush(ui: React.ReactElement) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(ui);
  });
  return result;
}

describe('TrendPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'No trend data yet' when loadHistory returns null", async () => {
    mockLoadHistory.mockReturnValue(null);

    const { lastFrame } = await renderAndFlush(
      <TrendPanel projectPath="/test/project" lastScanTime={null} />,
    );

    expect(lastFrame()).toContain('No trend data yet');
  });

  it("shows 'No trend data yet' when history has no entries", async () => {
    mockLoadHistory.mockReturnValue({
      projectPath: '/test/project',
      projectName: 'test-project',
      entries: [],
    });

    const { lastFrame } = await renderAndFlush(
      <TrendPanel projectPath="/test/project" lastScanTime={null} />,
    );

    expect(lastFrame()).toContain('No trend data yet');
  });

  it("shows 'Overall' label when history has one entry", async () => {
    mockLoadHistory.mockReturnValue(makeTrendHistory([75]));

    const { lastFrame } = await renderAndFlush(
      <TrendPanel projectPath="/test/project" lastScanTime={null} />,
    );

    expect(lastFrame()).toContain('Overall');
  });

  it('shows the latest score when history has one entry', async () => {
    mockLoadHistory.mockReturnValue(makeTrendHistory([77]));

    const { lastFrame } = await renderAndFlush(
      <TrendPanel projectPath="/test/project" lastScanTime={null} />,
    );

    expect(lastFrame()).toContain('77');
  });

  it('shows category labels from history entries', async () => {
    mockLoadHistory.mockReturnValue(makeTrendHistory([70, 80], { dependencies: 70, security: 80 }));

    const { lastFrame } = await renderAndFlush(
      <TrendPanel projectPath="/test/project" lastScanTime={null} />,
    );

    // SHORT_LABELS maps 'dependencies' → 'Deps', 'security' → 'Security'
    expect(lastFrame()).toContain('Deps');
    expect(lastFrame()).toContain('Security');
  });

  it('shows multiple score entries in trend output', async () => {
    mockLoadHistory.mockReturnValue(makeTrendHistory([60, 70, 80]));

    const { lastFrame } = await renderAndFlush(
      <TrendPanel projectPath="/test/project" lastScanTime={null} />,
    );

    // The latest score (80) should appear in the output
    expect(lastFrame()).toContain('80');
  });

  it('re-fetches history when lastScanTime changes', async () => {
    const history = makeTrendHistory([75]);
    mockLoadHistory.mockReturnValue(history);

    const now = new Date();
    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<TrendPanel projectPath="/test/project" lastScanTime={null} />);
    });

    // Update with a new scan time
    await act(async () => {
      result.rerender(<TrendPanel projectPath="/test/project" lastScanTime={now} />);
    });

    // loadHistory called at least twice (once for initial render, once after rerender)
    expect(mockLoadHistory).toHaveBeenCalledTimes(2);
  });

  it('respects availableHeight by slicing visible rows', async () => {
    // Provide history with overall + 3 categories = 4 rows
    mockLoadHistory.mockReturnValue(
      makeTrendHistory([80, 85], {
        dependencies: 80,
        security: 85,
        'code-quality': 90,
      }),
    );

    const { lastFrame } = await renderAndFlush(
      <TrendPanel projectPath="/test/project" lastScanTime={null} availableHeight={2} />,
    );

    const output = lastFrame();
    // Only first 2 rows visible — 'Overall' should be there
    expect(output).toContain('Overall');
    // 'Quality' is SHORT_LABELS for 'code-quality' — 3rd category row, clipped at height=2
    expect(output).not.toContain('Quality');
  });

  it('shows trend arrow for stable scores', async () => {
    // All same values → stable trend (±0)
    mockLoadHistory.mockReturnValue(makeTrendHistory([75, 75, 75]));

    const { lastFrame } = await renderAndFlush(
      <TrendPanel projectPath="/test/project" lastScanTime={null} />,
    );

    expect(lastFrame()).toContain('±0');
  });

  it('shows Overall label and sparkline for a single entry', async () => {
    mockLoadHistory.mockReturnValue(makeTrendHistory([88]));

    const { lastFrame } = await renderAndFlush(
      <TrendPanel projectPath="/test/project" lastScanTime={null} />,
    );

    const output = lastFrame();
    expect(output).toContain('Overall');
    expect(output).toContain('88');
  });
});
