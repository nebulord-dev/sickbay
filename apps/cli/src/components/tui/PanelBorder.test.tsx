import React from 'react';

import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';

import { PanelBorder } from './PanelBorder.js';

describe('PanelBorder', () => {
  it('renders the title', () => {
    const { lastFrame } = render(
      <PanelBorder title="Health" color="green">
        <Text>content</Text>
      </PanelBorder>,
    );
    expect(lastFrame()).toContain('Health');
  });

  it('renders children content', () => {
    const { lastFrame } = render(
      <PanelBorder title="Score" color="cyan">
        <Text>child content here</Text>
      </PanelBorder>,
    );
    expect(lastFrame()).toContain('child content here');
  });

  it('renders without error when focused is false', () => {
    const { lastFrame } = render(
      <PanelBorder title="Activity" color="magenta" focused={false}>
        <Text>body</Text>
      </PanelBorder>,
    );
    expect(lastFrame()).toContain('Activity');
    expect(lastFrame()).toContain('body');
  });

  it('renders without error when focused is true', () => {
    const { lastFrame } = render(
      <PanelBorder title="Quick Wins" color="yellow" focused={true}>
        <Text>highlighted</Text>
      </PanelBorder>,
    );
    expect(lastFrame()).toContain('Quick Wins');
    expect(lastFrame()).toContain('highlighted');
  });

  it('renders without error when focused is undefined', () => {
    const { lastFrame } = render(
      <PanelBorder title="Git" color="blue">
        <Text>git content</Text>
      </PanelBorder>,
    );
    expect(lastFrame()).toContain('Git');
    expect(lastFrame()).toContain('git content');
  });

  it('renders different titles correctly', () => {
    const titles = ['Health', 'Score', 'Quick Wins', 'Activity', 'Git Trend'];
    for (const title of titles) {
      const { lastFrame } = render(
        <PanelBorder title={title} color="white">
          <Text>body</Text>
        </PanelBorder>,
      );
      expect(lastFrame()).toContain(title);
    }
  });

  it('renders multiple children', () => {
    const { lastFrame } = render(
      <PanelBorder title="Panel" color="green">
        <Text>line one</Text>
        <Text>line two</Text>
      </PanelBorder>,
    );
    const output = lastFrame() ?? '';
    expect(output).toContain('line one');
    expect(output).toContain('line two');
  });

  it('uses a border (single or double) in the output', () => {
    const { lastFrame } = render(
      <PanelBorder title="Test" color="green">
        <Text>content</Text>
      </PanelBorder>,
    );
    const output = lastFrame() ?? '';
    // Ink renders borders using box-drawing characters; at minimum a corner char should appear
    // Single border top-left: ┌, double border top-left: ╔
    const hasBorderChars =
      output.includes('┌') || output.includes('╔') || output.includes('─') || output.includes('═');
    expect(hasBorderChars).toBe(true);
  });

  it('focused border uses double style (╔/═)', () => {
    const { lastFrame } = render(
      <PanelBorder title="Focused" color="green" focused={true}>
        <Text>inside</Text>
      </PanelBorder>,
    );
    const output = lastFrame() ?? '';
    // Double border has ╔ or ═ characters
    const hasDoubleBorder = output.includes('╔') || output.includes('═');
    expect(hasDoubleBorder).toBe(true);
  });

  it('unfocused border uses single style (┌/─)', () => {
    const { lastFrame } = render(
      <PanelBorder title="Unfocused" color="green" focused={false}>
        <Text>inside</Text>
      </PanelBorder>,
    );
    const output = lastFrame() ?? '';
    // Single border has ┌ or ─ characters
    const hasSingleBorder = output.includes('┌') || output.includes('─');
    expect(hasSingleBorder).toBe(true);
  });

  it('renders placeholder when visible is false', () => {
    const { lastFrame } = render(
      <PanelBorder title="Score" color="blue" visible={false}>
        <Text>real content</Text>
      </PanelBorder>,
    );
    const output = lastFrame() ?? '';
    expect(output).toContain('···');
    expect(output).not.toContain('real content');
  });

  it('renders children when visible is true', () => {
    const { lastFrame } = render(
      <PanelBorder title="Score" color="blue" visible={true}>
        <Text>real content</Text>
      </PanelBorder>,
    );
    expect(lastFrame()).toContain('real content');
  });

  it('renders children when visible is omitted (defaults to true)', () => {
    const { lastFrame } = render(
      <PanelBorder title="Score" color="blue">
        <Text>real content</Text>
      </PanelBorder>,
    );
    expect(lastFrame()).toContain('real content');
  });
});
