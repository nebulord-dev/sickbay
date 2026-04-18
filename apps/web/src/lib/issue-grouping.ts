import type { CheckResult, Issue } from 'sickbay-core';

/** Extract the stable pattern description from an issue message, stripping file-specific prefixes. */
export function extractPatternStem(message: string): string {
  const idx = message.indexOf(' \u2014 ');
  return idx >= 0 ? message.slice(idx + 3) : message;
}

/** Count unique issue patterns vs raw totals across checks. */
export function countUniqueIssues(checks: CheckResult[]): {
  critical: number;
  warnings: number;
  info: number;
  totalCritical: number;
  totalWarnings: number;
  totalInfo: number;
} {
  const seen = { critical: new Set<string>(), warning: new Set<string>(), info: new Set<string>() };
  const totals = { critical: 0, warning: 0, info: 0 };

  for (const check of checks) {
    for (const issue of check.issues) {
      const stem = extractPatternStem(issue.message);
      const key = `${check.id}::${stem}`;
      seen[issue.severity].add(key);
      totals[issue.severity]++;
    }
  }

  return {
    critical: seen.critical.size,
    warnings: seen.warning.size,
    info: seen.info.size,
    totalCritical: totals.critical,
    totalWarnings: totals.warning,
    totalInfo: totals.info,
  };
}

export interface IssueWithCheck extends Issue {
  checkName: string;
  checkId: string;
}

export interface IssueGroup {
  key: string;
  stem: string;
  severity: Issue['severity'];
  checkName: string;
  checkId: string;
  issues: IssueWithCheck[];
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

/** Group issues by check + pattern stem. Sorted by severity then count descending. */
export function groupIssues(issues: IssueWithCheck[]): IssueGroup[] {
  const map = new Map<string, IssueGroup>();

  for (const issue of issues) {
    const stem = extractPatternStem(issue.message);
    const key = `${issue.checkId}::${stem}`;
    const existing = map.get(key);
    if (existing) {
      existing.issues.push(issue);
    } else {
      map.set(key, {
        key,
        stem,
        severity: issue.severity,
        checkName: issue.checkName,
        checkId: issue.checkId,
        issues: [issue],
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    const sevDiff = (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2);
    if (sevDiff !== 0) return sevDiff;
    return b.issues.length - a.issues.length;
  });
}
