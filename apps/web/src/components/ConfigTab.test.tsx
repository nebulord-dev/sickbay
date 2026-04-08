import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ConfigTab } from './ConfigTab.js';

import type { SickbayReport } from 'sickbay-core';

function makeReport(configOverrides?: Partial<SickbayReport['config']>): SickbayReport {
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
    checks: [],
    config: configOverrides
      ? {
          hasCustomConfig: true,
          overriddenChecks: [],
          disabledChecks: [],
          ...configOverrides,
        }
      : undefined,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ConfigTab', () => {
  it('shows empty state when report.config is undefined', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }));

    render(<ConfigTab report={makeReport()} />);
    expect(screen.getByText(/No custom configuration/)).toBeInTheDocument();
  });

  it('shows "Custom configuration active" banner when config is present', async () => {
    const rawConfig = { checks: { knip: false } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(rawConfig), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<ConfigTab report={makeReport({ disabledChecks: ['knip'], overriddenChecks: [] })} />);

    await waitFor(() => {
      expect(screen.getByText('Custom configuration active')).toBeInTheDocument();
    });
  });

  it('shows disabled check count', async () => {
    const rawConfig = { checks: { knip: false, depcheck: false } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(rawConfig), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(
      <ConfigTab
        report={makeReport({ disabledChecks: ['knip', 'depcheck'], overriddenChecks: [] })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('2 disabled')).toBeInTheDocument();
    });
  });

  it('shows overridden check count', async () => {
    const rawConfig = {
      checks: {
        complexity: { thresholds: { general: { warn: 500, critical: 800 } } },
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(rawConfig), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(
      <ConfigTab report={makeReport({ disabledChecks: [], overriddenChecks: ['complexity'] })} />,
    );

    await waitFor(() => {
      expect(screen.getByText('1 overridden')).toBeInTheDocument();
    });
  });

  it('renders disabled badge for disabled checks', async () => {
    const rawConfig = { checks: { knip: false } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(rawConfig), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<ConfigTab report={makeReport({ disabledChecks: ['knip'] })} />);

    await waitFor(() => {
      expect(screen.getByText('disabled')).toBeInTheDocument();
      expect(screen.getByText('knip')).toBeInTheDocument();
    });
  });

  it('renders threshold and suppress badges', async () => {
    const rawConfig = {
      checks: {
        complexity: { thresholds: { general: { warn: 500, critical: 800 } } },
        secrets: { suppress: [{ match: 'NEXT_PUBLIC', reason: 'public env var' }] },
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(rawConfig), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<ConfigTab report={makeReport({ overriddenChecks: ['complexity', 'secrets'] })} />);

    await waitFor(() => {
      expect(screen.getByText('thresholds')).toBeInTheDocument();
      expect(screen.getByText('1 suppressed')).toBeInTheDocument();
    });
  });

  it('renders weight overrides with default comparison', async () => {
    const rawConfig = { weights: { security: 0.5 } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(rawConfig), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<ConfigTab report={makeReport({ hasCustomConfig: true })} />);

    await waitFor(() => {
      expect(screen.getByText('security')).toBeInTheDocument();
      expect(screen.getByText('0.3')).toBeInTheDocument(); // default
      expect(screen.getByText('0.5')).toBeInTheDocument(); // custom
    });
  });

  it('renders global exclude patterns', async () => {
    const rawConfig = { exclude: ['**/generated/**', '**/vendor/**'] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(rawConfig), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<ConfigTab report={makeReport({ hasCustomConfig: true })} />);

    await waitFor(() => {
      expect(screen.getByText('**/generated/**')).toBeInTheDocument();
      expect(screen.getByText('**/vendor/**')).toBeInTheDocument();
    });
  });

  it('handles 404 from config endpoint gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }));

    render(<ConfigTab report={makeReport({ disabledChecks: ['knip'] })} />);

    // Should show the banner from report metadata even without raw config
    await waitFor(() => {
      expect(screen.getByText('Custom configuration active')).toBeInTheDocument();
    });
  });

  it('handles fetch failure gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    render(<ConfigTab report={makeReport({ disabledChecks: ['knip'] })} />);

    await waitFor(() => {
      expect(screen.getByText('Custom configuration active')).toBeInTheDocument();
    });
  });
});
