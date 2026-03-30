import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';

import { Summary } from './Summary.js';

import type { SickbayReport } from '@nebulord/sickbay-core';

const createMockReport = (overrides?: Partial<SickbayReport>): SickbayReport => ({
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
  overallScore: 85,
  summary: {
    critical: 2,
    warnings: 5,
    info: 10,
  },
  ...overrides,
});

describe('Summary', () => {
  it('renders overall score', () => {
    const report = createMockReport({ overallScore: 92 });
    const { lastFrame } = render(<Summary report={report} />);

    expect(lastFrame()).toContain('Overall Health Score');
    expect(lastFrame()).toContain('92');
  });

  it('displays critical issues count', () => {
    const report = createMockReport({
      summary: { critical: 3, warnings: 0, info: 0 },
    });
    const { lastFrame } = render(<Summary report={report} />);

    expect(lastFrame()).toContain('3 critical');
  });

  it('displays warning count', () => {
    const report = createMockReport({
      summary: { critical: 0, warnings: 7, info: 0 },
    });
    const { lastFrame } = render(<Summary report={report} />);

    expect(lastFrame()).toContain('7 warnings');
  });

  it('displays info count', () => {
    const report = createMockReport({
      summary: { critical: 0, warnings: 0, info: 12 },
    });
    const { lastFrame } = render(<Summary report={report} />);

    expect(lastFrame()).toContain('12 info');
  });

  it('shows all issue counts together', () => {
    const report = createMockReport({
      summary: { critical: 1, warnings: 2, info: 3 },
    });
    const { lastFrame } = render(<Summary report={report} />);

    const output = lastFrame();
    expect(output).toContain('1 critical');
    expect(output).toContain('2 warnings');
    expect(output).toContain('3 info');
  });

  it('displays score emoji based on score value', () => {
    const highScore = createMockReport({ overallScore: 95 });
    const { lastFrame: highFrame } = render(<Summary report={highScore} />);
    expect(highFrame()).toContain('Good');

    const mediumScore = createMockReport({ overallScore: 75 });
    const { lastFrame: medFrame } = render(<Summary report={mediumScore} />);
    expect(medFrame()).toContain('Poor');
  });

  it('handles zero counts gracefully', () => {
    const report = createMockReport({
      summary: { critical: 0, warnings: 0, info: 0 },
    });
    const { lastFrame } = render(<Summary report={report} />);

    const output = lastFrame();
    expect(output).toContain('0 critical');
    expect(output).toContain('0 warnings');
    expect(output).toContain('0 info');
  });

  it('renders quote when present on report', () => {
    const report = createMockReport({
      quote: { text: "He's dead, Jim.", source: 'Dr. McCoy', severity: 'critical' },
    });
    const { lastFrame } = render(<Summary report={report} />);

    const output = lastFrame();
    expect(output).toContain("He's dead, Jim.");
    expect(output).toContain('Dr. McCoy');
  });

  it('does not render quote section when report.quote is undefined', () => {
    const report = createMockReport();
    const { lastFrame } = render(<Summary report={report} />);

    const output = lastFrame();
    expect(output).not.toContain('Dr. McCoy');
  });
});
