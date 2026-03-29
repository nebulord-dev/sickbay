import { useState, useCallback, useRef } from "react";
import type { SickbayReport, MonorepoReport, CheckResult } from "@sickbay/core";
import { runSickbay, runSickbayMonorepo, detectMonorepo, buildSummary } from "@sickbay/core";

interface ProgressItem {
  name: string;
  status: "pending" | "running" | "done";
}

interface UseSickbayRunnerOptions {
  projectPath: string;
  checks?: string[];
  quotes?: boolean;
}

/**
 * Synthesize a rolled-up SickbayReport from a MonorepoReport for use in
 * TUI panels that only understand single-project reports. Strategy: merge
 * all checks from all packages, keeping the worst score per check name.
 */
function rollUpMonorepoReport(monorepo: MonorepoReport): SickbayReport {
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

export function useSickbayRunner({ projectPath, checks, quotes }: UseSickbayRunnerOptions) {
  const [report, setReport] = useState<SickbayReport | null>(null);
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
        const result = await runSickbayMonorepo({
          projectPath,
          checks,
          quotes,
        });

        setMonorepoReport(result);
        const rolledUp = rollUpMonorepoReport(result);
        setReport(rolledUp);

        setIsScanning(false);
        scanningRef.current = false;
        return rolledUp;
      }

      const result = await runSickbay({
        projectPath,
        checks,
        quotes,
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
  }, [projectPath, checks, quotes]);

  return { report, monorepoReport, isScanning, progress, error, scan };
}

