import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DependencyList } from './DependencyList.js';
import type { VitalsReport } from '@vitals/core';

function makeReport(overrides: Partial<VitalsReport> = {}): VitalsReport {
  return {
    timestamp: '2024-01-01T00:00:00.000Z',
    projectPath: '/test',
    projectInfo: {
      name: 'test-project', version: '1.0.0', framework: 'react',
      packageManager: 'npm', totalDependencies: 3,
      dependencies: { react: '^18.0.0', lodash: '^4.0.0' },
      devDependencies: { typescript: '^5.0.0' },
      hasESLint: false, hasPrettier: false, hasTypeScript: true,
    },
    overallScore: 80,
    summary: { critical: 0, warnings: 0, info: 0 },
    checks: [],
    ...overrides,
  };
}

describe('DependencyList', () => {
  it('renders all dependencies', () => {
    render(<DependencyList report={makeReport()} />);
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('lodash')).toBeInTheDocument();
    expect(screen.getByText('typescript')).toBeInTheDocument();
  });

  it('shows the total dependency count', () => {
    render(<DependencyList report={makeReport()} />);
    expect(screen.getByText('3 total')).toBeInTheDocument();
  });

  it('labels prod and dev dependencies correctly', () => {
    render(<DependencyList report={makeReport()} />);
    const devBadges = screen.getAllByText('dev');
    const prodBadges = screen.getAllByText('prod');
    expect(devBadges).toHaveLength(1); // typescript
    expect(prodBadges).toHaveLength(2); // react + lodash
  });

  it('shows "unused" badge for an unused dependency', () => {
    const report = makeReport({
      checks: [{
        id: 'knip', name: 'Knip', category: 'dependencies', score: 80,
        status: 'warning', toolsUsed: ['knip'], duration: 0,
        issues: [{ severity: 'warning', message: 'Unused dependency: lodash', reportedBy: ['knip'] }],
      }],
    });
    render(<DependencyList report={report} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('unused')).toBeInTheDocument();
  });

  it('shows "missing" badge for a missing dependency', () => {
    const report = makeReport({
      checks: [{
        id: 'depcheck', name: 'Depcheck', category: 'dependencies', score: 60,
        status: 'warning', toolsUsed: ['depcheck'], duration: 0,
        issues: [{ severity: 'critical', message: 'Missing dependency: react', reportedBy: ['depcheck'] }],
      }],
    });
    render(<DependencyList report={report} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('missing')).toBeInTheDocument();
  });

  it('shows outdated arrow when a dependency has an update', () => {
    const report = makeReport({
      checks: [{
        id: 'outdated', name: 'Outdated', category: 'dependencies', score: 70,
        status: 'warning', toolsUsed: ['ncu'], duration: 0,
        issues: [{ severity: 'warning', message: 'lodash: 4.0.0 → 4.17.21', reportedBy: ['ncu'] }],
      }],
    });
    render(<DependencyList report={report} />);
    expect(screen.getByText('→ 4.17.21')).toBeInTheDocument();
  });

  it('shows "outdated" badge for a minor/patch update', () => {
    const report = makeReport({
      checks: [{
        id: 'outdated', name: 'Outdated', category: 'dependencies', score: 70,
        status: 'warning', toolsUsed: ['ncu'], duration: 0,
        issues: [{ severity: 'warning', message: 'lodash: 4.0.0 → 4.17.21', reportedBy: ['ncu'] }],
      }],
    });
    render(<DependencyList report={report} />);
    expect(screen.getByText('outdated')).toBeInTheDocument();
  });

  it('shows "major update" badge for a major version bump', () => {
    const report = makeReport({
      checks: [{
        id: 'outdated', name: 'Outdated', category: 'dependencies', score: 50,
        status: 'warning', toolsUsed: ['ncu'], duration: 0,
        // severity warning maps to majorBump: true
        issues: [{ severity: 'warning', message: 'react: 17.0.0 → 18.0.0', reportedBy: ['ncu'] }],
      }],
    });
    render(<DependencyList report={report} />);
    expect(screen.getByText('major update')).toBeInTheDocument();
  });

  it('shows "✓" for healthy dependencies with no issues', () => {
    render(<DependencyList report={makeReport()} />);
    const checks = screen.getAllByText('✓');
    expect(checks.length).toBeGreaterThan(0);
  });

  it('shows the "with issues" count when issues exist', () => {
    const report = makeReport({
      checks: [{
        id: 'knip', name: 'Knip', category: 'dependencies', score: 80,
        status: 'warning', toolsUsed: ['knip'], duration: 0,
        issues: [{ severity: 'warning', message: 'Unused dependency: lodash', reportedBy: ['knip'] }],
      }],
    });
    render(<DependencyList report={report} />);
    expect(screen.getByText(/1 with issues/)).toBeInTheDocument();
  });

  it('does not show "with issues" when there are none', () => {
    render(<DependencyList report={makeReport()} />);
    expect(screen.queryByText(/with issues/)).not.toBeInTheDocument();
  });

  it('sorts dependencies with issues before healthy ones', () => {
    const report = makeReport({
      checks: [{
        id: 'depcheck', name: 'Depcheck', category: 'dependencies', score: 60,
        status: 'warning', toolsUsed: ['depcheck'], duration: 0,
        issues: [{ severity: 'warning', message: 'Unused dependency: react', reportedBy: ['depcheck'] }],
      }],
    });
    const { container } = render(<DependencyList report={report} />);
    const rows = container.querySelectorAll('tbody tr');
    // react (has issue) should come before lodash (clean)
    expect(rows[0].textContent).toContain('react');
  });
});
