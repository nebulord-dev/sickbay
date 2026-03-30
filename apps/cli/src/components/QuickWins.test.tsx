import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';

import { QuickWins } from './QuickWins.js';

import type { SickbayReport, CheckResult, Issue } from '@nebulord/sickbay-core';

const createMockReport = (checks: CheckResult[]): SickbayReport => ({
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
  checks,
  overallScore: 85,
  summary: { critical: 0, warnings: 0, info: 0 },
});

const createCheckWithIssues = (issues: Issue[]): CheckResult => ({
  id: 'test-check',
  name: 'Test Check',
  category: 'dependencies',
  score: 80,
  status: 'pass',
  issues,
  toolsUsed: ['test'],
  duration: 100,
});

describe('QuickWins', () => {
  it('returns null when no fixable issues exist', () => {
    const report = createMockReport([
      createCheckWithIssues([
        { severity: 'info', message: 'No fix available', reportedBy: ['test'] },
      ]),
    ]);

    const { lastFrame } = render(<QuickWins report={report} />);
    expect(lastFrame()).toBe('');
  });

  it('displays quick wins header when fixes available', () => {
    const report = createMockReport([
      createCheckWithIssues([
        {
          severity: 'warning',
          message: 'Issue',
          fix: { description: 'Fix it', command: 'npm fix' },
          reportedBy: ['test'],
        },
      ]),
    ]);

    const { lastFrame } = render(<QuickWins report={report} />);
    expect(lastFrame()).toContain('Quick Wins');
  });

  it('shows fix descriptions', () => {
    const report = createMockReport([
      createCheckWithIssues([
        {
          severity: 'critical',
          message: 'Security issue',
          fix: {
            description: 'Update package to v2',
            command: 'npm update pkg',
          },
          reportedBy: ['test'],
        },
      ]),
    ]);

    const { lastFrame } = render(<QuickWins report={report} />);
    expect(lastFrame()).toContain('Update package to v2');
  });

  it('shows fix commands', () => {
    const report = createMockReport([
      createCheckWithIssues([
        {
          severity: 'warning',
          message: 'Outdated',
          fix: { description: 'Update dep', command: 'npm install foo@latest' },
          reportedBy: ['test'],
        },
      ]),
    ]);

    const { lastFrame } = render(<QuickWins report={report} />);
    expect(lastFrame()).toContain('npm install foo@latest');
  });

  it('prioritizes critical issues first', () => {
    const report = createMockReport([
      createCheckWithIssues([
        {
          severity: 'info',
          message: 'Info issue',
          fix: { description: 'Info fix', command: 'cmd3' },
          reportedBy: ['test'],
        },
        {
          severity: 'critical',
          message: 'Critical issue',
          fix: { description: 'Critical fix', command: 'cmd1' },
          reportedBy: ['test'],
        },
        {
          severity: 'warning',
          message: 'Warning issue',
          fix: { description: 'Warning fix', command: 'cmd2' },
          reportedBy: ['test'],
        },
      ]),
    ]);

    const { lastFrame } = render(<QuickWins report={report} />);
    const output = lastFrame();

    const criticalPos = output?.indexOf('Critical fix') ?? -1;
    const warningPos = output?.indexOf('Warning fix') ?? -1;
    const infoPos = output?.indexOf('Info fix') ?? -1;

    expect(criticalPos).toBeLessThan(warningPos);
    expect(warningPos).toBeLessThan(infoPos);
  });

  it('limits display to 5 fixes maximum', () => {
    const issues: Issue[] = Array.from({ length: 10 }, (_, i) => ({
      severity: 'warning' as const,
      message: `Issue ${i}`,
      fix: { description: `Fix ${i}`, command: `cmd${i}` },
      reportedBy: ['test'],
    }));

    const report = createMockReport([createCheckWithIssues(issues)]);
    const { lastFrame } = render(<QuickWins report={report} />);
    const output = lastFrame();

    // Should show only 5 fixes
    expect(output).toContain('Fix 0');
    expect(output).toContain('Fix 4');
    expect(output).not.toContain('Fix 5');
  });

  it('aggregates fixes from multiple checks', () => {
    const report = createMockReport([
      createCheckWithIssues([
        {
          severity: 'critical',
          message: 'Issue 1',
          fix: { description: 'Fix from check 1', command: 'cmd1' },
          reportedBy: ['test'],
        },
      ]),
      createCheckWithIssues([
        {
          severity: 'warning',
          message: 'Issue 2',
          fix: { description: 'Fix from check 2', command: 'cmd2' },
          reportedBy: ['test'],
        },
      ]),
    ]);

    const { lastFrame } = render(<QuickWins report={report} />);
    const output = lastFrame();

    expect(output).toContain('Fix from check 1');
    expect(output).toContain('Fix from check 2');
  });
});
