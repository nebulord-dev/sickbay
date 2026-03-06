import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { runVitals } from "@vitals/core";
import { saveEntry } from "../lib/history.js";

export async function initVitals(projectPath: string): Promise<void> {
  const vitalsDir = join(projectPath, ".vitals");

  // Scaffold .vitals/
  mkdirSync(vitalsDir, { recursive: true });

  // Write .gitignore — history is local, baseline is committed
  writeFileSync(
    join(vitalsDir, ".gitignore"),
    "history.json\ncache/\n",
  );

  const baselinePath = join(vitalsDir, "baseline.json");
  if (existsSync(baselinePath)) {
    console.log(
      "⚠  .vitals/baseline.json already exists. Overwriting with new scan.",
    );
  }

  console.log("Running initial scan to generate baseline...\n");

  const report = await runVitals({ projectPath });

  writeFileSync(baselinePath, JSON.stringify(report, null, 2));

  // Seed history with this first entry
  try {
    saveEntry(report);
  } catch {
    // Non-critical
  }

  const scoreLabel =
    report.overallScore >= 80
      ? "good"
      : report.overallScore >= 60
        ? "fair"
        : "needs work";

  console.log(`\n✓ Vitals initialized for ${report.projectInfo.name}`);
  console.log(`  Overall score: ${report.overallScore}/100 (${scoreLabel})`);
  console.log(`\nCreated:`);
  console.log(`  .vitals/baseline.json   — committed (team baseline)`);
  console.log(`  .vitals/.gitignore      — ignores history.json + cache/`);
  console.log(`\nRun \`vitals\` to add history entries over time.`);
}
