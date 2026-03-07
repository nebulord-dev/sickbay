import { execa } from "execa";
import { globby } from "globby";
import { statSync, readFileSync } from "fs";
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

interface SmeResult {
  bundleName: string;
  totalBytes: number;
  files: Record<string, { size: number }>;
}

interface SmeOutput {
  results?: SmeResult[];
}

const SIZE_THRESHOLD_WARN = 500 * 1024; // 500KB
const SIZE_THRESHOLD_FAIL = 1024 * 1024; // 1MB

/**
 * Parses index.html in the build dir to find entry chunk script tags.
 * Returns absolute paths to the entry JS files, or [] if not determinable.
 */
function findEntryChunks(buildPath: string): string[] {
  try {
    const html = readFileSync(join(buildPath, 'index.html'), 'utf8');
    const matches = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*>/gi)];
    return matches.map((m) => join(buildPath, m[1].replace(/^\//, '')));
  } catch {
    return [];
  }
}

export class SourceMapExplorerRunner extends BaseRunner {
  name = "source-map-explorer";
  category = "performance" as const;
  applicableRuntimes = ['browser'] as const;

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
            const results = data.results ?? [];

            if (results.length > 0) {
              const totalBytes = results.reduce((sum, r) => sum + r.totalBytes, 0);
              const largestBytes = Math.max(...results.map((r) => r.totalBytes));
              const totalKB = Math.round(totalBytes / 1024);
              const largestKB = Math.round(largestBytes / 1024);

              const issues: Issue[] = [];
              if (largestBytes > SIZE_THRESHOLD_FAIL) {
                issues.push({
                  severity: "critical",
                  message: `Largest bundle is ${largestKB}KB — exceeds 1MB threshold`,
                  fix: {
                    description:
                      "Use code splitting and lazy imports to reduce bundle size",
                  },
                  reportedBy: ["source-map-explorer"],
                });
              } else if (largestBytes > SIZE_THRESHOLD_WARN) {
                issues.push({
                  severity: "warning",
                  message: `Largest bundle is ${largestKB}KB — consider optimizing`,
                  fix: {
                    description:
                      "Review large dependencies and consider tree-shaking",
                  },
                  reportedBy: ["source-map-explorer"],
                });
              }

              const score =
                largestBytes > SIZE_THRESHOLD_FAIL
                  ? 40
                  : largestBytes > SIZE_THRESHOLD_WARN
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
                  largestBytes,
                  largestKB,
                  totalBytes,
                  totalKB,
                  bundleCount: results.length,
                  method: "source-map-explorer",
                },
              };
            }
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

      // Detect entry chunks from index.html to score on initial bundle only
      const entryChunks = findEntryChunks(buildPath);
      const hasEntryChunkInfo = entryChunks.length > 0;
      const initialBytes = hasEntryChunkInfo
        ? entryChunks.reduce((sum, file) => {
            try {
              return sum + statSync(file).size;
            } catch {
              return sum;
            }
          }, 0)
        : totalBytes;

      const totalKB = Math.round(totalBytes / 1024);
      const initialKB = Math.round(initialBytes / 1024);
      const issues: Issue[] = [];

      if (initialBytes > SIZE_THRESHOLD_FAIL) {
        issues.push({
          severity: "critical",
          message: `Initial bundle is ${initialKB}KB — exceeds 1MB threshold`,
          fix: {
            description:
              "Use code splitting and lazy imports to reduce bundle size",
            command: hasSourceMaps
              ? undefined
              : "Enable source maps (sourcemap: true) for detailed analysis",
          },
          reportedBy: ["bundle-size-check"],
        });
      } else if (initialBytes > SIZE_THRESHOLD_WARN) {
        issues.push({
          severity: "warning",
          message: `Initial bundle is ${initialKB}KB — consider optimizing`,
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
        initialBytes > SIZE_THRESHOLD_FAIL
          ? 40
          : initialBytes > SIZE_THRESHOLD_WARN
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
          initialBytes,
          initialKB,
          totalBytes,
          totalKB,
          fileCount: jsFiles.length,
          entryChunks: entryChunks.length,
          method: "file-size-analysis",
          note: hasEntryChunkInfo
            ? `Total bundle: ${totalKB}KB across ${jsFiles.length} chunks`
            : hasSourceMaps
              ? "Source maps found but analysis failed"
              : "No source maps — using total bundle size",
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
