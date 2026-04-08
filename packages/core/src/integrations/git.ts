import { execa } from 'execa';

import { timer, fileExists } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue, RunOptions } from '../types.js';

interface GitThresholds {
  staleMonths?: number;
  maxRemoteBranches?: number;
}

/**
 * GitRunner analyzes the Git repository of the project to provide insights into its health and activity.
 * It checks for the presence of a .git directory to confirm applicability, then gathers data on the last commit date, total commit count, number of contributors, and remote branches.
 * The runner identifies potential issues such as stale repositories (no recent commits) and excessive remote branches, providing actionable feedback for maintaining a healthy Git history.
 * This helps ensure that the project is actively maintained and that the Git repository is well-managed.
 */

export class GitRunner extends BaseRunner {
  name = 'git';
  category = 'git' as const;

  async isApplicable(projectPath: string): Promise<boolean> {
    return fileExists(projectPath, '.git');
  }

  async run(projectPath: string, options?: RunOptions): Promise<CheckResult> {
    const elapsed = timer();
    const thresholds = options?.checkConfig?.thresholds as GitThresholds | undefined;
    const staleMonths = thresholds?.staleMonths ?? 6;
    const maxRemoteBranches = thresholds?.maxRemoteBranches ?? 20;

    try {
      const [lastCommitResult, logCountResult, contributorsResult] = await Promise.allSettled([
        execa('git', ['log', '-1', '--format=%cr'], { cwd: projectPath }),
        execa('git', ['rev-list', '--count', 'HEAD'], { cwd: projectPath }),
        execa('git', ['shortlog', '-sn', '--no-merges', 'HEAD'], { cwd: projectPath }),
      ]);

      // Check for remotes first (git remote is instant), then branch -r only if remotes exist
      const remotesResult = await execa('git', ['remote'], { cwd: projectPath, reject: false });
      const hasRemote = remotesResult.stdout.trim().length > 0;
      let remoteBranches = 0;
      if (hasRemote) {
        const branchResult = await execa('git', ['branch', '-r'], {
          cwd: projectPath,
          reject: false,
        });
        remoteBranches = branchResult.stdout.trim().split('\n').filter(Boolean).length;
      }

      const lastCommit =
        lastCommitResult.status === 'fulfilled' ? lastCommitResult.value.stdout.trim() : 'unknown';
      const commitCount =
        logCountResult.status === 'fulfilled'
          ? parseInt(logCountResult.value.stdout.trim(), 10)
          : 0;
      const contributorCount =
        contributorsResult.status === 'fulfilled'
          ? contributorsResult.value.stdout.trim().split('\n').filter(Boolean).length
          : 0;

      const issues: Issue[] = [];

      // Check if repo is stale (last commit > N months ago).
      // git's relative date strings look like "3 months ago", "a month ago",
      // "2 years ago", "a year ago". `parseInt('a month ago')` returns NaN,
      // which would silently skip the "exactly one month" case under the
      // previous substring-based check. Parse the leading number explicitly
      // and treat the word "a"/"an" as 1. Both branches must respect the
      // staleMonths threshold — previously the year branch short-circuited
      // unconditionally, so a consumer setting `staleMonths: 999` to disable
      // stale detection would still get "2 years ago" repos flagged.
      const lastCommitMonths = lastCommit.includes('year')
        ? parseGitRelativeCount(lastCommit) * 12
        : lastCommit.includes('month')
          ? parseGitRelativeCount(lastCommit)
          : 0;
      const isStale = lastCommitMonths > staleMonths;
      if (isStale) {
        issues.push({
          severity: 'warning',
          message: `Last commit was ${lastCommit} — project may be stale`,
          reportedBy: ['git'],
        });
      }

      if (remoteBranches > maxRemoteBranches) {
        issues.push({
          severity: 'info',
          message: `${remoteBranches} remote branches — consider pruning stale branches`,
          fix: { description: 'Clean up merged branches', command: 'git remote prune origin' },
          reportedBy: ['git'],
        });
      }

      return {
        id: 'git',
        category: this.category,
        name: 'Git Health',
        score: issues.length === 0 ? 100 : 80,
        status: issues.length === 0 ? 'pass' : 'warning',
        issues,
        toolsUsed: ['git'],
        duration: elapsed(),
        metadata: { lastCommit, commitCount, contributorCount, remoteBranches },
      };
    } catch (err) {
      return {
        id: 'git',
        category: this.category,
        name: 'Git Health',
        score: 0,
        status: 'fail',
        issues: [
          { severity: 'critical', message: `git analysis failed: ${err}`, reportedBy: ['git'] },
        ],
        toolsUsed: ['git'],
        duration: elapsed(),
      };
    }
  }
}

/**
 * Extract the leading numeric count from a git relative-date string like
 * "3 months ago" or "a month ago". The word "a"/"an" represents 1.
 * Returns 0 if the string can't be parsed (which keeps stale-detection
 * conservative — non-parseable strings won't trigger a stale warning).
 */
export function parseGitRelativeCount(s: string): number {
  const trimmed = s.trim().toLowerCase();
  if (trimmed.startsWith('a ') || trimmed.startsWith('an ')) return 1;
  const match = trimmed.match(/^(\d+)\b/);
  return match ? parseInt(match[1], 10) : 0;
}
