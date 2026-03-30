import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { GitStatus } from './hooks/useGitStatus.js';

// Mock the hook — GitPanel is a thin presenter that delegates everything to useGitStatus
vi.mock('./hooks/useGitStatus.js', () => ({
  useGitStatus: vi.fn(),
}));

import { GitPanel } from './GitPanel.js';
import { useGitStatus } from './hooks/useGitStatus.js';

const mockUseGitStatus = vi.mocked(useGitStatus);

const makeGitStatus = (overrides?: Partial<GitStatus>): GitStatus => ({
  branch: 'main',
  modified: 0,
  staged: 0,
  untracked: 0,
  ahead: 0,
  behind: 0,
  stashes: 0,
  lastCommit: 'fix: resolve issue with auth',
  lastCommitTime: '2 hours ago',
  ...overrides,
});

describe('GitPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state when hook returns null', () => {
    mockUseGitStatus.mockReturnValue(null);

    const { lastFrame } = render(<GitPanel projectPath="/test/project" />);

    expect(lastFrame()).toContain('Loading git info...');
  });

  it('shows the branch name', () => {
    mockUseGitStatus.mockReturnValue(makeGitStatus({ branch: 'feature/my-branch' }));

    const { lastFrame } = render(<GitPanel projectPath="/test/project" />);

    expect(lastFrame()).toContain('feature/my-branch');
  });

  it('shows modified file count', () => {
    mockUseGitStatus.mockReturnValue(makeGitStatus({ modified: 3 }));

    const { lastFrame } = render(<GitPanel projectPath="/test/project" />);

    expect(lastFrame()).toContain('3');
    expect(lastFrame()).toContain('Modified');
  });

  it('shows staged file count', () => {
    mockUseGitStatus.mockReturnValue(makeGitStatus({ staged: 2 }));

    const { lastFrame } = render(<GitPanel projectPath="/test/project" />);

    expect(lastFrame()).toContain('2');
    expect(lastFrame()).toContain('Staged');
  });

  it('shows untracked file count', () => {
    mockUseGitStatus.mockReturnValue(makeGitStatus({ untracked: 5 }));

    const { lastFrame } = render(<GitPanel projectPath="/test/project" />);

    expect(lastFrame()).toContain('5');
    expect(lastFrame()).toContain('Untracked');
  });

  it('shows ahead/behind indicators when present', () => {
    mockUseGitStatus.mockReturnValue(makeGitStatus({ ahead: 2, behind: 1 }));

    const { lastFrame } = render(<GitPanel projectPath="/test/project" />);

    const output = lastFrame();
    // Ahead uses ↑ arrow, behind uses ↓
    expect(output).toContain('2');
    expect(output).toContain('1');
  });

  it('does not show ahead/behind row when both are zero', () => {
    mockUseGitStatus.mockReturnValue(makeGitStatus({ ahead: 0, behind: 0 }));

    const { lastFrame } = render(<GitPanel projectPath="/test/project" />);

    const output = lastFrame();
    // No ↑ or ↓ symbols should appear for ahead/behind
    expect(output).not.toContain('↑');
    expect(output).not.toContain('↓');
  });

  it('shows last commit message', () => {
    mockUseGitStatus.mockReturnValue(
      makeGitStatus({ lastCommit: 'chore: update deps', lastCommitTime: '3 hours ago' }),
    );

    const { lastFrame } = render(<GitPanel projectPath="/test/project" />);

    const output = lastFrame();
    expect(output).toContain('chore: update deps');
    expect(output).toContain('3 hours ago');
  });

  it('truncates long commit messages to availableWidth', () => {
    const longMessage = 'fix: this is a very long commit message that exceeds limit';
    mockUseGitStatus.mockReturnValue(makeGitStatus({ lastCommit: longMessage }));

    const { lastFrame } = render(<GitPanel projectPath="/test/project" availableWidth={30} />);

    const output = lastFrame();
    // Should be truncated to (availableWidth - 3) chars + "..."
    expect(output).toContain(longMessage.slice(0, 27) + '...');
    expect(output).not.toContain(longMessage);
  });

  it('shows stash count when stashes exist', () => {
    mockUseGitStatus.mockReturnValue(makeGitStatus({ stashes: 3 }));

    const { lastFrame } = render(<GitPanel projectPath="/test/project" />);

    const output = lastFrame();
    expect(output).toContain('Stashes');
    expect(output).toContain('3');
  });

  it('does not show stashes row when stash count is zero', () => {
    mockUseGitStatus.mockReturnValue(makeGitStatus({ stashes: 0 }));

    const { lastFrame } = render(<GitPanel projectPath="/test/project" />);

    expect(lastFrame()).not.toContain('Stashes');
  });

  it('shows Branch label in output', () => {
    mockUseGitStatus.mockReturnValue(makeGitStatus({ branch: 'develop' }));

    const { lastFrame } = render(<GitPanel projectPath="/test/project" />);

    expect(lastFrame()).toContain('Branch');
    expect(lastFrame()).toContain('develop');
  });

  it('passes projectPath to useGitStatus hook', () => {
    mockUseGitStatus.mockReturnValue(null);

    render(<GitPanel projectPath="/my/project/path" />);

    expect(mockUseGitStatus).toHaveBeenCalledWith('/my/project/path');
  });
});
