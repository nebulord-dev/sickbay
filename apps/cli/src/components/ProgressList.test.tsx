import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ProgressList } from './ProgressList.js';

describe('ProgressList', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all item names', () => {
    const items = [
      { name: 'knip', status: 'done' as const },
      { name: 'eslint', status: 'pending' as const },
    ];
    const { lastFrame } = render(<ProgressList items={items} />);
    const output = lastFrame() ?? '';
    expect(output).toContain('knip');
    expect(output).toContain('eslint');
  });

  it('shows ✓ for done items', () => {
    const { lastFrame } = render(<ProgressList items={[{ name: 'check', status: 'done' }]} />);
    expect(lastFrame()).toContain('✓');
  });

  it('shows ○ for pending items', () => {
    const { lastFrame } = render(<ProgressList items={[{ name: 'check', status: 'pending' }]} />);
    expect(lastFrame()).toContain('○');
  });

  it('renders without errors when items list is empty', () => {
    const { lastFrame } = render(<ProgressList items={[]} />);
    expect(lastFrame()).toBeDefined();
  });

  it('renders items in the order provided', () => {
    const items = [
      { name: 'first', status: 'done' as const },
      { name: 'second', status: 'running' as const },
      { name: 'third', status: 'pending' as const },
    ];
    const { lastFrame } = render(<ProgressList items={items} />);
    const output = lastFrame() ?? '';

    expect(output.indexOf('first')).toBeLessThan(output.indexOf('second'));
    expect(output.indexOf('second')).toBeLessThan(output.indexOf('third'));
  });

  it('shows a spinner character for running items', () => {
    const SPINNER_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
    const { lastFrame } = render(<ProgressList items={[{ name: 'check', status: 'running' }]} />);
    const output = lastFrame() ?? '';
    const hasSpinner = SPINNER_FRAMES.some((frame) => output.includes(frame));
    expect(hasSpinner).toBe(true);
  });

  it('does not show ✓ or ○ for running items', () => {
    const { lastFrame } = render(<ProgressList items={[{ name: 'check', status: 'running' }]} />);
    const output = lastFrame() ?? '';
    expect(output).not.toContain('✓');
    expect(output).not.toContain('○');
  });
});
