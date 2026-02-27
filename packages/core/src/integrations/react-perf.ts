import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import type { CheckResult, Issue } from "../types.js";
import { BaseRunner } from "./base.js";
import { timer, fileExists, WARN_LINES } from "../utils/file-helpers.js";

/**
 * ReactPerfRunner analyzes React component files for common performance anti-patterns.
 * It scans .tsx and .jsx files for issues like inline objects in JSX props, using array index as key in lists, and large component files.
 * The runner provides actionable feedback on how to fix each issue, such as extracting inline objects or using unique keys.
 * It calculates an overall score based on the number and severity of findings, giving insights into the project's React performance health.
 */

const COMPONENT_EXTENSIONS = new Set([".tsx", ".jsx"]);

interface Finding {
  file: string;
  line: number;
  pattern: string;
  severity: "warning" | "info";
}

export class ReactPerfRunner extends BaseRunner {
  name = "react-perf";
  category = "performance" as const;

  async isApplicable(projectPath: string): Promise<boolean> {
    return fileExists(projectPath, "src");
  }

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const findings: Finding[] = [];
      const files = scanDirectory(join(projectPath, "src"), projectPath);

      for (const file of files) {
        findings.push(...analyzeFile(file.path, file.fullPath, file.lines));
      }

      const issues: Issue[] = findings.map((f) => ({
        severity: f.severity,
        message:
          f.line > 0
            ? `${f.file}:${f.line} — ${f.pattern}`
            : `${f.file} — ${f.pattern}`,
        file: f.file,
        fix: { description: getFixDescription(f.pattern) },
        reportedBy: ["react-perf"],
      }));

      const warningCount = findings.filter(
        (f) => f.severity === "warning",
      ).length;
      const infoCount = findings.filter((f) => f.severity === "info").length;
      const score = Math.max(20, 100 - warningCount * 3 - infoCount * 1);

      return {
        id: "react-perf",
        category: this.category,
        name: "React Performance",
        score,
        status:
          warningCount > 0 ? "warning" : infoCount > 0 ? "warning" : "pass",
        issues,
        toolsUsed: ["react-perf"],
        duration: elapsed(),
        metadata: {
          filesScanned: files.length,
          totalFindings: findings.length,
          inlineObjects: findings.filter((f) => f.pattern.includes("Inline"))
            .length,
          indexAsKey: findings.filter((f) => f.pattern.includes("index as key"))
            .length,
          largeComponents: findings.filter((f) =>
            f.pattern.includes("Large component"),
          ).length,
        },
      };
    } catch (err) {
      return {
        id: "react-perf",
        category: this.category,
        name: "React Performance",
        score: 0,
        status: "fail",
        issues: [
          {
            severity: "critical",
            message: `React perf check failed: ${err}`,
            reportedBy: ["react-perf"],
          },
        ],
        toolsUsed: ["react-perf"],
        duration: elapsed(),
      };
    }
  }
}

interface FileInfo {
  path: string;
  fullPath: string;
  lines: number;
}

function scanDirectory(dir: string, projectRoot: string): FileInfo[] {
  const files: FileInfo[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (
        entry.startsWith(".") ||
        entry === "node_modules" ||
        entry === "__tests__" ||
        entry === "__mocks__" ||
        entry.includes(".test.") ||
        entry.includes(".spec.")
      )
        continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...scanDirectory(fullPath, projectRoot));
      } else if (COMPONENT_EXTENSIONS.has(extname(entry))) {
        try {
          const content = readFileSync(fullPath, "utf-8");
          const lineCount = content.split("\n").length;
          files.push({
            path: fullPath.replace(projectRoot + "/", ""),
            fullPath,
            lines: lineCount,
          });
        } catch {
          /* skip unreadable */
        }
      }
    }
  } catch {
    /* directory doesn't exist */
  }
  return files;
}

function analyzeFile(
  relPath: string,
  fullPath: string,
  lineCount: number,
): Finding[] {
  const findings: Finding[] = [];

  try {
    const content = readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");

    // Check for large component files
    if (lineCount > WARN_LINES) {
      findings.push({
        file: relPath,
        line: 0,
        pattern: `Large component file (${lineCount} lines) — consider splitting`,
        severity: "info",
      });
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comments
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*")
      )
        continue;

      // Inline object in JSX props: style={{ }}, prop={{ }}
      // Match patterns like propName={{ but exclude spread {...props}
      if (/\w+=\{\{/.test(line) && !trimmed.startsWith("//")) {
        // Exclude className={{ which is typically clsx/classnames
        if (!/className=\{\{/.test(line)) {
          findings.push({
            file: relPath,
            line: i + 1,
            pattern:
              "Inline object in JSX prop — creates new reference every render",
            severity: "warning",
          });
        }
      }

      // Index as key in lists: key={index} or key={i}
      if (
        /\.map\s*\(/.test(line) ||
        (i > 0 && /\.map\s*\(/.test(lines[i - 1]))
      ) {
        if (/key=\{(?:index|i|idx)\}/.test(line)) {
          findings.push({
            file: relPath,
            line: i + 1,
            pattern:
              "Using index as key in list — can cause rendering issues with dynamic lists",
            severity: "warning",
          });
        }
      }
    }

    // Check for route-level lazy loading opportunities
    checkLazyRoutes(content, relPath, findings);
  } catch {
    /* skip unreadable */
  }

  return findings;
}

function checkLazyRoutes(
  content: string,
  relPath: string,
  findings: Finding[],
): void {
  // Only check files that contain Route definitions
  if (!content.includes("<Route") && !content.includes("createBrowserRouter"))
    return;

  // Check if there are static imports of page/view components without React.lazy
  const hasLazy = content.includes("React.lazy") || content.includes("lazy(");
  const importLines = content
    .split("\n")
    .filter((l) => l.startsWith("import ") && !l.includes("react-router"));

  // If the file has routes but no lazy imports and more than 3 component imports, suggest lazy loading
  if (!hasLazy && importLines.length > 3) {
    findings.push({
      file: relPath,
      line: 0,
      pattern:
        "Route file with static imports — consider React.lazy() for code splitting",
      severity: "info",
    });
  }
}

function getFixDescription(pattern: string): string {
  if (pattern.includes("Inline object")) {
    return "Extract the object to a constant outside the component or use useMemo()";
  }
  if (pattern.includes("index as key")) {
    return "Use a unique identifier (id, slug, etc.) as the key instead of the array index";
  }
  if (pattern.includes("Large component")) {
    return "Break into smaller, focused components to improve readability and render performance";
  }
  if (pattern.includes("lazy")) {
    return "Use React.lazy() and Suspense for route-level code splitting";
  }
  return "Review and optimize for better rendering performance";
}
