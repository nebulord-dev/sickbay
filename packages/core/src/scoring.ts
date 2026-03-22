import type { CheckResult, SickbayReport } from './types.js';
import { SCORE_EXCELLENT, SCORE_GOOD, SCORE_FAIR } from '@sickbay/constants';

/**
 * This module provides functions to calculate the overall health score of a project based on various checks,
 * build a summary of issues found, and determine the appropriate color and emoji representations for the score.
 * The scoring system is designed to give more weight to critical categories like security and dependencies,
 * while still considering code quality, performance, and git-related issues.
 * The getScoreColor and getScoreEmoji functions help in visually representing the health status of the project based on the calculated score.
 */

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

export function buildSummary(checks: CheckResult[]): SickbayReport['summary'] {
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
  if (score >= SCORE_GOOD) return 'green';
  if (score >= SCORE_FAIR) return 'yellow';
  return 'red';
}

export function getScoreEmoji(score: number): string {
  if (score >= SCORE_EXCELLENT) return 'Good';
  if (score >= SCORE_GOOD) return 'Fair';
  if (score >= SCORE_FAIR) return 'Poor';
  return 'Bad';
}
