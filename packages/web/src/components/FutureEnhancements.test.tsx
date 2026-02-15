import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FutureEnhancements } from './FutureEnhancements';

describe('FutureEnhancements', () => {
  it('renders page title', () => {
    render(<FutureEnhancements />);
    expect(screen.getByText('FUTURE ENHANCEMENTS')).toBeInTheDocument();
  });

  it('displays introduction text', () => {
    render(<FutureEnhancements />);
    expect(screen.getByText(/Vitals is actively evolving/i)).toBeInTheDocument();
  });

  it('shows planned enhancements', () => {
    render(<FutureEnhancements />);
    expect(screen.getByText('Historical Trends')).toBeInTheDocument();
    expect(screen.getByText('CI/CD Integration Guide')).toBeInTheDocument();
  });

  it('displays SMS Status Checks enhancement', () => {
    render(<FutureEnhancements />);
    expect(screen.getByText('SMS Status Checks')).toBeInTheDocument();
    expect(
      screen.getByText(/Text a number to get instant health stats/i)
    ).toBeInTheDocument();
  });

  it('shows GitHub CTA link', () => {
    render(<FutureEnhancements />);
    expect(screen.getByText('Open an Issue on GitHub')).toBeInTheDocument();
  });

  it('groups enhancements by status', () => {
    render(<FutureEnhancements />);

    // Should have sections for different statuses
    expect(screen.getByText('Planned')).toBeInTheDocument();
    expect(screen.getByText('Under Consideration')).toBeInTheDocument();
  });

  it('displays category badges', () => {
    render(<FutureEnhancements />);
    const { container } = render(<FutureEnhancements />);

    // Categories should be visible (feature, integration, etc.)
    expect(container.textContent).toContain('feature');
    expect(container.textContent).toContain('integration');
  });

  it('shows multiple enhancement cards', () => {
    render(<FutureEnhancements />);

    // Check for various enhancements
    expect(screen.getByText('Lighthouse Integration')).toBeInTheDocument();
    expect(screen.getByText('Team Dashboard')).toBeInTheDocument();
    expect(screen.getByText('AI Quick Fixes')).toBeInTheDocument();
  });
});
