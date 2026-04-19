import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'fs';
import { join } from 'path';

import type { SickbayReport } from 'sickbay-core';

/**
 * Crash-safe JSON write: write to a sibling `.tmp` path, then rename into
 * place. If the process is killed mid-write (SIGINT, power loss, OOM, disk
 * full), the target file is either fully written or unchanged — never
 * truncated. Downstream readers (`diff`, `stats`, `trend`, `badge`, and the
 * web server) previously had no recovery path for a partial `last-report.json`
 * or `dep-tree.json` since `loadHistory` is the only reader with a `try/catch`.
 *
 * `renameSync` is atomic on POSIX and atomic within a single volume on
 * Windows. `.tmp` and the destination are always siblings, so that's
 * guaranteed to be true here.
 */
function writeJsonAtomic(filePath: string, data: unknown): void {
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  renameSync(tmpPath, filePath);
}

export interface TrendEntry {
  timestamp: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  summary: { critical: number; warnings: number; info: number };
  checksRun: number;
}

export interface TrendHistory {
  projectPath: string;
  projectName: string;
  entries: TrendEntry[];
}

function historyFilePath(projectPath: string): string {
  return join(projectPath, '.sickbay', 'history.json');
}

export function loadHistory(projectPath: string): TrendHistory | null {
  const filePath = historyFilePath(projectPath);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveEntry(report: SickbayReport): void {
  mkdirSync(join(report.projectPath, '.sickbay'), { recursive: true });

  const filePath = historyFilePath(report.projectPath);
  const existing = loadHistory(report.projectPath) ?? {
    projectPath: report.projectPath,
    projectName: report.projectInfo.name,
    entries: [],
  };

  const categoryScores: Record<string, number> = {};
  const categoryChecks: Record<string, number[]> = {};
  for (const check of report.checks) {
    if (check.status === 'skipped') continue;
    if (!categoryChecks[check.category]) categoryChecks[check.category] = [];
    categoryChecks[check.category].push(check.score);
  }
  for (const [cat, scores] of Object.entries(categoryChecks)) {
    categoryScores[cat] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  existing.entries.push({
    timestamp: report.timestamp,
    overallScore: report.overallScore,
    categoryScores,
    summary: { ...report.summary },
    checksRun: report.checks.filter((c) => c.status !== 'skipped').length,
  });

  if (existing.entries.length > 100) {
    existing.entries = existing.entries.slice(-100);
  }

  writeJsonAtomic(filePath, existing);
}

export function saveLastReport(report: SickbayReport): void {
  mkdirSync(join(report.projectPath, '.sickbay'), { recursive: true });
  writeJsonAtomic(join(report.projectPath, '.sickbay', 'last-report.json'), report);
}

export function saveDepTree(projectPath: string, tree: unknown): void {
  mkdirSync(join(projectPath, '.sickbay'), { recursive: true });
  writeJsonAtomic(join(projectPath, '.sickbay', 'dep-tree.json'), tree);
}

export function detectRegressions(
  entries: TrendEntry[],
): Array<{ category: string; drop: number; from: number; to: number }> {
  if (entries.length < 2) return [];
  const latest = entries[entries.length - 1];
  const previous = entries[entries.length - 2];

  const regressions: Array<{
    category: string;
    drop: number;
    from: number;
    to: number;
  }> = [];

  if (latest.overallScore < previous.overallScore - 5) {
    regressions.push({
      category: 'overall',
      drop: previous.overallScore - latest.overallScore,
      from: previous.overallScore,
      to: latest.overallScore,
    });
  }

  for (const [cat, score] of Object.entries(latest.categoryScores)) {
    const prevScore = previous.categoryScores[cat];
    if (prevScore !== undefined && score < prevScore - 5) {
      regressions.push({
        category: cat,
        drop: prevScore - score,
        from: prevScore,
        to: score,
      });
    }
  }

  return regressions;
}
