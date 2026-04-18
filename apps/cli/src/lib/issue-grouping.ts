import type { CheckResult } from 'sickbay-core';

export function extractPatternStem(message: string): string {
  const idx = message.indexOf(' \u2014 ');
  return idx >= 0 ? message.slice(idx + 3) : message;
}

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
