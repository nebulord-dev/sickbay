import { mkdirSync, writeFileSync, existsSync, readFileSync, appendFileSync } from "fs";
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

  // Add .vitals entries to project's root .gitignore if not already present
  const rootGitignorePath = join(projectPath, ".gitignore");
  const gitignoreEntries = [".vitals/history.json", ".vitals/cache/"];
  const existingGitignore = existsSync(rootGitignorePath)
    ? readFileSync(rootGitignorePath, "utf-8")
    : "";
  const toAdd = gitignoreEntries.filter((e) => !existingGitignore.includes(e));
  if (toAdd.length > 0) {
    const prefix = existingGitignore.endsWith("\n") || existingGitignore === "" ? "" : "\n";
    appendFileSync(rootGitignorePath, `${prefix}${toAdd.join("\n")}\n`);
  }

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
  if (toAdd.length > 0) {
    console.log(`  .gitignore              — added ${toAdd.join(", ")}`);
  }
  console.log(`\nRun \`vitals\` to add history entries over time.`);
}
