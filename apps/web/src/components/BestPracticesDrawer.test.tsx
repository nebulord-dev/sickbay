import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { BestPracticesDrawer } from './BestPracticesDrawer.js';

import type { Recommendation } from '@nebulord/sickbay-core';

const mockRecommendations: Recommendation[] = [
  {
    id: 'react-error-boundary',
    framework: 'react',
    title: 'Add Error Boundaries',
    message: 'No error boundaries detected.',
    severity: 'recommend',
    learnMoreUrl: 'https://react.dev/reference/react/Component',
  },
  {
    id: 'react-suspense',
    framework: 'react',
    title: 'Use Suspense',
    message: 'No Suspense boundaries found.',
    severity: 'suggest',
  },
  {
    id: 'next-strict-mode',
    framework: 'next',
    title: 'Enable Strict Mode',
    message: 'reactStrictMode not enabled.',
    severity: 'recommend',
  },
];

describe('BestPracticesDrawer', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <BestPracticesDrawer
        recommendations={mockRecommendations}
        isOpen={false}
        onToggle={() => {}}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders drawer when open', () => {
    render(
      <BestPracticesDrawer
        recommendations={mockRecommendations}
        isOpen={true}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByText('Advisor')).toBeInTheDocument();
  });

  it('groups recommendations by framework', () => {
    render(
      <BestPracticesDrawer
        recommendations={mockRecommendations}
        isOpen={true}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('next')).toBeInTheDocument();
  });

  it('displays recommendation titles and messages', () => {
    render(
      <BestPracticesDrawer
        recommendations={mockRecommendations}
        isOpen={true}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByText('Add Error Boundaries')).toBeInTheDocument();
    expect(screen.getByText('No error boundaries detected.')).toBeInTheDocument();
  });

  it('renders learn more links when URL is present', () => {
    render(
      <BestPracticesDrawer
        recommendations={mockRecommendations}
        isOpen={true}
        onToggle={() => {}}
      />,
    );
    const learnMoreLinks = screen.getAllByText('Learn more →');
    expect(learnMoreLinks.length).toBeGreaterThan(0);
    expect(learnMoreLinks[0].closest('a')).toHaveAttribute(
      'href',
      'https://react.dev/reference/react/Component',
    );
  });

  it('does not render learn more link when URL is absent', () => {
    render(
      <BestPracticesDrawer
        recommendations={[mockRecommendations[1]]}
        isOpen={true}
        onToggle={() => {}}
      />,
    );
    expect(screen.queryByText('Learn more →')).not.toBeInTheDocument();
  });

  it('calls onToggle(false) when close button is clicked', () => {
    const onToggle = vi.fn();
    render(
      <BestPracticesDrawer
        recommendations={mockRecommendations}
        isOpen={true}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByText('✕'));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('shows recommendation count', () => {
    render(
      <BestPracticesDrawer
        recommendations={mockRecommendations}
        isOpen={true}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByText('3 recommendations')).toBeInTheDocument();
  });
});
