import { EventEmitter } from 'events';

import React from 'react';

import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chokidar (the hook imports it dynamically)
vi.mock('chokidar', () => ({
  watch: vi.fn(),
}));

import * as chokidar from 'chokidar';

import { useFileWatcher } from './useFileWatcher.js';

const mockWatch = vi.mocked(chokidar.watch);

type FakeWatcher = EventEmitter & { close: ReturnType<typeof vi.fn> };

function makeFakeWatcher(): FakeWatcher {
  const emitter = new EventEmitter() as FakeWatcher;
  emitter.close = vi.fn();
  return emitter;
}

/**
 * A wrapper Ink component that renders the list of changed files as text.
 */
function WatcherDisplay({
  projectPath,
  enabled,
  onFilesChanged,
  debounceMs,
}: {
  projectPath: string;
  enabled: boolean;
  onFilesChanged?: (files: string[]) => void;
  debounceMs?: number;
}) {
  const changedFiles = useFileWatcher({ projectPath, enabled, onFilesChanged, debounceMs });
  return React.createElement(Text, null, `files:${changedFiles.join(',')}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFileWatcher', () => {
  it('renders with an empty list initially', () => {
    const fakeWatcher = makeFakeWatcher();
    mockWatch.mockReturnValue(fakeWatcher as any);

    const { lastFrame } = render(
      React.createElement(WatcherDisplay, { projectPath: '/project', enabled: true }),
    );

    expect(lastFrame()).toBe('files:');
  });

  it('does not call watch when enabled is false', async () => {
    render(React.createElement(WatcherDisplay, { projectPath: '/project', enabled: false }));

    await vi.runAllTimersAsync();

    expect(mockWatch).not.toHaveBeenCalled();
  });

  it('calls watch when enabled is true', async () => {
    const fakeWatcher = makeFakeWatcher();
    mockWatch.mockReturnValue(fakeWatcher as any);

    render(React.createElement(WatcherDisplay, { projectPath: '/project', enabled: true }));

    await vi.runAllTimersAsync();

    expect(mockWatch).toHaveBeenCalledOnce();
  });

  it('watches using the projectPath as cwd option', async () => {
    const fakeWatcher = makeFakeWatcher();
    mockWatch.mockReturnValue(fakeWatcher as any);

    render(React.createElement(WatcherDisplay, { projectPath: '/my/custom/path', enabled: true }));

    await vi.runAllTimersAsync();

    const options = mockWatch.mock.calls[0][1] as any;
    expect(options.cwd).toBe('/my/custom/path');
  });

  it('appends changed file paths to the rendered list', async () => {
    const fakeWatcher = makeFakeWatcher();
    mockWatch.mockReturnValue(fakeWatcher as any);

    const { lastFrame } = render(
      React.createElement(WatcherDisplay, { projectPath: '/project', enabled: true }),
    );

    await vi.runAllTimersAsync();

    fakeWatcher.emit('change', 'src/index.ts');

    // Give React a tick to update
    await vi.runAllTimersAsync();

    expect(lastFrame()).toContain('src/index.ts');
  });

  it('accumulates multiple changed file paths', async () => {
    const fakeWatcher = makeFakeWatcher();
    mockWatch.mockReturnValue(fakeWatcher as any);

    const { lastFrame } = render(
      React.createElement(WatcherDisplay, { projectPath: '/project', enabled: true }),
    );

    await vi.runAllTimersAsync();

    fakeWatcher.emit('change', 'src/a.ts');
    fakeWatcher.emit('change', 'src/b.ts');

    await vi.runAllTimersAsync();

    expect(lastFrame()).toContain('src/a.ts');
    expect(lastFrame()).toContain('src/b.ts');
  });

  it('calls onFilesChanged after the debounce period', async () => {
    const fakeWatcher = makeFakeWatcher();
    mockWatch.mockReturnValue(fakeWatcher as any);
    const onFilesChanged = vi.fn();

    render(
      React.createElement(WatcherDisplay, {
        projectPath: '/project',
        enabled: true,
        debounceMs: 500,
        onFilesChanged,
      }),
    );

    // runAllTimersAsync flushes microtasks (including the dynamic import ticks)
    // and advances any pending timers, ensuring the change handler is registered.
    await vi.runAllTimersAsync();

    fakeWatcher.emit('change', 'src/index.ts');

    // Callback should not be called immediately
    expect(onFilesChanged).not.toHaveBeenCalled();

    // Advance past the debounce period
    await vi.advanceTimersByTimeAsync(600);

    expect(onFilesChanged).toHaveBeenCalledOnce();
    expect(onFilesChanged).toHaveBeenCalledWith(['src/index.ts']);
  });

  it('debounces multiple rapid changes into a single callback call', async () => {
    const fakeWatcher = makeFakeWatcher();
    mockWatch.mockReturnValue(fakeWatcher as any);
    const onFilesChanged = vi.fn();

    render(
      React.createElement(WatcherDisplay, {
        projectPath: '/project',
        enabled: true,
        debounceMs: 500,
        onFilesChanged,
      }),
    );

    await vi.runAllTimersAsync();

    fakeWatcher.emit('change', 'src/a.ts');
    fakeWatcher.emit('change', 'src/b.ts');
    fakeWatcher.emit('change', 'src/c.ts');

    await vi.advanceTimersByTimeAsync(600);

    expect(onFilesChanged).toHaveBeenCalledOnce();
    const files = onFilesChanged.mock.calls[0][0] as string[];
    expect(files).toContain('src/a.ts');
    expect(files).toContain('src/b.ts');
    expect(files).toContain('src/c.ts');
  });

  it('closes the watcher on unmount', async () => {
    const fakeWatcher = makeFakeWatcher();
    mockWatch.mockReturnValue(fakeWatcher as any);

    const { unmount } = render(
      React.createElement(WatcherDisplay, { projectPath: '/project', enabled: true }),
    );

    await vi.runAllTimersAsync();

    unmount();

    expect(fakeWatcher.close).toHaveBeenCalledOnce();
  });

  it('does not throw when chokidar watch throws', () => {
    mockWatch.mockImplementation(() => {
      throw new Error('module not found');
    });

    // Should not propagate any error
    expect(() =>
      render(React.createElement(WatcherDisplay, { projectPath: '/project', enabled: true })),
    ).not.toThrow();
  });
});
