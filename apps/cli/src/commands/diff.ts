import { execFileSync } from "child_process";
import type { SickbayReport } from "@sickbay/core";

export interface CheckDiff {
  id: string;
  name: string;
  category: string;
  currentScore: number;
  baseScore: number;
  delta: number;
  status: "improved" | "regressed" | "unchanged" | "new" | "removed";
}

export interface DiffResult {
  branch: string;
  currentScore: number;
  baseScore: number;
  scoreDelta: number;
  checks: CheckDiff[];
  summary: {
    improved: number;
    regressed: number;
    unchanged: number;
    newChecks: number;
    removedChecks: number;
  };
}

export function loadBaseReport(
  projectPath: string,
  branch: string,
): SickbayReport | null {
  try {
    const output = execFileSync(
      "git",
      ["show", `${branch}:.sickbay/last-report.json`],
      { cwd: projectPath, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );
    return JSON.parse(output) as SickbayReport;
  } catch {
    return null;
  }
}

const STATUS_ORDER: Record<CheckDiff["status"], number> = {
  regressed: 0,
  improved: 1,
  new: 2,
  removed: 3,
  unchanged: 4,
};

export function compareReports(
  current: SickbayReport,
  base: SickbayReport,
  branch: string,
): DiffResult {
  const baseMap = new Map(base.checks.map((c) => [c.id, c]));
  const currentMap = new Map(current.checks.map((c) => [c.id, c]));

  const checks: CheckDiff[] = [];

  // Checks in current
  for (const check of current.checks) {
    const baseCheck = baseMap.get(check.id);
    if (!baseCheck) {
      checks.push({
        id: check.id,
        name: check.name,
        category: check.category,
        currentScore: check.score,
        baseScore: 0,
        delta: check.score,
        status: "new",
      });
    } else {
      const delta = check.score - baseCheck.score;
      checks.push({
        id: check.id,
        name: check.name,
        category: check.category,
        currentScore: check.score,
        baseScore: baseCheck.score,
        delta,
        status: delta > 0 ? "improved" : delta < 0 ? "regressed" : "unchanged",
      });
    }
  }

  // Checks only in base (removed)
  for (const check of base.checks) {
    if (!currentMap.has(check.id)) {
      checks.push({
        id: check.id,
        name: check.name,
        category: check.category,
        currentScore: 0,
        baseScore: check.score,
        delta: -check.score,
        status: "removed",
      });
    }
  }

  // Sort: regressions first, then improvements, then new, removed, unchanged
  checks.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const summary = {
    improved: checks.filter((c) => c.status === "improved").length,
    regressed: checks.filter((c) => c.status === "regressed").length,
    unchanged: checks.filter((c) => c.status === "unchanged").length,
    newChecks: checks.filter((c) => c.status === "new").length,
    removedChecks: checks.filter((c) => c.status === "removed").length,
  };

  return {
    branch,
    currentScore: current.overallScore,
    baseScore: base.overallScore,
    scoreDelta: current.overallScore - base.overallScore,
    checks,
    summary,
  };
}
