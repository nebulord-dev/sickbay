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

      // Check if repo is stale (last commit > 6 months ago)
      const isStale =
        lastCommit.includes('year') ||
        (lastCommit.includes('month') && parseInt(lastCommit) > staleMonths);
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
