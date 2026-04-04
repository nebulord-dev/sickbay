import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { ScorePanel } from './ScorePanel.js';

import type { SickbayReport } from '@nebulord/sickbay-core';

const createMockReport = (
  overallScore: number,
  summary: { critical: number; warnings: number; info: number } = {
    critical: 0,
    warnings: 0,
    info: 0,
  },
): SickbayReport => ({
  timestamp: new Date().toISOString(),
  projectPath: '/test/project',
  projectInfo: {
    name: 'test-project',
    version: '1.0.0',
    framework: 'react',
    packageManager: 'npm',
    totalDependencies: 50,
    devDependencies: {},
    dependencies: {},
    hasESLint: false,
    hasPrettier: false,
    hasTypeScript: false,
  },
  checks: [],
  overallScore,
  summary,
});

describe('ScorePanel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows waiting state when report is null', () => {
    const { lastFrame } = render(<ScorePanel report={null} previousScore={null} />);
    expect(lastFrame()).toContain('Waiting for scan...');
  });

  it('starts at 0 before animation completes', () => {
    vi.useFakeTimers(); // freeze timers so interval is cleaned up in afterEach
    const report = createMockReport(85);
    const { lastFrame } = render(<ScorePanel report={report} previousScore={null} />);
    expect(lastFrame()).toContain('0/100');
  });

  it('displays score as X/100 after animation completes', async () => {
    vi.useFakeTimers();
    const report = createMockReport(85);
    const { lastFrame } = render(<ScorePanel report={report} previousScore={null} />);
    await vi.advanceTimersByTimeAsync(2000);
    expect(lastFrame()).toContain('85/100');
  });

  it('animates from previous score on re-scan, not from 0', async () => {
    vi.useFakeTimers();
    const { rerender, lastFrame } = render(
      <ScorePanel report={createMockReport(80)} previousScore={null} />,
    );
    await vi.advanceTimersByTimeAsync(2000);
    expect(lastFrame()).toContain('80/100');

    rerender(<ScorePanel report={createMockReport(85)} previousScore={80} />);
    await vi.advanceTimersByTimeAsync(60);
    const mid = lastFrame() ?? '';
    expect(mid).not.toContain('0/100');
    await vi.advanceTimersByTimeAsync(200);
    expect(lastFrame()).toContain('85/100');
  });

  it('shows positive delta when score improved', async () => {
    vi.useFakeTimers();
    const report = createMockReport(90);
    const { lastFrame } = render(<ScorePanel report={report} previousScore={85} />);
    await vi.advanceTimersByTimeAsync(2500);
    expect(lastFrame()).toContain('+5');
    expect(lastFrame()).toContain('since last scan');
  });

  it('shows negative delta when score dropped', async () => {
    vi.useFakeTimers();
    const report = createMockReport(72);
    const { lastFrame } = render(<ScorePanel report={report} previousScore={75} />);
    await vi.advanceTimersByTimeAsync(2000);
    expect(lastFrame()).toContain('-3');
    expect(lastFrame()).toContain('since last scan');
  });

  it('shows zero delta when score is unchanged', async () => {
    vi.useFakeTimers();
    const report = createMockReport(70);
    const { lastFrame } = render(<ScorePanel report={report} previousScore={70} />);
    await vi.advanceTimersByTimeAsync(2000);
    expect(lastFrame()).toContain('since last scan');
    expect(lastFrame()).toContain('±0');
  });

  it('does not show delta when previousScore is null', async () => {
    vi.useFakeTimers();
    const report = createMockReport(80);
    const { lastFrame } = render(<ScorePanel report={report} previousScore={null} />);
    await vi.advanceTimersByTimeAsync(2000);
    expect(lastFrame()).not.toContain('since last scan');
  });

  it('shows critical count in summary', async () => {
    vi.useFakeTimers();
    const report = createMockReport(60, { critical: 3, warnings: 2, info: 5 });
    const { lastFrame } = render(<ScorePanel report={report} previousScore={null} />);
    await vi.advanceTimersByTimeAsync(2000);
    expect(lastFrame()).toContain('3 critical');
  });

  it('shows warnings count in summary', async () => {
    vi.useFakeTimers();
    const report = createMockReport(60, { critical: 0, warnings: 7, info: 2 });
    const { lastFrame } = render(<ScorePanel report={report} previousScore={null} />);
    await vi.advanceTimersByTimeAsync(2000);
    expect(lastFrame()).toContain('7 warn');
  });

  it('shows info count in summary', async () => {
    vi.useFakeTimers();
    const report = createMockReport(75, { critical: 0, warnings: 0, info: 4 });
    const { lastFrame } = render(<ScorePanel report={report} previousScore={null} />);
    await vi.advanceTimersByTimeAsync(2000);
    expect(lastFrame()).toContain('4 info');
  });

  it('renders score bar characters after animation', async () => {
    vi.useFakeTimers();
    const report = createMockReport(85);
    const { lastFrame } = render(<ScorePanel report={report} previousScore={null} />);
    await vi.advanceTimersByTimeAsync(2000);
    expect(lastFrame()).toContain('█');
  });

  it('renders score of 0 without animation needed', () => {
    const report = createMockReport(0);
    const { lastFrame } = render(<ScorePanel report={report} previousScore={null} />);
    expect(lastFrame()).toContain('0/100');
  });

  it('renders score of 100 after animation completes', async () => {
    vi.useFakeTimers();
    const report = createMockReport(100);
    const { lastFrame } = render(<ScorePanel report={report} previousScore={null} />);
    await vi.advanceTimersByTimeAsync(2500);
    expect(lastFrame()).toContain('100/100');
  });

  it('renders quote when present on report', () => {
    const report = {
      ...createMockReport(75),
      quote: {
        text: "I'm a doctor, not an engineer!",
        source: 'Dr. McCoy',
        severity: 'warning' as const,
      },
    };
    const { lastFrame } = render(
      <ScorePanel report={report} previousScore={null} animate={false} />,
    );
    expect(lastFrame()).toContain("I'm a doctor, not an engineer!");
    expect(lastFrame()).toContain('Dr. McCoy');
  });

  it('does not render quote when absent', () => {
    const report = createMockReport(75);
    const { lastFrame } = render(
      <ScorePanel report={report} previousScore={null} animate={false} />,
    );
    expect(lastFrame()).not.toContain('Dr. McCoy');
  });

  it('shows custom config badge when config is active', () => {
    const report = {
      ...createMockReport(75),
      config: { hasCustomConfig: true, overriddenChecks: [], disabledChecks: ['knip'] },
    };
    const { lastFrame } = render(
      <ScorePanel report={report} previousScore={null} animate={false} />,
    );
    expect(lastFrame()).toContain('Custom config');
  });
});
