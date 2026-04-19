import { execFile } from 'child_process';
import { promisify } from 'util';

import type { Issue, SickbayReport } from 'sickbay-core';

/**
 * This module provides functions to collect fixable issues from a Sickbay report and execute the associated fix commands.
 * The collectFixableIssues function scans through the checks and their issues to find those that have a fix command,
 * while ensuring that duplicate commands are not included. The executeFix function runs the specified command in the context of the project directory,
 * capturing the output and any errors that may occur during execution. This allows for an automated way to address issues found in the health checks.
 */

const execFileAsync = promisify(execFile);

/**
 * Check whether the project's git working tree is clean before applying
 * source-modifying fixes. A dirty tree mixed with Sickbay's own edits means
 * `git checkout` or `git stash` can no longer cleanly revert the bot's work
 * if a fix goes wrong.
 *
 * Returns `clean: true` when there's genuinely nothing to report AND when
 * git is unavailable (no repo, git not installed, permission denied) — the
 * check is advisory, not a hard gate on non-git projects.
 */
export async function checkGitCleanliness(
  projectPath: string,
): Promise<{ clean: boolean; changedFiles: number }> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], {
      cwd: projectPath,
      timeout: 10_000,
    });
    const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
    return { clean: lines.length === 0, changedFiles: lines.length };
  } catch {
    // Not a git repo, git not installed, or command failed. Treat as clean
    // so we never block a user who chose not to version-control their project.
    return { clean: true, changedFiles: 0 };
  }
}

export function hasSourceModifyingFixes(issues: FixableIssue[]): boolean {
  return issues.some((f) => f.issue.fix?.modifiesSource === true);
}

export interface FixableIssue {
  issue: Issue;
  checkId: string;
  checkName: string;
  command?: string;
}

export interface FixResult {
  fixable: FixableIssue;
  success: boolean;
  stdout: string;
  stderr: string;
  duration: number;
}

export function collectFixableIssues(report: SickbayReport): FixableIssue[] {
  const seen = new Set<string>();
  const fixable: FixableIssue[] = [];

  for (const check of report.checks) {
    for (const issue of check.issues) {
      if (issue.fix) {
        const dedupeKey = issue.fix.command ?? issue.fix.description;
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          fixable.push({
            issue,
            checkId: check.id,
            checkName: check.name,
            command: issue.fix.command,
          });
        }
      }
    }
  }

  const order = { critical: 0, warning: 1, info: 2 };
  fixable.sort((a, b) => order[a.issue.severity] - order[b.issue.severity]);

  return fixable;
}

export async function executeFix(fix: FixableIssue, projectPath: string): Promise<FixResult> {
  const start = Date.now();
  if (!fix.command) {
    return {
      fixable: fix,
      success: false,
      stdout: '',
      stderr: 'No command to execute (guidance-only fix)',
      duration: 0,
    };
  }
  try {
    const parts = fix.command.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    // SECURITY: shell is intentionally NOT enabled. Running with `shell: true`
    // would pass cmd+args through `/bin/sh -c`, making any shell metacharacter
    // in `fix.command` (e.g. `;`, `|`, `$()`, backticks) injectable. Today these
    // commands come from internal runner constants, but this is the trust
    // boundary that protects future runners from accidental command injection.
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd: projectPath,
      timeout: 60_000,
    });
    return {
      fixable: fix,
      success: true,
      stdout: stdout ?? '',
      stderr: stderr ?? '',
      duration: Date.now() - start,
    };
  } catch (err) {
    return {
      fixable: fix,
      success: false,
      stdout: '',
      stderr: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}
