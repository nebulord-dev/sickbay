import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CriticalIssues } from './CriticalIssues.js';
import type { SickbayReport } from '@sickbay/core';

function makeReport(checks: SickbayReport['checks'] = []): SickbayReport {
  return {
    timestamp: '2024-01-01T00:00:00.000Z',
    projectPath: '/test',
    projectInfo: {
      name: 'test-project', version: '1.0.0', framework: 'react',
      packageManager: 'npm', totalDependencies: 0,
      dependencies: {}, devDependencies: {},
      hasESLint: false, hasPrettier: false, hasTypeScript: false,
    },
    overallScore: 75,
    summary: { critical: 0, warnings: 0, info: 0 },
    checks,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('CriticalIssues', () => {
  it('renders nothing when there are no critical issues', () => {
    const report = makeReport([{
      id: 'test', name: 'Test', category: 'security', score: 80,
      status: 'pass', toolsUsed: [], duration: 0,
      issues: [{ severity: 'warning', message: 'Just a warning', reportedBy: ['test'] }],
    }]);
    const { container } = render(<CriticalIssues report={report} onCheckClick={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when checks array is empty', () => {
    const { container } = render(<CriticalIssues report={makeReport()} onCheckClick={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays the total critical issue count', () => {
    const report = makeReport([{
      id: 'sec', name: 'Security', category: 'security', score: 0,
      status: 'fail', toolsUsed: [], duration: 0,
      issues: [
        { severity: 'critical', message: 'CVE-1', reportedBy: ['npm-audit'] },
        { severity: 'critical', message: 'CVE-2', reportedBy: ['npm-audit'] },
      ],
    }]);
    render(<CriticalIssues report={report} onCheckClick={vi.fn()} />);
    expect(screen.getByText('(2 total)')).toBeInTheDocument();
  });

  it('starts collapsed by default (no stored preference)', () => {
    const report = makeReport([{
      id: 'sec', name: 'Security', category: 'security', score: 0,
      status: 'fail', toolsUsed: [], duration: 0,
      issues: [{ severity: 'critical', message: 'CVE found', reportedBy: ['test'] }],
    }]);
    render(<CriticalIssues report={report} onCheckClick={vi.fn()} />);
    expect(screen.queryByText('CVE found')).not.toBeInTheDocument();
  });

  it('expands when the header button is clicked', () => {
    const report = makeReport([{
      id: 'sec', name: 'Security', category: 'security', score: 0,
      status: 'fail', toolsUsed: [], duration: 0,
      issues: [{ severity: 'critical', message: 'CVE found', reportedBy: ['test'] }],
    }]);
    render(<CriticalIssues report={report} onCheckClick={vi.fn()} />);
    fireEvent.click(screen.getByText('Critical Issues'));
    expect(screen.getByText('CVE found')).toBeInTheDocument();
  });

  it('collapses again when toggled twice', () => {
    const report = makeReport([{
      id: 'sec', name: 'Security', category: 'security', score: 0,
      status: 'fail', toolsUsed: [], duration: 0,
      issues: [{ severity: 'critical', message: 'CVE found', reportedBy: ['test'] }],
    }]);
    render(<CriticalIssues report={report} onCheckClick={vi.fn()} />);
    fireEvent.click(screen.getByText('Critical Issues'));
    fireEvent.click(screen.getByText('Critical Issues'));
    expect(screen.queryByText('CVE found')).not.toBeInTheDocument();
  });

  it('starts expanded when localStorage has "false" stored', () => {
    localStorage.setItem('sickbay-critical-issues-collapsed', 'false');
    const report = makeReport([{
      id: 'sec', name: 'Security', category: 'security', score: 0,
      status: 'fail', toolsUsed: [], duration: 0,
      issues: [{ severity: 'critical', message: 'CVE found', reportedBy: ['test'] }],
    }]);
    render(<CriticalIssues report={report} onCheckClick={vi.fn()} />);
    expect(screen.getByText('CVE found')).toBeInTheDocument();
  });

  it('persists collapsed state to localStorage', () => {
    const report = makeReport([{
      id: 'sec', name: 'Security', category: 'security', score: 0,
      status: 'fail', toolsUsed: [], duration: 0,
      issues: [{ severity: 'critical', message: 'CVE found', reportedBy: ['test'] }],
    }]);
    render(<CriticalIssues report={report} onCheckClick={vi.fn()} />);
    fireEvent.click(screen.getByText('Critical Issues')); // expand
    expect(localStorage.getItem('sickbay-critical-issues-collapsed')).toBe('false');
  });

  it('truncates issues at 3 per check and shows overflow count', () => {
    const report = makeReport([{
      id: 'sec', name: 'Security', category: 'security', score: 0,
      status: 'fail', toolsUsed: [], duration: 0,
      issues: [
        { severity: 'critical', message: 'Issue 1', reportedBy: ['test'] },
        { severity: 'critical', message: 'Issue 2', reportedBy: ['test'] },
        { severity: 'critical', message: 'Issue 3', reportedBy: ['test'] },
        { severity: 'critical', message: 'Issue 4', reportedBy: ['test'] },
        { severity: 'critical', message: 'Issue 5', reportedBy: ['test'] },
      ],
    }]);
    localStorage.setItem('sickbay-critical-issues-collapsed', 'false');
    render(<CriticalIssues report={report} onCheckClick={vi.fn()} />);
    expect(screen.queryByText('Issue 4')).not.toBeInTheDocument();
    expect(screen.getByText(/\+2 more critical issues/)).toBeInTheDocument();
  });

  it('calls onCheckClick with the check id when the check name is clicked', () => {
    const onCheckClick = vi.fn();
    const report = makeReport([{
      id: 'my-check', name: 'My Check', category: 'security', score: 0,
      status: 'fail', toolsUsed: [], duration: 0,
      issues: [{ severity: 'critical', message: 'Issue', reportedBy: ['test'] }],
    }]);
    localStorage.setItem('sickbay-critical-issues-collapsed', 'false');
    render(<CriticalIssues report={report} onCheckClick={onCheckClick} />);
    fireEvent.click(screen.getByText('My Check'));
    expect(onCheckClick).toHaveBeenCalledWith('my-check');
  });
});
