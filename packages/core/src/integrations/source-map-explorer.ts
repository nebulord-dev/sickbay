import { execa } from "execa";
import { globby } from "globby";
import { statSync } from "fs";
import { join } from "path";
import { BaseRunner } from "./base.js";
import {
  timer,
  isCommandAvailable,
  fileExists,
  coreLocalDir,
  parseJsonOutput,
} from "../utils/file-helpers.js";
import type { CheckResult, Issue } from "../types.js";

/**
 * SourceMapExplorerRunner analyzes the project's JavaScript bundle size using source-map-explorer if source maps are available.
 * It checks for the presence of source maps in the build output and runs source-map-explorer to get a detailed breakdown of bundle sizes.
 * If source maps are not available or the tool fails, it falls back to a simple file size analysis of the JavaScript files in the build directory.
 * The runner reports issues with actionable feedback on how to optimize bundle size, such as using code splitting or tree-shaking.
 * It calculates an overall score based on the total bundle size, providing insights into the project's performance health regarding bundle optimization.
 */

interface SmeOutput {
  files: Record<string, { size: number }>;
  totalBytes?: number;
}

const SIZE_THRESHOLD_WARN = 500 * 1024; // 500KB
const SIZE_THRESHOLD_FAIL = 1024 * 1024; // 1MB

export class SourceMapExplorerRunner extends BaseRunner {
  name = "source-map-explorer";
  category = "performance" as const;

  async isApplicable(projectPath: string): Promise<boolean> {
    return fileExists(projectPath, "dist") || fileExists(projectPath, "build");
  }

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const buildDir = fileExists(projectPath, "dist") ? "dist" : "build";
    const buildPath = join(projectPath, buildDir);

    // Check if source maps exist
    const mapFiles = await globby("**/*.js.map", {
      cwd: buildPath,
      absolute: false,
    });
    const hasSourceMaps = mapFiles.length > 0;

    // Try source-map-explorer if maps exist and tool is available
    if (hasSourceMaps) {
      const available = await isCommandAvailable("source-map-explorer");
      if (available) {
        try {
          const { stdout } = await execa(
            "source-map-explorer",
            [`${buildDir}/**/*.js`, "--json"],
            {
              cwd: projectPath,
              reject: false,
              preferLocal: true,
              localDir: coreLocalDir,
            },
          );

          // Validate JSON output before parsing
          if (stdout && stdout.trim().startsWith("{")) {
            const data = parseJsonOutput(stdout, "{}") as SmeOutput;
            const totalBytes =
              data.totalBytes ??
              Object.values(data.files).reduce((sum, f) => sum + f.size, 0);
            const totalKB = Math.round(totalBytes / 1024);

            const issues: Issue[] = [];
            if (totalBytes > SIZE_THRESHOLD_FAIL) {
              issues.push({
                severity: "critical",
                message: `Bundle size is ${totalKB}KB — exceeds 1MB threshold`,
                fix: {
                  description:
                    "Use code splitting and lazy imports to reduce bundle size",
                },
                reportedBy: ["source-map-explorer"],
              });
            } else if (totalBytes > SIZE_THRESHOLD_WARN) {
              issues.push({
                severity: "warning",
                message: `Bundle size is ${totalKB}KB — consider optimizing`,
                fix: {
                  description:
                    "Review large dependencies and consider tree-shaking",
                },
                reportedBy: ["source-map-explorer"],
              });
            }

            const score =
              totalBytes > SIZE_THRESHOLD_FAIL
                ? 40
                : totalBytes > SIZE_THRESHOLD_WARN
                  ? 70
                  : 100;

            return {
              id: "source-map-explorer",
              category: this.category,
              name: "Bundle Size",
              score,
              status:
                issues.length === 0
                  ? "pass"
                  : issues[0].severity === "critical"
                    ? "fail"
                    : "warning",
              issues,
              toolsUsed: ["source-map-explorer"],
              duration: elapsed(),
              metadata: {
                totalBytes,
                totalKB,
                files: data.files,
                method: "source-map-explorer",
              },
            };
          }
        } catch {
          // Fall through to file size analysis
        }
      }
    }

    // Fallback: simple file size analysis (no source maps needed)
    try {
      const jsFiles = await globby("**/*.js", {
        cwd: buildPath,
        absolute: true,
        ignore: ["**/*.map"],
      });

      if (jsFiles.length === 0) {
        return this.skipped(`No JavaScript files found in ${buildDir}/`);
      }

      const totalBytes = jsFiles.reduce((sum, file) => {
        try {
          return sum + statSync(file).size;
        } catch {
          return sum;
        }
      }, 0);

      const totalKB = Math.round(totalBytes / 1024);
      const issues: Issue[] = [];

      if (totalBytes > SIZE_THRESHOLD_FAIL) {
        issues.push({
          severity: "critical",
          message: `Bundle size is ${totalKB}KB — exceeds 1MB threshold`,
          fix: {
            description:
              "Use code splitting and lazy imports to reduce bundle size",
            command: hasSourceMaps
              ? undefined
              : "Enable source maps (sourcemap: true) for detailed analysis",
          },
          reportedBy: ["bundle-size-check"],
        });
      } else if (totalBytes > SIZE_THRESHOLD_WARN) {
        issues.push({
          severity: "warning",
          message: `Bundle size is ${totalKB}KB — consider optimizing`,
          fix: {
            description: "Review large dependencies and consider tree-shaking",
            command: hasSourceMaps
              ? undefined
              : "Enable source maps (sourcemap: true) for detailed analysis",
          },
          reportedBy: ["bundle-size-check"],
        });
      }

      const score =
        totalBytes > SIZE_THRESHOLD_FAIL
          ? 40
          : totalBytes > SIZE_THRESHOLD_WARN
            ? 70
            : 100;

      return {
        id: "source-map-explorer",
        category: this.category,
        name: "Bundle Size",
        score,
        status:
          issues.length === 0
            ? "pass"
            : issues[0].severity === "critical"
              ? "fail"
              : "warning",
        issues,
        toolsUsed: ["file-size-analysis"],
        duration: elapsed(),
        metadata: {
          totalBytes,
          totalKB,
          fileCount: jsFiles.length,
          method: "file-size-analysis",
          note: hasSourceMaps
            ? "Source maps found but analysis failed"
            : "No source maps — using file size analysis",
        },
      };
    } catch (err) {
      return {
        id: "source-map-explorer",
        category: this.category,
        name: "Bundle Size",
        score: 0,
        status: "fail",
        issues: [
          {
            severity: "critical",
            message: `Bundle analysis failed: ${err}`,
            reportedBy: ["bundle-size-check"],
          },
        ],
        toolsUsed: ["file-size-analysis"],
        duration: elapsed(),
      };
    }
  }
}
