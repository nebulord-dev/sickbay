import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';

import { BestPractices } from './BestPractices.js';

import type { SickbayReport, Recommendation } from '@nebulord/sickbay-core';

const createMockReport = (recommendations?: Recommendation[]): SickbayReport => ({
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
  summary: { critical: 0, warnings: 0, info: 0 },
  recommendations,
});

describe('BestPractices', () => {
  it('returns null when no recommendations exist', () => {
    const report = createMockReport();
    const { lastFrame } = render(<BestPractices report={report} />);
    expect(lastFrame()).toBe('');
  });

  it('returns null when recommendations array is empty', () => {
    const report = createMockReport([]);
    const { lastFrame } = render(<BestPractices report={report} />);
    expect(lastFrame()).toBe('');
  });

  it('displays advisor header when recommendations exist', () => {
    const report = createMockReport([
      {
        id: 'react-error-boundary',
        framework: 'react',
        title: 'Add Error Boundaries',
        message: 'No error boundaries detected.',
        severity: 'recommend',
      },
    ]);

    const { lastFrame } = render(<BestPractices report={report} />);
    expect(lastFrame()).toContain('Advisor');
  });

  it('displays recommendation titles and messages', () => {
    const report = createMockReport([
      {
        id: 'react-suspense',
        framework: 'react',
        title: 'Use Suspense',
        message: 'No Suspense boundaries found.',
        severity: 'suggest',
      },
    ]);

    const { lastFrame } = render(<BestPractices report={report} />);
    const output = lastFrame();
    expect(output).toContain('Use Suspense');
    expect(output).toContain('No Suspense boundaries found.');
  });

  it('sorts recommend before suggest', () => {
    const report = createMockReport([
      {
        id: 'react-suspense',
        framework: 'react',
        title: 'Suggest Item',
        message: 'A suggestion.',
        severity: 'suggest',
      },
      {
        id: 'react-error-boundary',
        framework: 'react',
        title: 'Recommend Item',
        message: 'A recommendation.',
        severity: 'recommend',
      },
    ]);

    const { lastFrame } = render(<BestPractices report={report} />);
    const output = lastFrame()!;
    const recommendPos = output.indexOf('Recommend Item');
    const suggestPos = output.indexOf('Suggest Item');
    expect(recommendPos).toBeLessThan(suggestPos);
  });

  it('limits display to 5 recommendations', () => {
    const recs: Recommendation[] = Array.from({ length: 8 }, (_, i) => ({
      id: `rec-${i}`,
      framework: 'react' as const,
      title: `Recommendation ${i}`,
      message: `Message ${i}`,
      severity: 'suggest' as const,
    }));

    const report = createMockReport(recs);
    const { lastFrame } = render(<BestPractices report={report} />);
    const output = lastFrame()!;

    expect(output).toContain('Recommendation 0');
    expect(output).toContain('Recommendation 4');
    expect(output).not.toContain('Recommendation 5');
  });
});
