import picomatch from 'picomatch';

import type { SuppressionRule } from '../config.js';
import type { CheckResult, Issue } from '../types.js';

export interface SuppressionResult {
  issues: Issue[];
  suppressedCount: number;
}

const SEVERITY_WEIGHT: Record<Issue['severity'], number> = {
  critical: 10,
  warning: 3,
  info: 1,
};

function issueWeight(issues: Issue[]): number {
  return issues.reduce((sum, i) => sum + SEVERITY_WEIGHT[i.severity], 0);
}

/**
 * Recalculate a check's score after suppression removes issues.
 * Uses proportional scaling: the penalty (100 − score) is reduced
 * by the same fraction of severity-weight that was suppressed.
 */
export function recalcScoreAfterSuppression(result: CheckResult, originalIssues: Issue[]): void {
  if (result.issues.length === 0) {
    result.score = 100;
    result.status = 'pass';
    return;
  }
  if (result.issues.length === originalIssues.length) return;

  const origWeight = issueWeight(originalIssues);
  if (origWeight === 0) return;

  const remainWeight = issueWeight(result.issues);
  const penalty = 100 - result.score;
  result.score = Math.round(100 - penalty * (remainWeight / origWeight));

  // Update status based on new score and remaining severities
  const hasCritical = result.issues.some((i) => i.severity === 'critical');
  if (hasCritical) {
    result.status = 'fail';
  } else if (result.issues.length > 0) {
    result.status = 'warning';
  } else {
    result.status = 'pass';
  }
}

/**
 * Filter issues against suppression rules.
 * - path: picomatch glob matched against Issue.file
 * - match: case-insensitive substring matched against Issue.message
 * - When both provided: AND logic (both must match)
 * - When only one provided: it alone determines the match
 */
export function applySuppression(issues: Issue[], rules: SuppressionRule[]): SuppressionResult {
  if (rules.length === 0) return { issues, suppressedCount: 0 };

  const compiled = rules.map((rule) => ({
    pathMatch: rule.path ? picomatch(rule.path) : null,
    match: rule.match?.toLowerCase() ?? null,
  }));

  let suppressedCount = 0;
  const kept = issues.filter((issue) => {
    const suppressed = compiled.some((rule) => {
      const pathOk = rule.pathMatch ? (issue.file ? rule.pathMatch(issue.file) : false) : true;
      const matchOk = rule.match ? issue.message.toLowerCase().includes(rule.match) : true;
      return pathOk && matchOk;
    });
    if (suppressed) suppressedCount++;
    return !suppressed;
  });

  return { issues: kept, suppressedCount };
}
