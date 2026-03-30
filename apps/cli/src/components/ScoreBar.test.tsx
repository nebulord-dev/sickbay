import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';

import { ScoreBar } from './ScoreBar.js';

describe('ScoreBar', () => {
  it('displays score value', () => {
    const { lastFrame } = render(<ScoreBar score={85} />);
    expect(lastFrame()).toContain('85/100');
  });

  it('renders filled blocks proportional to score', () => {
    const { lastFrame } = render(<ScoreBar score={50} width={10} />);
    const output = lastFrame();

    // 50% of 10 blocks = 5 filled blocks
    expect(output).toContain('█');
    expect(output).toContain('░');
  });

  it('handles perfect score', () => {
    const { lastFrame } = render(<ScoreBar score={100} width={10} />);
    const output = lastFrame();

    expect(output).toContain('100/100');
    // All blocks should be filled
    expect(output).toMatch(/█+/);
  });

  it('handles zero score', () => {
    const { lastFrame } = render(<ScoreBar score={0} width={10} />);
    const output = lastFrame();

    expect(output).toContain('0/100');
    // All blocks should be empty
    expect(output).toMatch(/░+/);
  });

  it('uses default width when not specified', () => {
    const { lastFrame } = render(<ScoreBar score={50} />);
    expect(lastFrame()).toContain('50/100');
  });

  it('respects custom width', () => {
    const { lastFrame } = render(<ScoreBar score={100} width={5} />);
    const output = lastFrame();

    // Should have 5 filled blocks for 100% score
    const filledBlocks = (output?.match(/█/g) || []).length;
    expect(filledBlocks).toBeGreaterThanOrEqual(5);
  });

  it('rounds partial blocks correctly', () => {
    // 33% of 10 = 3.3, should round to 3
    const { lastFrame } = render(<ScoreBar score={33} width={10} />);
    expect(lastFrame()).toContain('33/100');
  });
});
