import { useState, useCallback, useRef } from "react";
import type { VitalsReport } from "@vitals/core";
import { runVitals } from "@vitals/core";

interface ProgressItem {
  name: string;
  status: "pending" | "running" | "done";
}

interface UseVitalsRunnerOptions {
  projectPath: string;
  checks?: string[];
}

export function useVitalsRunner({ projectPath, checks }: UseVitalsRunnerOptions) {
  const [report, setReport] = useState<VitalsReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scanningRef = useRef(false);

  const scan = useCallback(async () => {
    if (scanningRef.current) return null;
    scanningRef.current = true;
    setIsScanning(true);
    setError(null);

    const checkNames = checks ?? [
      "knip", "depcheck", "npm-check-updates", "npm-audit",
      "madge", "source-map-explorer", "coverage", "license-checker",
      "jscpd", "git", "eslint", "typescript", "todo-scanner",
      "complexity", "secrets", "heavy-deps", "react-perf", "asset-size",
    ];
    setProgress(checkNames.map((name) => ({ name, status: "pending" as const })));

    try {
      const result = await runVitals({
        projectPath,
        checks,
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

  return { report, isScanning, progress, error, scan };
}
