import type { CheckResult, VitalsReport } from './types.js';

const CATEGORY_WEIGHTS: Record<string, number> = {
  dependencies: 0.25,
  security: 0.30,
  'code-quality': 0.25,
  performance: 0.15,
  git: 0.05,
};

export function calculateOverallScore(checks: CheckResult[]): number {
  const active = checks.filter((c) => c.status !== 'skipped');
  if (active.length === 0) return 0;

  let totalWeight = 0;
  let weightedScore = 0;

  for (const check of active) {
    const weight = CATEGORY_WEIGHTS[check.category] ?? 0.1;
    weightedScore += check.score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
}

export function buildSummary(checks: CheckResult[]): VitalsReport['summary'] {
  const summary = { critical: 0, warnings: 0, info: 0 };
  for (const check of checks) {
    for (const issue of check.issues) {
      if (issue.severity === 'critical') summary.critical++;
      else if (issue.severity === 'warning') summary.warnings++;
      else summary.info++;
    }
  }
  return summary;
}

export function getScoreColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

export function getScoreEmoji(score: number): string {
  if (score >= 90) return 'Good';
  if (score >= 80) return 'Fair';
  if (score >= 60) return 'Poor';
  return 'Bad';
}
