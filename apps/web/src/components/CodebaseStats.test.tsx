import React from 'react';

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { CodebaseStats } from './CodebaseStats.js';

import type { SickbayReport, CheckResult } from 'sickbay-core';

// Mock DependencyGraph to avoid ReactFlow in tests
vi.mock('./DependencyGraph.js', () => ({
  DependencyGraph: () => <div data-testid="dependency-graph" />,
}));

function makeReport(checks: CheckResult[] = []): SickbayReport {
  return {
    timestamp: '2024-01-01T00:00:00.000Z',
    projectPath: '/test',
    projectInfo: {
      name: 'test-project',
      version: '1.0.0',
      framework: 'react',
      packageManager: 'npm',
      totalDependencies: 5,
      dependencies: {},
      devDependencies: {},
      hasESLint: false,
      hasPrettier: false,
      hasTypeScript: true,
    },
    overallScore: 80,
    summary: { critical: 0, warnings: 0, info: 0 },
    checks,
  };
}

function makeCheck(id: string, metadata: Record<string, unknown>): CheckResult {
  return {
    id,
    name: id,
    category: 'code-quality',
    score: 80,
    status: 'pass',
    toolsUsed: [id],
    duration: 0,
    issues: [],
    metadata,
  };
}

describe('CodebaseStats', () => {
  it('shows "No codebase stats available" when there is no metadata', () => {
    render(<CodebaseStats report={makeReport()} />);
    expect(screen.getByText(/No codebase stats available/)).toBeInTheDocument();
  });

  it('renders the complexity section when complexity metadata is present', () => {
    const report = makeReport([
      makeCheck('complexity', {
        totalFiles: 42,
        totalLines: 5000,
        avgLines: 119,
        oversizedCount: 3,
        topFiles: [],
      }),
    ]);
    render(<CodebaseStats report={report} />);
    expect(screen.getByText('Codebase')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument(); // total files
    expect(screen.getByText('119 loc')).toBeInTheDocument(); // avg file size
    expect(screen.getByText('3')).toBeInTheDocument(); // oversized
  });

  it('formats large line counts with commas', () => {
    const report = makeReport([
      makeCheck('complexity', {
        totalFiles: 10,
        totalLines: 12345,
        avgLines: 100,
        oversizedCount: 0,
        topFiles: [],
      }),
    ]);
    render(<CodebaseStats report={report} />);
    expect(screen.getByText('12,345')).toBeInTheDocument();
  });

  it('renders top files bar chart when topFiles are present', () => {
    const report = makeReport([
      makeCheck('complexity', {
        totalFiles: 3,
        totalLines: 600,
        avgLines: 200,
        oversizedCount: 1,
        topFiles: [
          { path: 'src/components/Big.tsx', lines: 600 },
          { path: 'src/utils/helpers.ts', lines: 200 },
        ],
      }),
    ]);
    render(<CodebaseStats report={report} />);
    expect(screen.getByText('largest files')).toBeInTheDocument();
    expect(screen.getByText('components/Big.tsx')).toBeInTheDocument();
  });

  it('colors bars using per-file thresholds from metadata', () => {
    const report = makeReport([
      makeCheck('complexity', {
        totalFiles: 2,
        totalLines: 550,
        avgLines: 275,
        oversizedCount: 1,
        topFiles: [
          {
            path: 'src/hooks/useAuth.ts',
            lines: 200,
            fileType: 'custom-hook',
            warn: 150,
            critical: 250,
          },
          {
            path: 'src/utils/helpers.ts',
            lines: 350,
            fileType: 'ts-utility',
            warn: 600,
            critical: 1000,
          },
        ],
      }),
    ]);
    const { container } = render(<CodebaseStats report={report} />);
    const bars = container.querySelectorAll('.rounded-full.flex');
    // useAuth.ts (200 lines) — above hook warn (150) but below critical (250) → yellow
    expect(bars[0].className).toContain('bg-yellow-400');
    // helpers.ts (350 lines) — below utility warn (600) → green
    expect(bars[1].className).toContain('bg-green-400');
  });

  it('renders the git section when git metadata is present', () => {
    const report = makeReport([
      makeCheck('git', {
        commitCount: 250,
        contributorCount: 4,
        remoteBranches: 8,
        lastCommit: '2d ago',
      }),
    ]);
    render(<CodebaseStats report={report} />);
    expect(screen.getByText('Git Activity')).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2d ago')).toBeInTheDocument();
  });

  it('renders the coverage section when coverage metadata is present', () => {
    const report = makeReport([
      makeCheck('coverage', {
        lines: 82.5,
        statements: 80.0,
        functions: 75.0,
        branches: 70.0,
      }),
    ]);
    render(<CodebaseStats report={report} />);
    expect(screen.getByText('Test Coverage')).toBeInTheDocument();
    expect(screen.getByText('82.5%')).toBeInTheDocument();
  });

  it('renders test pass/fail counts when available', () => {
    const report = makeReport([
      makeCheck('coverage', {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 90,
        totalTests: 150,
        passed: 148,
        failed: 2,
      }),
    ]);
    render(<CodebaseStats report={report} />);
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('148')).toBeInTheDocument();
  });

  it('renders multiple sections together', () => {
    const report = makeReport([
      makeCheck('complexity', {
        totalFiles: 10,
        totalLines: 1000,
        avgLines: 100,
        oversizedCount: 0,
        topFiles: [],
      }),
      makeCheck('git', {
        commitCount: 50,
        contributorCount: 2,
        remoteBranches: 3,
        lastCommit: '1d ago',
      }),
    ]);
    render(<CodebaseStats report={report} />);
    expect(screen.getByText('Codebase')).toBeInTheDocument();
    expect(screen.getByText('Git Activity')).toBeInTheDocument();
  });

  it('collapses a section when its header is clicked', () => {
    const report = makeReport([
      makeCheck('complexity', {
        totalFiles: 42,
        totalLines: 5000,
        avgLines: 119,
        oversizedCount: 3,
        topFiles: [],
      }),
    ]);
    render(<CodebaseStats report={report} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Codebase'));
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });

  it('re-expands a section when its header is clicked again', () => {
    const report = makeReport([
      makeCheck('complexity', {
        totalFiles: 42,
        totalLines: 5000,
        avgLines: 119,
        oversizedCount: 3,
        topFiles: [],
      }),
    ]);
    render(<CodebaseStats report={report} />);
    fireEvent.click(screen.getByText('Codebase'));
    expect(screen.queryByText('42')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Codebase'));
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('collapses sections independently', () => {
    const report = makeReport([
      makeCheck('complexity', {
        totalFiles: 10,
        totalLines: 1000,
        avgLines: 100,
        oversizedCount: 0,
        topFiles: [],
      }),
      makeCheck('git', {
        commitCount: 50,
        contributorCount: 2,
        remoteBranches: 3,
        lastCommit: '1d ago',
      }),
    ]);
    render(<CodebaseStats report={report} />);
    fireEvent.click(screen.getByText('Git Activity'));
    // Codebase content still visible
    expect(screen.getByText('10')).toBeInTheDocument();
    // Git content hidden
    expect(screen.queryByText('50')).not.toBeInTheDocument();
  });
});
