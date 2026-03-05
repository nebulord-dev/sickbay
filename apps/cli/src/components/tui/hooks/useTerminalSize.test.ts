import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useTerminalSize } from './useTerminalSize.js';

// Wrapper component that renders size info as text so we can inspect it
function SizeDisplay() {
  const { columns, rows } = useTerminalSize();
  return React.createElement(Text, null, `cols:${columns} rows:${rows}`);
}

describe('useTerminalSize', () => {
  const originalColumns = process.stdout.columns;
  const originalRows = process.stdout.rows;

  beforeEach(() => {
    Object.defineProperty(process.stdout, 'columns', {
      value: 120,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process.stdout, 'rows', {
      value: 40,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'columns', {
      value: originalColumns,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process.stdout, 'rows', {
      value: originalRows,
      writable: true,
      configurable: true,
    });
  });

  it('returns the current terminal columns and rows on mount', () => {
    const { lastFrame } = render(React.createElement(SizeDisplay));
    expect(lastFrame()).toContain('cols:120');
    expect(lastFrame()).toContain('rows:40');
  });

  it('falls back to 80 columns when process.stdout.columns is 0', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: 0,
      writable: true,
      configurable: true,
    });

    const { lastFrame } = render(React.createElement(SizeDisplay));
    expect(lastFrame()).toContain('cols:80');
  });

  it('falls back to 24 rows when process.stdout.rows is 0', () => {
    Object.defineProperty(process.stdout, 'rows', {
      value: 0,
      writable: true,
      configurable: true,
    });

    const { lastFrame } = render(React.createElement(SizeDisplay));
    expect(lastFrame()).toContain('rows:24');
  });

  it('falls back to 80 columns when process.stdout.columns is undefined', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { lastFrame } = render(React.createElement(SizeDisplay));
    expect(lastFrame()).toContain('cols:80');
  });

  it('falls back to 24 rows when process.stdout.rows is undefined', () => {
    Object.defineProperty(process.stdout, 'rows', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { lastFrame } = render(React.createElement(SizeDisplay));
    expect(lastFrame()).toContain('rows:24');
  });

  it('removes the resize listener on unmount without throwing', () => {
    const removeSpy = vi.spyOn(process.stdout, 'off');
    const { unmount } = render(React.createElement(SizeDisplay));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeSpy.mockRestore();
  });
});
