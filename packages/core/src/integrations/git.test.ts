import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GitRunner } from './git.js';

vi.mock('execa', () => ({ execa: vi.fn() }));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  fileExists: vi.fn(),
}));

import { execa } from 'execa';

import { fileExists } from '../utils/file-helpers.js';

const mockExeca = vi.mocked(execa);
const mockFileExists = vi.mocked(fileExists);

function makeGitMock({
  lastCommit = '2 days ago',
  commitCount = '42',
  contributors = '  10\tAlice\n  5\tBob',
  remotes = '',
  branches = '',
}: {
  lastCommit?: string;
  commitCount?: string;
  contributors?: string;
  remotes?: string;
  branches?: string;
} = {}) {
  mockExeca.mockImplementation(((_cmd: unknown, args: unknown) => {
    const a = Array.isArray(args) ? (args as string[]) : [];
    if (a.includes('remote') && !a.includes('-r')) return Promise.resolve({ stdout: remotes });
    if (a.includes('-r')) return Promise.resolve({ stdout: branches });
    if (a.includes('-1')) return Promise.resolve({ stdout: lastCommit });
    if (a.includes('--count')) return Promise.resolve({ stdout: commitCount });
    if (a.includes('-sn')) return Promise.resolve({ stdout: contributors });
    return Promise.resolve({ stdout: '' });
  }) as never);
}

describe('GitRunner', () => {
  let runner: GitRunner;

  beforeEach(() => {
    runner = new GitRunner();
    vi.clearAllMocks();
  });

  describe('isApplicable', () => {
    it('returns true when .git directory exists', async () => {
      mockFileExists.mockReturnValue(true);
      expect(await runner.isApplicable('/project')).toBe(true);
    });

    it('returns false when .git does not exist', async () => {
      mockFileExists.mockReturnValue(false);
      expect(await runner.isApplicable('/project')).toBe(false);
    });
  });

  it('returns pass with score 100 when repo is healthy', async () => {
    makeGitMock();

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('reports stale repo when last commit includes "year"', async () => {
    makeGitMock({ lastCommit: '2 years ago' });

    const result = await runner.run('/project');

    const staleIssue = result.issues.find((i) => i.message.includes('stale'));
    expect(staleIssue).toBeDefined();
    expect(staleIssue?.severity).toBe('warning');
  });

  it('reports stale repo when last commit is 7+ months ago', async () => {
    makeGitMock({ lastCommit: '7 months ago' });

    const result = await runner.run('/project');

    expect(result.issues.some((i) => i.message.includes('stale'))).toBe(true);
  });

  it('does not flag 5 months ago as stale', async () => {
    makeGitMock({ lastCommit: '5 months ago' });

    const result = await runner.run('/project');

    expect(result.issues.some((i) => i.message.includes('stale'))).toBe(false);
  });

  it('flags more than 20 remote branches as info issue', async () => {
    const branchLines = Array.from({ length: 21 }, (_, i) => `  origin/branch-${i}`).join('\n');
    makeGitMock({ remotes: 'origin', branches: branchLines });

    const result = await runner.run('/project');

    const branchIssue = result.issues.find((i) => i.message.includes('remote branches'));
    expect(branchIssue).toBeDefined();
    expect(branchIssue?.severity).toBe('info');
    expect(branchIssue?.fix?.command).toBe('git remote prune origin');
  });

  it('does not flag 20 or fewer remote branches', async () => {
    const branchLines = Array.from({ length: 20 }, (_, i) => `  origin/branch-${i}`).join('\n');
    makeGitMock({ remotes: 'origin', branches: branchLines });

    const result = await runner.run('/project');

    expect(result.issues.some((i) => i.message.includes('remote branches'))).toBe(false);
  });

  it('skips remote branch check when no remotes configured', async () => {
    makeGitMock({ remotes: '' });

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    // execa with -r should NOT have been called
    const callArgs = mockExeca.mock.calls.map((c) => c[1] as string[]);
    expect(callArgs.some((args) => args.includes('-r'))).toBe(false);
  });

  it('populates metadata with commit stats', async () => {
    makeGitMock({
      lastCommit: '3 hours ago',
      commitCount: '150',
      contributors: '  100\tAlice\n  50\tBob',
    });

    const result = await runner.run('/project');

    expect(result.metadata?.lastCommit).toBe('3 hours ago');
    expect(result.metadata?.commitCount).toBe(150);
    expect(result.metadata?.contributorCount).toBe(2);
  });

  it('returns score 80 and warning status when issues found', async () => {
    makeGitMock({ lastCommit: '2 years ago' });

    const result = await runner.run('/project');

    expect(result.score).toBe(80);
    expect(result.status).toBe('warning');
  });

  it('returns fail with score 0 when execa rejects', async () => {
    mockExeca.mockRejectedValue(new Error('git not found'));

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.issues[0].severity).toBe('critical');
  });
});
