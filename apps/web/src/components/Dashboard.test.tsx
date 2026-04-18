import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { Dashboard } from './Dashboard.js';

import type { SickbayReport } from 'sickbay-core';

// Mock side-effectful components
vi.mock('./AISummary.js', () => ({ AISummary: () => null }));
vi.mock('./ChatDrawer.js', () => ({ ChatDrawer: () => null }));

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollTo = vi.fn();
});

function makeReport(overrides: Partial<SickbayReport> = {}): SickbayReport {
  return {
    timestamp: new Date().toISOString(),
    projectPath: '/test/project',
    projectInfo: {
      name: 'my-app',
      version: '2.1.0',
      framework: 'react',
      packageManager: 'pnpm',
      totalDependencies: 42,
      dependencies: {},
      devDependencies: {},
      hasESLint: true,
      hasPrettier: false,
      hasTypeScript: true,
    },
    overallScore: 78,
    summary: { critical: 1, warnings: 3, info: 5 },
    checks: [],
    ...overrides,
  };
}

describe('Dashboard', () => {
  it('renders the project name in the sidebar', () => {
    render(<Dashboard report={makeReport()} />);
    expect(screen.getByText('my-app')).toBeInTheDocument();
  });

  it('renders the project version', () => {
    render(<Dashboard report={makeReport()} />);
    expect(screen.getByText('v2.1.0')).toBeInTheDocument();
  });

  it('renders the overall score', () => {
    render(<Dashboard report={makeReport()} />);
    expect(screen.getByText('78')).toBeInTheDocument();
  });

  it('renders framework and package manager info', () => {
    render(<Dashboard report={makeReport()} />);
    expect(screen.getByText(/react · pnpm/)).toBeInTheDocument();
  });

  it('renders the total dependency count', () => {
    render(<Dashboard report={makeReport()} />);
    expect(screen.getByText('42 deps')).toBeInTheDocument();
  });

  it('renders summary issue counts in the sidebar', () => {
    const report = makeReport({
      checks: [
        {
          id: 'npm-audit',
          name: 'NPM Audit',
          category: 'security',
          score: 40,
          status: 'fail',
          toolsUsed: ['npm-audit'],
          duration: 100,
          issues: [
            { severity: 'critical', message: 'Critical vuln in lodash', reportedBy: ['npm-audit'] },
          ],
        },
        {
          id: 'knip',
          name: 'Unused Code',
          category: 'dependencies',
          score: 70,
          status: 'warning',
          toolsUsed: ['knip'],
          duration: 100,
          issues: [
            { severity: 'warning', message: 'Unused dep: lodash', reportedBy: ['knip'] },
            { severity: 'warning', message: 'Unused dep: moment', reportedBy: ['knip'] },
            { severity: 'warning', message: 'Unused dep: dayjs', reportedBy: ['knip'] },
          ],
        },
        {
          id: 'eslint',
          name: 'ESLint',
          category: 'code-quality',
          score: 85,
          status: 'pass',
          toolsUsed: ['eslint'],
          duration: 100,
          issues: [
            { severity: 'info', message: 'Consider using const', reportedBy: ['eslint'] },
            { severity: 'info', message: 'Prefer arrow functions', reportedBy: ['eslint'] },
            { severity: 'info', message: 'Use optional chaining', reportedBy: ['eslint'] },
            { severity: 'info', message: 'Avoid var keyword', reportedBy: ['eslint'] },
            { severity: 'info', message: 'Use template literals', reportedBy: ['eslint'] },
          ],
        },
      ],
      summary: { critical: 1, warnings: 3, info: 5 },
    });
    render(<Dashboard report={report} />);
    expect(screen.getByText(/1 critical/)).toBeInTheDocument();
    expect(screen.getByText(/3 warnings/)).toBeInTheDocument();
    expect(screen.getByText(/5 info/)).toBeInTheDocument();
  });

  it('lists each check in the sidebar nav', () => {
    const report = makeReport({
      checks: [
        {
          id: 'eslint',
          name: 'ESLint',
          category: 'code-quality',
          score: 95,
          status: 'pass',
          toolsUsed: [],
          duration: 0,
          issues: [],
        },
        {
          id: 'knip',
          name: 'Unused Code',
          category: 'dependencies',
          score: 70,
          status: 'warning',
          toolsUsed: [],
          duration: 0,
          issues: [],
        },
      ],
    });
    render(<Dashboard report={report} />);
    expect(screen.getByText('ESLint')).toBeInTheDocument();
    expect(screen.getByText('Unused Code')).toBeInTheDocument();
  });

  it('navigates to the issues view when the "issues" tab is clicked', () => {
    const report = makeReport({
      checks: [
        {
          id: 'eslint',
          name: 'ESLint',
          category: 'code-quality',
          score: 70,
          status: 'warning',
          toolsUsed: [],
          duration: 0,
          issues: [{ severity: 'warning', message: 'Lint error', reportedBy: ['eslint'] }],
        },
      ],
    });
    render(<Dashboard report={report} />);
    fireEvent.click(screen.getByRole('button', { name: 'issues' }));
    expect(screen.getByText('Lint error')).toBeInTheDocument();
  });

  it('navigates to the dependencies view when "dependencies" is clicked', () => {
    render(
      <Dashboard
        report={makeReport({
          projectInfo: {
            name: 'my-app',
            version: '1.0.0',
            framework: 'react',
            packageManager: 'npm',
            totalDependencies: 1,
            dependencies: { react: '^18' },
            devDependencies: {},
            hasESLint: false,
            hasPrettier: false,
            hasTypeScript: false,
          },
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'dependencies' }));
    expect(screen.getByText('Dependencies')).toBeInTheDocument();
  });

  it('navigates back to overview when "overview" is clicked', () => {
    const report = makeReport({
      checks: [
        {
          id: 'eslint',
          name: 'ESLint',
          category: 'code-quality',
          score: 70,
          status: 'warning',
          toolsUsed: [],
          duration: 0,
          issues: [{ severity: 'warning', message: 'Lint error', reportedBy: ['eslint'] }],
        },
      ],
    });
    render(<Dashboard report={report} />);
    fireEvent.click(screen.getByRole('button', { name: 'issues' }));
    fireEvent.click(screen.getByRole('button', { name: 'overview' }));
    expect(screen.queryByText('Lint error')).not.toBeInTheDocument();
  });

  it('filters the issues view to the selected check when a sidebar check is clicked', () => {
    const report = makeReport({
      checks: [
        {
          id: 'eslint',
          name: 'ESLint',
          category: 'code-quality',
          score: 70,
          status: 'warning',
          toolsUsed: [],
          duration: 0,
          issues: [{ severity: 'warning', message: 'ESLint warning', reportedBy: ['eslint'] }],
        },
        {
          id: 'knip',
          name: 'Unused Code',
          category: 'dependencies',
          score: 95,
          status: 'pass',
          toolsUsed: [],
          duration: 0,
          issues: [{ severity: 'info', message: 'Knip info', reportedBy: ['knip'] }],
        },
      ],
    });
    render(<Dashboard report={report} />);
    // Click ESLint in sidebar → switches to issues view, filtered to ESLint
    fireEvent.click(screen.getAllByText('ESLint')[0]);
    expect(screen.getByText('ESLint warning')).toBeInTheDocument();
    expect(screen.queryByText('Knip info')).not.toBeInTheDocument();
  });

  it('renders quote when present on report', () => {
    const report = makeReport({
      quote: { text: "He's dead, Jim.", source: 'Dr. McCoy', severity: 'critical' },
    });
    render(<Dashboard report={report} />);
    expect(screen.getByText(/He's dead, Jim\./)).toBeInTheDocument();
    expect(screen.getByText(/Dr\. McCoy/)).toBeInTheDocument();
  });

  it('does not render quote when absent', () => {
    const report = makeReport();
    render(<Dashboard report={report} />);
    expect(screen.queryByText(/Dr\. McCoy/)).not.toBeInTheDocument();
  });

  it('shows unique warning count with raw total in parentheses when duplicates exist', () => {
    const report = makeReport({
      checks: [
        {
          id: 'react-perf',
          name: 'React Performance',
          category: 'performance',
          score: 60,
          status: 'warning',
          toolsUsed: ['react-perf'],
          duration: 100,
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
        },
      ],
      summary: { critical: 0, warnings: 3, info: 0 },
    });
    render(<Dashboard report={report} />);
    expect(screen.getByText(/1 warning(?!s)/)).toBeInTheDocument();
    expect(screen.getByText(/3 total/)).toBeInTheDocument();
  });

  it('shows plain warning count without parenthetical when no duplicates', () => {
    const report = makeReport({
      checks: [
        {
          id: 'knip',
          name: 'Unused Code',
          category: 'dependencies',
          score: 70,
          status: 'warning',
          toolsUsed: ['knip'],
          duration: 100,
          issues: [
            { severity: 'warning', message: 'Unused dep: lodash', reportedBy: ['knip'] },
            { severity: 'warning', message: 'Unused dep: moment', reportedBy: ['knip'] },
          ],
        },
      ],
      summary: { critical: 0, warnings: 2, info: 0 },
    });
    render(<Dashboard report={report} />);
    expect(screen.getByText(/2 warnings/)).toBeInTheDocument();
    expect(screen.queryByText(/total/)).not.toBeInTheDocument();
  });
});
