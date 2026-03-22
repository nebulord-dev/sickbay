import { describe, it, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { DependencyList } from './DependencyList.js';
import type { SickbayReport } from '@sickbay/core';

function makeReport(overrides: Partial<SickbayReport> = {}): SickbayReport {
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
        issues: [{ severity: 'info', message: 'lodash: 4.0.0 → 4.17.21 (patch)', reportedBy: ['ncu'] }],
      }],
    });
    render(<DependencyList report={report} />);
    expect(screen.getByText('→ 4.17.21')).toBeInTheDocument();
  });

  it('shows "patch update" badge for a patch bump', () => {
    const report = makeReport({
      checks: [{
        id: 'outdated', name: 'Outdated', category: 'dependencies', score: 70,
        status: 'warning', toolsUsed: ['ncu'], duration: 0,
        issues: [{ severity: 'info', message: 'lodash: 4.0.0 → 4.0.1 (patch)', reportedBy: ['ncu'] }],
      }],
    });
    render(<DependencyList report={report} />);
    expect(screen.getByText('patch update')).toBeInTheDocument();
  });

  it('shows "minor update" badge for a minor bump', () => {
    const report = makeReport({
      checks: [{
        id: 'outdated', name: 'Outdated', category: 'dependencies', score: 70,
        status: 'warning', toolsUsed: ['ncu'], duration: 0,
        issues: [{ severity: 'info', message: 'lodash: 4.0.0 → 4.1.0 (minor)', reportedBy: ['ncu'] }],
      }],
    });
    render(<DependencyList report={report} />);
    expect(screen.getByText('minor update')).toBeInTheDocument();
  });

  it('shows "major update" badge for a major version bump', () => {
    const report = makeReport({
      checks: [{
        id: 'outdated', name: 'Outdated', category: 'dependencies', score: 50,
        status: 'warning', toolsUsed: ['ncu'], duration: 0,
        issues: [{ severity: 'warning', message: 'react: 17.0.0 → 18.0.0 (major)', reportedBy: ['ncu'] }],
      }],
    });
    render(<DependencyList report={report} />);
    expect(screen.getByText('major update')).toBeInTheDocument();
  });

  it('falls back to severity-based detection for legacy messages without type suffix', () => {
    const report = makeReport({
      checks: [{
        id: 'outdated', name: 'Outdated', category: 'dependencies', score: 50,
        status: 'warning', toolsUsed: ['ncu'], duration: 0,
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

  describe('UpdateTotalsBanner', () => {
    it('shows "All dependencies up to date" when no outdated deps', () => {
      render(<DependencyList report={makeReport()} />);
      expect(screen.getByText('All dependencies up to date')).toBeInTheDocument();
    });

    it('shows correct major/minor/patch counts', () => {
      const report = makeReport({
        checks: [{
          id: 'outdated', name: 'Outdated', category: 'dependencies', score: 50,
          status: 'warning', toolsUsed: ['ncu'], duration: 0,
          issues: [
            { severity: 'warning', message: 'react: 17.0.0 → 18.0.0 (major)', reportedBy: ['ncu'] },
            { severity: 'info', message: 'lodash: 4.0.0 → 4.1.0 (minor)', reportedBy: ['ncu'] },
            { severity: 'info', message: 'typescript: 5.0.0 → 5.0.1 (patch)', reportedBy: ['ncu'] },
          ],
        }],
      });
      render(<DependencyList report={report} />);
      expect(screen.getByText('1 major')).toBeInTheDocument();
      expect(screen.getByText('1 minor')).toBeInTheDocument();
      expect(screen.getByText('1 patch')).toBeInTheDocument();
    });

    it('omits zero-count pills', () => {
      const report = makeReport({
        checks: [{
          id: 'outdated', name: 'Outdated', category: 'dependencies', score: 70,
          status: 'warning', toolsUsed: ['ncu'], duration: 0,
          issues: [
            { severity: 'info', message: 'lodash: 4.0.0 → 4.0.1 (patch)', reportedBy: ['ncu'] },
          ],
        }],
      });
      render(<DependencyList report={report} />);
      expect(screen.queryByText(/major/)).not.toBeInTheDocument();
      expect(screen.queryByText(/minor/)).not.toBeInTheDocument();
      expect(screen.getByText('1 patch')).toBeInTheDocument();
    });
  });

  describe('OverridesSection', () => {
    it('renders overrides when present in projectInfo', () => {
      const report = makeReport({
        projectInfo: {
          ...makeReport().projectInfo,
          overrides: { minimatch: '>=10.0.0', rollup: '>=4.0.0' },
        },
      });
      render(<DependencyList report={report} />);
      expect(screen.getByText('Package Overrides')).toBeInTheDocument();
      expect(screen.getByText('minimatch')).toBeInTheDocument();
      expect(screen.getByText('>=10.0.0')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // count badge
    });

    it('does not render overrides section when no overrides', () => {
      render(<DependencyList report={makeReport()} />);
      expect(screen.queryByText('Package Overrides')).not.toBeInTheDocument();
    });

    it('collapses overrides when more than 3 and shows toggle', () => {
      const report = makeReport({
        projectInfo: {
          ...makeReport().projectInfo,
          overrides: { a: '1', b: '2', c: '3', d: '4', e: '5' },
        },
      });
      render(<DependencyList report={report} />);
      expect(screen.getByText(/Show all 5 overrides/)).toBeInTheDocument();
      // Only first 3 visible initially
      expect(screen.getByText('a')).toBeInTheDocument();
      expect(screen.getByText('b')).toBeInTheDocument();
      expect(screen.getByText('c')).toBeInTheDocument();
      expect(screen.queryByText('d')).not.toBeInTheDocument();

      // Expand
      fireEvent.click(screen.getByText(/Show all 5 overrides/));
      expect(screen.getByText('d')).toBeInTheDocument();
      expect(screen.getByText('e')).toBeInTheDocument();
      expect(screen.getByText('Show fewer')).toBeInTheDocument();
    });
  });
});
