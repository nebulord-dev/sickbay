import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';

import { HotkeyBar } from './HotkeyBar.js';

import type { PanelId } from './HotkeyBar.js';

// Note: ink-testing-library strips the closing ] bracket from [key] sequences
// when they appear inside a Box with margins. We test for "[key" patterns instead.

describe('HotkeyBar', () => {
  it('renders all 9 hotkey keys', () => {
    const { lastFrame } = render(<HotkeyBar activePanel={null} />);
    const output = lastFrame() ?? '';
    expect(output).toContain('[h');
    expect(output).toContain('[g');
    expect(output).toContain('[t');
    expect(output).toContain('[q');
    expect(output).toContain('[a');
    expect(output).toContain('[r');
    expect(output).toContain('[w');
    expect(output).toContain('[W');
    expect(output).toContain('[?');
  });

  it('renders all hotkey labels', () => {
    const { lastFrame } = render(<HotkeyBar activePanel={null} />);
    const output = lastFrame() ?? '';
    expect(output).toContain('health');
    expect(output).toContain('git');
    expect(output).toContain('trend');
    expect(output).toContain('quick wins');
    expect(output).toContain('activity');
    expect(output).toContain('re-run');
    expect(output).toContain('web');
    expect(output).toContain('web+AI');
    expect(output).toContain('help');
  });

  it('renders with no active panel without error', () => {
    const { lastFrame } = render(<HotkeyBar activePanel={null} />);
    expect(lastFrame()).toBeTruthy();
  });

  it('shows health key and label when activePanel is health', () => {
    const { lastFrame } = render(<HotkeyBar activePanel="health" />);
    const output = lastFrame() ?? '';
    expect(output).toContain('[h');
    expect(output).toContain('health');
  });

  it('shows git key and label when activePanel is git', () => {
    const { lastFrame } = render(<HotkeyBar activePanel="git" />);
    const output = lastFrame() ?? '';
    expect(output).toContain('[g');
    expect(output).toContain('git');
  });

  it('shows trend key and label when activePanel is trend', () => {
    const { lastFrame } = render(<HotkeyBar activePanel="trend" />);
    const output = lastFrame() ?? '';
    expect(output).toContain('[t');
    expect(output).toContain('trend');
  });

  it('shows quickwins key and label when activePanel is quickwins', () => {
    const { lastFrame } = render(<HotkeyBar activePanel="quickwins" />);
    const output = lastFrame() ?? '';
    expect(output).toContain('[q');
    expect(output).toContain('quick wins');
  });

  it('shows activity key and label when activePanel is activity', () => {
    const { lastFrame } = render(<HotkeyBar activePanel="activity" />);
    const output = lastFrame() ?? '';
    expect(output).toContain('[a');
    expect(output).toContain('activity');
  });

  it('non-panel hotkeys (r, w, W, ?) always appear regardless of activePanel', () => {
    const panels: Array<PanelId | null> = ['health', 'git', 'trend', 'quickwins', 'activity', null];
    for (const panel of panels) {
      const { lastFrame } = render(<HotkeyBar activePanel={panel} />);
      const output = lastFrame() ?? '';
      expect(output).toContain('[r');
      expect(output).toContain('[w');
      expect(output).toContain('[W');
      expect(output).toContain('[?');
    }
  });
});
