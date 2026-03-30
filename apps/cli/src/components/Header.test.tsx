import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';

import { Header } from './Header.js';

describe('Header', () => {
  it('renders the ASCII art banner', () => {
    const { lastFrame } = render(<Header />);
    // The banner uses box-drawing characters
    expect(lastFrame()).toContain('██');
  });

  it('renders a version number', () => {
    const { lastFrame } = render(<Header />);
    // __VERSION__ is defined as "0.0.0-test" in vitest.config.ts
    expect(lastFrame()).toContain('v0.0.0-test');
  });

  it('renders project name when provided', () => {
    const { lastFrame } = render(<Header projectName="my-app" />);
    expect(lastFrame()).toContain('my-app');
  });

  it('shows "Analyzing" label alongside the project name', () => {
    const { lastFrame } = render(<Header projectName="test-project" />);
    const output = lastFrame() ?? '';
    expect(output).toContain('Analyzing');
    expect(output).toContain('test-project');
  });

  it('does not show "Analyzing" when no project name is provided', () => {
    const { lastFrame } = render(<Header />);
    expect(lastFrame()).not.toContain('Analyzing');
  });
});
