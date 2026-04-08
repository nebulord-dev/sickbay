import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { AISummary } from './AISummary.js';

import type { SickbayReport } from 'sickbay-core';

const mockReport: SickbayReport = {
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
  summary: { critical: 0, warnings: 1, info: 2 },
  checks: [],
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AISummary', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <AISummary report={mockReport} isOpen={false} onToggle={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows loading state initially when open', () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {})); // never resolves
    render(<AISummary report={mockReport} isOpen={true} onToggle={vi.fn()} />);
    expect(screen.getByText(/Generating insights/)).toBeInTheDocument();
  });

  it('shows no-API-key message when fetch fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('No API key'));
    render(<AISummary report={mockReport} isOpen={true} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/AI insights are not available/)).toBeInTheDocument();
    });
  });

  it('shows no-API-key message when fetch returns non-ok', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    render(<AISummary report={mockReport} isOpen={true} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/AI insights are not available/)).toBeInTheDocument();
    });
  });

  it('renders sections from a successful summary response', async () => {
    const summary =
      '**Health Assessment**\nYour project is in good shape.\n**Next Steps**\nFix vulnerabilities.';
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ summary }),
    } as Response);

    render(<AISummary report={mockReport} isOpen={true} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Health Assessment')).toBeInTheDocument();
      expect(screen.getByText('Next Steps')).toBeInTheDocument();
    });
  });

  it('uses cached summary from localStorage without fetching', async () => {
    const cacheKey = `sickbay-ai-summary-${mockReport.timestamp}`;
    const cached = '**Health Assessment**\nCached response.';
    localStorage.setItem(cacheKey, cached);

    render(<AISummary report={mockReport} isOpen={true} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Health Assessment')).toBeInTheDocument();
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('calls onToggle(false) when the close button is clicked', async () => {
    const onToggle = vi.fn();
    vi.mocked(fetch).mockRejectedValue(new Error('No key'));
    render(<AISummary report={mockReport} isOpen={true} onToggle={onToggle} />);
    await waitFor(() => screen.getByText(/AI insights are not available/));
    fireEvent.click(screen.getByText('✕'));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('shows the regenerate button when a summary is loaded', async () => {
    const summary = '**Health Assessment**\nAll good.';
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ summary }),
    } as Response);

    render(<AISummary report={mockReport} isOpen={true} onToggle={vi.fn()} />);
    await waitFor(() => expect(screen.getByTitle('Regenerate insights')).toBeInTheDocument());
  });
});
