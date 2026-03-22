import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatDrawer } from './ChatDrawer.js';
import type { SickbayReport } from '@sickbay/core';

const mockReport: SickbayReport = {
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
  checks: [],
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ChatDrawer', () => {
  it('renders nothing when AI is unavailable', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    const { container } = render(<ChatDrawer report={mockReport} />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('shows the floating button when AI is available', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    render(<ChatDrawer report={mockReport} />);
    await waitFor(() => {
      expect(screen.getByTitle('AI Assistant')).toBeInTheDocument();
    });
  });

  it('opens the drawer when the floating button is clicked', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    render(<ChatDrawer report={mockReport} />);
    await waitFor(() => screen.getByTitle('AI Assistant'));
    fireEvent.click(screen.getByTitle('AI Assistant'));
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask about your project...')).toBeInTheDocument();
  });

  it('shows empty state prompt in a new conversation', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    render(<ChatDrawer report={mockReport} />);
    await waitFor(() => screen.getByTitle('AI Assistant'));
    fireEvent.click(screen.getByTitle('AI Assistant'));
    expect(screen.getByText(/Ask me anything about your project health/)).toBeInTheDocument();
  });

  it('closes the drawer when the ✕ button is clicked', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    render(<ChatDrawer report={mockReport} />);
    await waitFor(() => screen.getByTitle('AI Assistant'));
    fireEvent.click(screen.getByTitle('AI Assistant'));
    fireEvent.click(screen.getByText('✕'));
    expect(screen.queryByPlaceholderText('Ask about your project...')).not.toBeInTheDocument();
  });

  it('disables Send button when the input is empty', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    render(<ChatDrawer report={mockReport} />);
    await waitFor(() => screen.getByTitle('AI Assistant'));
    fireEvent.click(screen.getByTitle('AI Assistant'));
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('enables Send button when input has text', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    render(<ChatDrawer report={mockReport} />);
    await waitFor(() => screen.getByTitle('AI Assistant'));
    fireEvent.click(screen.getByTitle('AI Assistant'));
    fireEvent.change(screen.getByPlaceholderText('Ask about your project...'), {
      target: { value: 'What should I fix?' },
    });
    expect(screen.getByRole('button', { name: 'Send' })).not.toBeDisabled();
  });

  it('sends a message and shows the response', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true } as Response) // availability check
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ response: 'Fix your dependencies first.' }),
      } as Response); // chat response

    render(<ChatDrawer report={mockReport} />);
    await waitFor(() => screen.getByTitle('AI Assistant'));
    fireEvent.click(screen.getByTitle('AI Assistant'));
    fireEvent.change(screen.getByPlaceholderText('Ask about your project...'), {
      target: { value: 'What to fix?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText('What to fix?')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('Fix your dependencies first.')).toBeInTheDocument();
    });
  });

  it('shows an error message when the chat request fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockRejectedValueOnce(new Error('Network error'));

    render(<ChatDrawer report={mockReport} />);
    await waitFor(() => screen.getByTitle('AI Assistant'));
    fireEvent.click(screen.getByTitle('AI Assistant'));
    fireEvent.change(screen.getByPlaceholderText('Ask about your project...'), {
      target: { value: 'Question' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText(/Sorry, I encountered an error/)).toBeInTheDocument();
    });
  });
});
