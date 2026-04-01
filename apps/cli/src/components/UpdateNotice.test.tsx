import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';

import { UpdateNotice } from './UpdateNotice.js';

describe('UpdateNotice', () => {
  it('renders version delta and upgrade command', () => {
    const { lastFrame } = render(<UpdateNotice currentVersion="1.3.1" latestVersion="1.4.0" />);
    const output = lastFrame()!;
    expect(output).toContain('1.3.1');
    expect(output).toContain('1.4.0');
    expect(output).toContain('npx sickbay@latest');
    expect(output).toContain('npm i -g sickbay@latest');
  });

  it('renders box border characters', () => {
    const { lastFrame } = render(<UpdateNotice currentVersion="1.0.0" latestVersion="2.0.0" />);
    const output = lastFrame()!;
    expect(output).toContain('╭');
    expect(output).toContain('╰');
  });
});
