import { execFile } from "child_process";
import { promisify } from "util";
import type { Issue, SickbayReport } from "@sickbay/core";

/**
 * This module provides functions to collect fixable issues from a Sickbay report and execute the associated fix commands.
 * The collectFixableIssues function scans through the checks and their issues to find those that have a fix command,
 * while ensuring that duplicate commands are not included. The executeFix function runs the specified command in the context of the project directory,
 * capturing the output and any errors that may occur during execution. This allows for an automated way to address issues found in the health checks.
 */

const execFileAsync = promisify(execFile);

export interface FixableIssue {
  issue: Issue;
  checkId: string;
  checkName: string;
  command: string;
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
      if (issue.fix?.command && !seen.has(issue.fix.command)) {
        seen.add(issue.fix.command);
        fixable.push({
          issue,
          checkId: check.id,
          checkName: check.name,
          command: issue.fix.command,
        });
      }
    }
  }

  const order = { critical: 0, warning: 1, info: 2 };
  fixable.sort((a, b) => order[a.issue.severity] - order[b.issue.severity]);

  return fixable;
}

export async function executeFix(
  fix: FixableIssue,
  projectPath: string,
): Promise<FixResult> {
  const start = Date.now();
  try {
    const parts = fix.command.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd: projectPath,
      timeout: 60_000,
      shell: true,
    });
    return {
      fixable: fix,
      success: true,
      stdout: stdout ?? "",
      stderr: stderr ?? "",
      duration: Date.now() - start,
    };
  } catch (err) {
    return {
      fixable: fix,
      success: false,
      stdout: "",
      stderr: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}
