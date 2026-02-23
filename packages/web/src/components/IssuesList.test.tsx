import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IssuesList } from './IssuesList.js';
import type { CheckResult } from '@vitals/core';

function makeCheck(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    id: 'test',
    name: 'Test Check',
    category: 'security',
    score: 80,
    status: 'pass',
    issues: [],
    toolsUsed: ['test'],
    duration: 100,
    ...overrides,
  };
}

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

describe('IssuesList', () => {
  it('shows empty state when there are no issues', () => {
    render(<IssuesList checks={[makeCheck()]} />);
    expect(screen.getByText(/No issues found/)).toBeInTheDocument();
  });

  it('renders all issues by default', () => {
    const check = makeCheck({
      issues: [
        { severity: 'critical', message: 'Critical bug', reportedBy: ['test'] },
        { severity: 'warning', message: 'Warning here', reportedBy: ['test'] },
        { severity: 'info', message: 'Info note', reportedBy: ['test'] },
      ],
    });
    render(<IssuesList checks={[check]} />);
    expect(screen.getByText('Critical bug')).toBeInTheDocument();
    expect(screen.getByText('Warning here')).toBeInTheDocument();
    expect(screen.getByText('Info note')).toBeInTheDocument();
  });

  it('shows correct counts in filter buttons', () => {
    const check = makeCheck({
      issues: [
        { severity: 'critical', message: 'C1', reportedBy: ['test'] },
        { severity: 'critical', message: 'C2', reportedBy: ['test'] },
        { severity: 'warning', message: 'W1', reportedBy: ['test'] },
      ],
    });
    render(<IssuesList checks={[check]} />);
    expect(screen.getByText('all (3)')).toBeInTheDocument();
    expect(screen.getByText('critical (2)')).toBeInTheDocument();
    expect(screen.getByText('warning (1)')).toBeInTheDocument();
    expect(screen.getByText('info (0)')).toBeInTheDocument();
  });

  it('filters to only critical issues when critical button is clicked', () => {
    const check = makeCheck({
      issues: [
        { severity: 'critical', message: 'Critical issue', reportedBy: ['test'] },
        { severity: 'warning', message: 'Warning issue', reportedBy: ['test'] },
      ],
    });
    render(<IssuesList checks={[check]} />);
    fireEvent.click(screen.getByText('critical (1)'));
    expect(screen.getByText('Critical issue')).toBeInTheDocument();
    expect(screen.queryByText('Warning issue')).not.toBeInTheDocument();
  });

  it('filters to only info issues when info button is clicked', () => {
    const check = makeCheck({
      issues: [
        { severity: 'critical', message: 'Critical', reportedBy: ['test'] },
        { severity: 'info', message: 'Info note', reportedBy: ['test'] },
      ],
    });
    render(<IssuesList checks={[check]} />);
    fireEvent.click(screen.getByText('info (1)'));
    expect(screen.getByText('Info note')).toBeInTheDocument();
    expect(screen.queryByText('Critical')).not.toBeInTheDocument();
  });

  it('shows all issues again after clicking "all"', () => {
    const check = makeCheck({
      issues: [
        { severity: 'critical', message: 'Critical', reportedBy: ['test'] },
        { severity: 'warning', message: 'Warning', reportedBy: ['test'] },
      ],
    });
    render(<IssuesList checks={[check]} />);
    fireEvent.click(screen.getByText('critical (1)'));
    fireEvent.click(screen.getByText('all (2)'));
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('renders the check name alongside each issue', () => {
    const check = makeCheck({
      name: 'Security Audit',
      issues: [{ severity: 'critical', message: 'CVE found', reportedBy: ['test'] }],
    });
    render(<IssuesList checks={[check]} />);
    expect(screen.getByText('Security Audit')).toBeInTheDocument();
  });

  it('displays the file path when an issue has one', () => {
    const check = makeCheck({
      issues: [{ severity: 'warning', message: 'Lint error', file: 'src/foo.ts', reportedBy: ['test'] }],
    });
    render(<IssuesList checks={[check]} />);
    expect(screen.getByText('src/foo.ts')).toBeInTheDocument();
  });

  it('shows the fix command as a button', () => {
    const check = makeCheck({
      issues: [{
        severity: 'warning',
        message: 'Remove dep',
        reportedBy: ['knip'],
        fix: { description: 'Uninstall it', command: 'npm uninstall lodash' },
      }],
    });
    render(<IssuesList checks={[check]} />);
    expect(screen.getByText('npm uninstall lodash')).toBeInTheDocument();
  });

  it('copies the fix command to clipboard when the button is clicked', () => {
    const check = makeCheck({
      issues: [{
        severity: 'warning',
        message: 'Remove dep',
        reportedBy: ['knip'],
        fix: { description: 'Uninstall it', command: 'npm uninstall lodash' },
      }],
    });
    render(<IssuesList checks={[check]} />);
    fireEvent.click(screen.getByText('npm uninstall lodash'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('npm uninstall lodash');
  });

  it('aggregates issues from multiple checks', () => {
    const checks = [
      makeCheck({ id: 'a', name: 'Check A', issues: [{ severity: 'critical', message: 'From A', reportedBy: ['a'] }] }),
      makeCheck({ id: 'b', name: 'Check B', issues: [{ severity: 'warning', message: 'From B', reportedBy: ['b'] }] }),
    ];
    render(<IssuesList checks={checks} />);
    expect(screen.getByText('all (2)')).toBeInTheDocument();
    expect(screen.getByText('From A')).toBeInTheDocument();
    expect(screen.getByText('From B')).toBeInTheDocument();
  });
});
