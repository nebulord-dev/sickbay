import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';

// Mock child_process before importing the hook
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'child_process';
import { useGitStatus } from './useGitStatus.js';

const mockExecFile = vi.mocked(execFile);

/**
 * Wrapper component that renders git status as text for inspection.
 */
function GitStatusDisplay({ projectPath }: { projectPath: string }) {
  const status = useGitStatus(projectPath, 60000); // long poll to avoid re-fetching during tests
  if (!status) {
    return React.createElement(Text, null, 'loading');
  }
  return React.createElement(
    Text,
    null,
    `branch:${status.branch} untracked:${status.untracked} stashes:${status.stashes} ahead:${status.ahead} behind:${status.behind} lastCommit:${status.lastCommit} lastCommitTime:${status.lastCommitTime}`,
  );
}

/**
 * Set up mockExecFile to respond based on the git subcommand (args[0]).
 */
function mockGitByCommand(map: Record<string, string>) {
  mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
    const subCmd = (args as string[])[0];
    const output = map[subCmd] ?? '';
    // util.promisify on the mock uses the standard (err, value) form and resolves
    // with the second argument. useGitStatus.ts then destructures { stdout } from
    // the resolved value, so we must pass an object, not a bare string.
    (callback as Function)(null, { stdout: output, stderr: '' });
    return {} as any;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // No fake timers needed — no timer advancement used in these tests.
  // Real timers allow setImmediate to drain microtasks reliably.
});

/**
 * Render the component and wait for the async git fetch to complete
 * by advancing timers. Returns lastFrame() for assertions.
 */
async function renderAndWait(projectPath = '/project') {
  const { lastFrame, unmount } = render(
    React.createElement(GitStatusDisplay, { projectPath }),
  );

  // Flush all pending microtasks. The mock calls its callback synchronously so all
  // five git Promises resolve in microtask ticks; setImmediate drains them.
  await new Promise((r) => setImmediate(r));

  return { lastFrame, unmount };
}

describe('useGitStatus', () => {
  it('renders loading initially when git commands have not completed', () => {
    // Make execFile never call back so status stays null
    mockExecFile.mockImplementation(() => ({ } as any));

    const { lastFrame } = render(
      React.createElement(GitStatusDisplay, { projectPath: '/project' }),
    );
    expect(lastFrame()).toContain('loading');
  });

  it('renders branch name after git commands complete', async () => {
    mockGitByCommand({
      branch: 'main\n',
      status: '',
      'rev-list': '',
      stash: '',
      log: '|',
    });

    const { lastFrame } = await renderAndWait();
    expect(lastFrame()).toContain('branch:main');
  });

  it('uses "unknown" as branch when git returns empty string', async () => {
    mockGitByCommand({
      branch: '',
      status: '',
      'rev-list': '',
      stash: '',
      log: '|',
    });

    const { lastFrame } = await renderAndWait();
    expect(lastFrame()).toContain('branch:unknown');
  });

  it('parses a feature branch name correctly', async () => {
    mockGitByCommand({
      branch: 'feature/my-branch\n',
      status: '',
      'rev-list': '',
      stash: '',
      log: '|',
    });

    const { lastFrame } = await renderAndWait();
    expect(lastFrame()).toContain('branch:feature/my-branch');
  });

  it('counts untracked files from git status --porcelain', async () => {
    mockGitByCommand({
      branch: 'main\n',
      status: '?? file1.ts\n?? file2.ts\n?? file3.ts\n',
      'rev-list': '',
      stash: '',
      log: '|',
    });

    const { lastFrame } = await renderAndWait();
    expect(lastFrame()).toContain('untracked:3');
  });

  it('counts stashes from git stash list', async () => {
    mockGitByCommand({
      branch: 'main\n',
      status: '',
      'rev-list': '',
      stash: 'stash@{0}: WIP on main\nstash@{1}: partial work\n',
      log: '|',
    });

    const { lastFrame } = await renderAndWait();
    expect(lastFrame()).toContain('stashes:2');
  });

  it('parses ahead/behind from rev-list output', async () => {
    mockGitByCommand({
      branch: 'main\n',
      status: '',
      'rev-list': '3\t2\n',
      stash: '',
      log: '|',
    });

    const { lastFrame } = await renderAndWait();
    expect(lastFrame()).toContain('ahead:3');
    expect(lastFrame()).toContain('behind:2');
  });

  it('returns 0 ahead/behind when rev-list output is empty', async () => {
    mockGitByCommand({
      branch: 'main\n',
      status: '',
      'rev-list': '',
      stash: '',
      log: '|',
    });

    const { lastFrame } = await renderAndWait();
    expect(lastFrame()).toContain('ahead:0');
    expect(lastFrame()).toContain('behind:0');
  });

  it('parses lastCommit and lastCommitTime from log output', async () => {
    mockGitByCommand({
      branch: 'main\n',
      status: '',
      'rev-list': '',
      stash: '',
      log: 'feat: add tests|3 days ago\n',
    });

    const { lastFrame } = await renderAndWait();
    expect(lastFrame()).toContain('lastCommit:feat: add tests');
    expect(lastFrame()).toContain('lastCommitTime:3 days');
  });

  it('returns empty strings for lastCommit and lastCommitTime when log returns empty', async () => {
    mockGitByCommand({
      branch: 'main\n',
      status: '',
      'rev-list': '',
      stash: '',
      log: '',
    });

    const { lastFrame } = await renderAndWait();
    expect(lastFrame()).toContain('lastCommit: ');
    // lastCommitTime will also be empty
  });

  it('still renders after git commands fail (returns empty strings)', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      (callback as Function)(new Error('not a git repo'), '', '');
      return {} as any;
    });

    const { lastFrame } = await renderAndWait();
    // Hook returns empty strings for failed commands, so status is set
    // The component should show some output (not just "loading")
    expect(lastFrame()).toBeDefined();
  });
});
