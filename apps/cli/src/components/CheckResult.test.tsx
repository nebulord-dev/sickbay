import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { CheckResultRow } from './CheckResult.js';
import type { CheckResult } from '@sickbay/core';

function makeResult(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    id: 'eslint',
    category: 'code-quality',
    name: 'Lint',
    score: 90,
    status: 'pass',
    issues: [],
    toolsUsed: ['eslint'],
    duration: 100,
    ...overrides,
  };
}

describe('CheckResultRow', () => {
  it('renders the check name', () => {
    const { lastFrame } = render(<CheckResultRow result={makeResult({ name: 'Type Safety' })} />);
    expect(lastFrame()).toContain('Type Safety');
  });

  it('renders all tools used', () => {
    const { lastFrame } = render(
      <CheckResultRow result={makeResult({ toolsUsed: ['tsc', 'eslint'] })} />,
    );
    expect(lastFrame()).toContain('tsc, eslint');
  });

  it('renders pass status with check icon', () => {
    const { lastFrame } = render(<CheckResultRow result={makeResult({ status: 'pass' })} />);
    expect(lastFrame()).toContain('pass');
    expect(lastFrame()).toContain('✓');
  });

  it('renders fail status with cross icon', () => {
    const { lastFrame } = render(<CheckResultRow result={makeResult({ status: 'fail' })} />);
    expect(lastFrame()).toContain('fail');
    expect(lastFrame()).toContain('✗');
  });

  it('renders warning status', () => {
    const { lastFrame } = render(<CheckResultRow result={makeResult({ status: 'warning' })} />);
    expect(lastFrame()).toContain('warning');
    expect(lastFrame()).toContain('⚠');
  });

  it('renders skipped status with circle icon', () => {
    const { lastFrame } = render(<CheckResultRow result={makeResult({ status: 'skipped' })} />);
    expect(lastFrame()).toContain('skipped');
    expect(lastFrame()).toContain('○');
  });

  it('renders up to 3 issues inline', () => {
    const issues = [
      { severity: 'warning' as const, message: 'Issue One', reportedBy: ['eslint'] },
      { severity: 'warning' as const, message: 'Issue Two', reportedBy: ['eslint'] },
      { severity: 'warning' as const, message: 'Issue Three', reportedBy: ['eslint'] },
    ];
    const { lastFrame } = render(<CheckResultRow result={makeResult({ issues })} />);
    const output = lastFrame() ?? '';
    expect(output).toContain('Issue One');
    expect(output).toContain('Issue Two');
    expect(output).toContain('Issue Three');
  });

  it('shows overflow count when more than 3 issues', () => {
    const issues = Array.from({ length: 5 }, (_, i) => ({
      severity: 'info' as const,
      message: `Issue ${i}`,
      reportedBy: ['eslint'],
    }));
    const { lastFrame } = render(<CheckResultRow result={makeResult({ issues })} />);
    expect(lastFrame()).toContain('2 more');
  });

  it('does not show overflow label when exactly 3 issues', () => {
    const issues = Array.from({ length: 3 }, (_, i) => ({
      severity: 'info' as const,
      message: `Issue ${i}`,
      reportedBy: ['eslint'],
    }));
    const { lastFrame } = render(<CheckResultRow result={makeResult({ issues })} />);
    expect(lastFrame()).not.toContain('more');
  });

  it('renders critical issue with ✗ indicator', () => {
    const { lastFrame } = render(
      <CheckResultRow
        result={makeResult({
          issues: [{ severity: 'critical', message: 'Critical problem', reportedBy: ['tool'] }],
        })}
      />,
    );
    expect(lastFrame()).toContain('Critical problem');
  });

  it('renders score bar', () => {
    const { lastFrame } = render(<CheckResultRow result={makeResult({ score: 75 })} />);
    expect(lastFrame()).toContain('75');
  });
});
