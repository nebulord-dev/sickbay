import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { IssuesList } from './IssuesList.js';

import type { CheckResult } from 'sickbay-core';

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
      issues: [
        { severity: 'warning', message: 'Lint error', file: 'src/foo.ts', reportedBy: ['test'] },
      ],
    });
    render(<IssuesList checks={[check]} />);
    expect(screen.getByText('src/foo.ts')).toBeInTheDocument();
  });

  it('shows the fix command as a button', () => {
    const check = makeCheck({
      issues: [
        {
          severity: 'warning',
          message: 'Remove dep',
          reportedBy: ['knip'],
          fix: { description: 'Uninstall it', command: 'npm uninstall lodash' },
        },
      ],
    });
    render(<IssuesList checks={[check]} />);
    expect(screen.getByText('npm uninstall lodash')).toBeInTheDocument();
  });

  it('copies the fix command to clipboard when the button is clicked', () => {
    const check = makeCheck({
      issues: [
        {
          severity: 'warning',
          message: 'Remove dep',
          reportedBy: ['knip'],
          fix: { description: 'Uninstall it', command: 'npm uninstall lodash' },
        },
      ],
    });
    render(<IssuesList checks={[check]} />);
    fireEvent.click(screen.getByText('npm uninstall lodash'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('npm uninstall lodash');
  });

  it('aggregates issues from multiple checks', () => {
    const checks = [
      makeCheck({
        id: 'a',
        name: 'Check A',
        issues: [{ severity: 'critical', message: 'From A', reportedBy: ['a'] }],
      }),
      makeCheck({
        id: 'b',
        name: 'Check B',
        issues: [{ severity: 'warning', message: 'From B', reportedBy: ['b'] }],
      }),
    ];
    render(<IssuesList checks={checks} />);
    expect(screen.getByText('all (2)')).toBeInTheDocument();
    expect(screen.getByText('From A')).toBeInTheDocument();
    expect(screen.getByText('From B')).toBeInTheDocument();
  });

  it('shows suppress button for every issue', () => {
    const check = makeCheck({
      issues: [
        {
          severity: 'warning',
          message: 'Unused dependency: lodash',
          reportedBy: ['knip'],
          suppressMatch: 'lodash',
        },
      ],
    });
    render(<IssuesList checks={[check]} />);
    expect(screen.getByText(/suppress/i)).toBeInTheDocument();
  });

  it('copies suppress snippet to clipboard when suppress button is clicked', () => {
    const check = makeCheck({
      id: 'knip',
      issues: [
        {
          severity: 'warning',
          message: 'Unused dependency: lodash',
          reportedBy: ['knip'],
          suppressMatch: 'lodash',
        },
      ],
    });
    render(<IssuesList checks={[check]} />);
    fireEvent.click(screen.getByText(/suppress/i));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("match: 'lodash'"),
    );
  });

  it('includes commented-out path in suppress snippet when issue has a file', () => {
    const check = makeCheck({
      id: 'secrets',
      issues: [
        {
          severity: 'critical',
          message: 'AWS Access Key detected',
          file: 'src/config.ts',
          reportedBy: ['secrets'],
          suppressMatch: 'AWS Access Key',
        },
      ],
    });
    render(<IssuesList checks={[check]} />);
    fireEvent.click(screen.getByText(/suppress/i));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("/* path: 'src/config.ts', */"),
    );
  });

  it('falls back to message when suppressMatch is not set', () => {
    const check = makeCheck({
      id: 'git',
      issues: [{ severity: 'info', message: 'Last commit was 45 days ago', reportedBy: ['git'] }],
    });
    render(<IssuesList checks={[check]} />);
    fireEvent.click(screen.getByText(/suppress/i));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("match: 'Last commit was 45 days ago'"),
    );
  });

  it('uses checkId from parent CheckResult for config path', () => {
    const check = makeCheck({
      id: 'npm-audit',
      issues: [
        {
          severity: 'critical',
          message: '[lodash] Prototype Pollution',
          reportedBy: ['npm-audit'],
          suppressMatch: 'lodash',
        },
      ],
    });
    render(<IssuesList checks={[check]} />);
    fireEvent.click(screen.getByText(/suppress/i));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('checks.npm-audit.suppress'),
    );
  });

  it('shows suppress info popover when info icon is clicked', () => {
    const check = makeCheck({
      issues: [{ severity: 'warning', message: 'Test', reportedBy: ['test'] }],
    });
    render(<IssuesList checks={[check]} />);
    fireEvent.click(screen.getByTitle('About suppress rules'));
    expect(screen.getByText(/copy a suppression rule/)).toBeInTheDocument();
  });

  it('hides suppress info popover when info icon is clicked again', () => {
    const check = makeCheck({
      issues: [{ severity: 'warning', message: 'Test', reportedBy: ['test'] }],
    });
    render(<IssuesList checks={[check]} />);
    const icon = screen.getByTitle('About suppress rules');
    fireEvent.click(icon);
    expect(screen.getByText(/copy a suppression rule/)).toBeInTheDocument();
    fireEvent.click(icon);
    expect(screen.queryByText(/copy a suppression rule/)).not.toBeInTheDocument();
  });

  it('groups duplicate issues under a collapsible header', () => {
    const check = makeCheck({
      id: 'react-perf',
      name: 'React Performance',
      issues: [
        {
          severity: 'warning',
          message: 'src/A.tsx:1 \u2014 Inline object \u2014 new ref',
          reportedBy: ['react-perf'],
        },
        {
          severity: 'warning',
          message: 'src/B.tsx:5 \u2014 Inline object \u2014 new ref',
          reportedBy: ['react-perf'],
        },
        {
          severity: 'warning',
          message: 'src/C.tsx:10 \u2014 Inline object \u2014 new ref',
          reportedBy: ['react-perf'],
        },
      ],
    });
    render(<IssuesList checks={[check]} />);
    // Should show the group header with the pattern stem and count
    expect(screen.getByText(/Inline object/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    // Individual messages should NOT be visible (collapsed by default)
    expect(screen.queryByText(/src\/A\.tsx/)).not.toBeInTheDocument();
  });

  it('expands a group to show individual issues when clicked', () => {
    const check = makeCheck({
      id: 'react-perf',
      name: 'React Performance',
      issues: [
        {
          severity: 'warning',
          message: 'src/A.tsx:1 \u2014 Inline object \u2014 new ref',
          reportedBy: ['react-perf'],
        },
        {
          severity: 'warning',
          message: 'src/B.tsx:5 \u2014 Inline object \u2014 new ref',
          reportedBy: ['react-perf'],
        },
      ],
    });
    render(<IssuesList checks={[check]} />);
    fireEvent.click(screen.getByText(/Inline object/));
    expect(screen.getByText(/src\/A\.tsx:1/)).toBeInTheDocument();
    expect(screen.getByText(/src\/B\.tsx:5/)).toBeInTheDocument();
  });

  it('renders single-issue groups as plain rows without expand affordance', () => {
    const check = makeCheck({
      id: 'knip',
      name: 'Unused Code',
      issues: [{ severity: 'warning', message: 'Unused dep: lodash', reportedBy: ['knip'] }],
    });
    render(<IssuesList checks={[check]} />);
    expect(screen.getByText('Unused dep: lodash')).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('shows unique group counts in filter buttons, not raw issue counts', () => {
    const check = makeCheck({
      id: 'react-perf',
      name: 'React Performance',
      issues: [
        {
          severity: 'warning',
          message: 'src/A.tsx:1 \u2014 Inline object \u2014 new ref',
          reportedBy: ['react-perf'],
        },
        {
          severity: 'warning',
          message: 'src/B.tsx:5 \u2014 Inline object \u2014 new ref',
          reportedBy: ['react-perf'],
        },
        { severity: 'critical', message: 'Critical thing', reportedBy: ['react-perf'] },
      ],
    });
    render(<IssuesList checks={[check]} />);
    expect(screen.getByText('all (2)')).toBeInTheDocument();
    expect(screen.getByText('warning (1)')).toBeInTheDocument();
    expect(screen.getByText('critical (1)')).toBeInTheDocument();
  });
});
