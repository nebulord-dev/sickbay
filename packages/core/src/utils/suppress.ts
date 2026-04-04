import picomatch from 'picomatch';

import type { SuppressionRule } from '../config.js';
import type { Issue } from '../types.js';

export interface SuppressionResult {
  issues: Issue[];
  suppressedCount: number;
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
