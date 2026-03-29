import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { About } from './About.js';
import type { SickbayReport } from '@nebulord/sickbay-core';

function makeReport(checks: SickbayReport['checks'] = []): SickbayReport {
  return {
    timestamp: '2024-01-01T00:00:00.000Z',
    projectPath: '/test',
    projectInfo: {
      name: 'test-project', version: '1.0.0', framework: 'react',
      packageManager: 'npm', totalDependencies: 5,
      dependencies: {}, devDependencies: {},
      hasESLint: false, hasPrettier: false, hasTypeScript: true,
    },
    overallScore: 80,
    summary: { critical: 0, warnings: 0, info: 0 },
    checks,
  };
}

describe('About', () => {
  it('renders the SICKBAY heading', () => {
    render(<About report={makeReport()} />);
    expect(screen.getByText('SICKBAY')).toBeInTheDocument();
  });

  it('renders the "How Scoring Works" section', () => {
    render(<About report={makeReport()} />);
    expect(screen.getByText('How Scoring Works')).toBeInTheDocument();
  });

  it('renders all five category weights', () => {
    render(<About report={makeReport()} />);
    expect(screen.getAllByText(/security/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/dependencies/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/code quality/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/performance/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^git$/i).length).toBeGreaterThan(0);
  });

  it('renders checks grouped by category', () => {
    const report = makeReport([
      {
        id: 'npm-audit', name: 'Audit', category: 'security', score: 90,
        status: 'pass', toolsUsed: ['npm-audit'], duration: 0, issues: [],
      },
      {
        id: 'knip', name: 'Knip', category: 'dependencies', score: 85,
        status: 'pass', toolsUsed: ['knip'], duration: 0, issues: [],
      },
    ]);
    render(<About report={report} />);
    expect(screen.getByText('Audit')).toBeInTheDocument();
    expect(screen.getByText('Knip')).toBeInTheDocument();
  });

  it('renders status badges for each check', () => {
    const report = makeReport([
      {
        id: 'eslint', name: 'ESLint', category: 'code-quality', score: 70,
        status: 'warning', toolsUsed: ['eslint'], duration: 0, issues: [],
      },
    ]);
    render(<About report={report} />);
    expect(screen.getByText('warning')).toBeInTheDocument();
  });

  it('renders check scores', () => {
    const report = makeReport([
      {
        id: 'eslint', name: 'ESLint', category: 'code-quality', score: 72,
        status: 'warning', toolsUsed: ['eslint'], duration: 0, issues: [],
      },
    ]);
    render(<About report={report} />);
    expect(screen.getByText('72')).toBeInTheDocument();
  });

});
