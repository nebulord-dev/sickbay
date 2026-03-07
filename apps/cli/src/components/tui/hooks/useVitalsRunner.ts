import { useState, useCallback, useRef } from "react";
import type { VitalsReport, MonorepoReport, CheckResult } from "@vitals/core";
import { runVitals, runVitalsMonorepo, detectMonorepo, buildSummary, calculateOverallScore } from "@vitals/core";

interface ProgressItem {
  name: string;
  status: "pending" | "running" | "done";
}

interface UseVitalsRunnerOptions {
  projectPath: string;
  checks?: string[];
}

/**
 * Synthesize a rolled-up VitalsReport from a MonorepoReport for use in
 * TUI panels that only understand single-project reports. Strategy: merge
 * all checks from all packages, keeping the worst score per check name.
 */
function rollUpMonorepoReport(monorepo: MonorepoReport): VitalsReport {
  const byId = new Map<string, CheckResult>();
  for (const pkg of monorepo.packages) {
    for (const check of pkg.checks) {
      const existing = byId.get(check.id);
      if (!existing || check.score < existing.score) {
        byId.set(check.id, check);
      }
    }
  }
  const checks = Array.from(byId.values());
  return {
    timestamp: monorepo.timestamp,
    projectPath: monorepo.rootPath,
    projectInfo: {
      name: `monorepo (${monorepo.packages.length} packages)`,
      version: "0.0.0",
      hasTypeScript: false,
      hasESLint: false,
      hasPrettier: false,
      framework: "node",
      packageManager: monorepo.packageManager,
      totalDependencies: 0,
      dependencies: {},
      devDependencies: {},
    },
    checks,
    overallScore: monorepo.overallScore,
    summary: buildSummary(checks),
  };
}

export function useVitalsRunner({ projectPath, checks }: UseVitalsRunnerOptions) {
  const [report, setReport] = useState<VitalsReport | null>(null);
  const [monorepoReport, setMonorepoReport] = useState<MonorepoReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scanningRef = useRef(false);

  const scan = useCallback(async () => {
    if (scanningRef.current) return null;
    scanningRef.current = true;
    setIsScanning(true);
    setError(null);

    try {
      const monorepoInfo = await detectMonorepo(projectPath);

      if (monorepoInfo.isMonorepo) {
        const result = await runVitalsMonorepo({
          projectPath,
          checks,
        });

        setMonorepoReport(result);
        const rolledUp = rollUpMonorepoReport(result);
        setReport(rolledUp);

        setIsScanning(false);
        scanningRef.current = false;
        return rolledUp;
      }

      const result = await runVitals({
        projectPath,
        checks,
        onRunnersReady: (names) => {
          setProgress(names.map((name) => ({ name, status: "pending" as const })));
        },
        onCheckStart: (name) => {
          setProgress((prev) =>
            prev.map((p) => (p.name === name ? { ...p, status: "running" } : p)),
          );
        },
        onCheckComplete: (check) => {
          setProgress((prev) =>
            prev.map((p) => (p.name === check.id ? { ...p, status: "done" } : p)),
          );
        },
      });

      setMonorepoReport(null);
      setReport(result);

      // Save to trend history
      try {
        const { saveEntry } = await import("../../../lib/history.js");
        saveEntry(result);
      } catch {
        // Non-critical
      }

      setIsScanning(false);
      scanningRef.current = false;
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsScanning(false);
      scanningRef.current = false;
      return null;
    }
  }, [projectPath, checks]);

  return { report, monorepoReport, isScanning, progress, error, scan };
}

export { calculateOverallScore };
