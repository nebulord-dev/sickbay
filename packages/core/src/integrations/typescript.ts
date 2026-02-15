import { execa } from "execa";
import { existsSync } from "fs";
import { join } from "path";
import { BaseRunner } from "./base.js";
import { timer } from "../utils/file-helpers.js";
import type { CheckResult, Issue } from "../types.js";

/**
 * TypeScriptRunner uses the TypeScript compiler (tsc) to check for type errors in the project.
 * It runs tsc with --noEmit to perform a type check without generating output files.
 * The runner parses the output of tsc to extract error messages and their locations, reporting them as issues.
 * It calculates an overall score based on the number of type errors, giving insights into the project's type safety health.
 * If tsc fails to run, it reports a critical issue with the error message.
 */

export class TypeScriptRunner extends BaseRunner {
  name = "typescript";
  category = "code-quality" as const;

  async isApplicable(projectPath: string): Promise<boolean> {
    return existsSync(join(projectPath, "tsconfig.json"));
  }

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      // tsc exits with code 1 when there are type errors — use reject: false
      const { stdout, stderr } = await execa(
        "tsc",
        ["--noEmit", "--pretty", "false"],
        {
          cwd: projectPath,
          reject: false,
          preferLocal: true,
          timeout: 120_000,
        },
      );

      const output = (stdout + stderr).trim();

      // Parse lines matching: "src/foo.ts(10,5): error TS2345: ..."
      const errorLines = output
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.includes(": error TS"));

      const count = errorLines.length;

      const issues: Issue[] = errorLines.slice(0, 25).map((line) => {
        const match = line.match(/^(.+)\(\d+,\d+\): error (TS\d+: .+)$/);
        return {
          severity: "warning" as const,
          message: match ? `${match[1]}: ${match[2]}` : line,
          reportedBy: ["tsc"],
        };
      });

      if (count > 25) {
        issues.push({
          severity: "info",
          message: `...and ${count - 25} more type errors`,
          reportedBy: ["tsc"],
        });
      }

      const score = Math.max(0, 100 - count * 5);

      return {
        id: "typescript",
        category: this.category,
        name: "Type Safety",
        score,
        status: count === 0 ? "pass" : count > 20 ? "fail" : "warning",
        issues,
        toolsUsed: ["tsc"],
        duration: elapsed(),
        metadata: { errors: count },
      };
    } catch (err) {
      return {
        id: "typescript",
        category: this.category,
        name: "Type Safety",
        score: 0,
        status: "fail",
        issues: [
          {
            severity: "critical",
            message: `tsc failed: ${err}`,
            reportedBy: ["tsc"],
          },
        ],
        toolsUsed: ["tsc"],
        duration: elapsed(),
      };
    }
  }
}
