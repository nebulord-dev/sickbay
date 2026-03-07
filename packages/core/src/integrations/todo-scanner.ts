import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, extname } from "path";
import { BaseRunner } from "./base.js";
import { timer } from "../utils/file-helpers.js";
import type { CheckResult, Issue } from "../types.js";

/**
 * This module analyzes the project's source code for TODO, FIXME, and HACK comments that indicate technical debt or areas needing attention.
 * It scans through source files in the project, identifying and categorizing these comments based on their type and content.
 * The runner provides actionable feedback on each finding, helping developers prioritize and address technical debt effectively.
 * It calculates an overall score based on the number and severity of findings, giving insights into the project's code quality and maintenance health.
 */

const TODO_PATTERN = /\b(TODO|FIXME|HACK)\b[:\s]*(.*)/i;
// Matches single-quoted, double-quoted, and single-line template literal strings
const STRING_LITERAL_RE = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;

function stripStringLiterals(line: string): string {
  return line.replace(STRING_LITERAL_RE, (m) => " ".repeat(m.length));
}
const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
]);

interface TodoItem {
  file: string;
  line: number;
  kind: string;
  text: string;
}

export class TodoScannerRunner extends BaseRunner {
  name = "todo-scanner";
  category = "code-quality" as const;

  async isApplicable(projectPath: string): Promise<boolean> {
    return existsSync(join(projectPath, "src"));
  }

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const todos = scanDirectory(join(projectPath, "src"), projectPath);

      const issues: Issue[] = todos.map((t) => ({
        severity: (t.kind === "FIXME" || t.kind === "HACK"
          ? "warning"
          : "info") as Issue["severity"],
        message: `${t.file}:${t.line} — ${t.kind}: ${t.text || "(no description)"}`,
        reportedBy: ["todo-scanner"],
      }));

      const fixmeCount = todos.filter(
        (t) => t.kind === "FIXME" || t.kind === "HACK",
      ).length;
      const score = Math.max(50, 100 - todos.length * 3);

      return {
        id: "todo-scanner",
        category: this.category,
        name: "Technical Debt",
        score,
        status:
          todos.length === 0
            ? "pass"
            : fixmeCount > 5 || todos.length > 20
              ? "warning"
              : "pass",
        issues,
        toolsUsed: ["todo-scanner"],
        duration: elapsed(),
        metadata: {
          total: todos.length,
          todo: todos.filter((t) => t.kind === "TODO").length,
          fixme: fixmeCount,
          hack: todos.filter((t) => t.kind === "HACK").length,
        },
      };
    } catch (err) {
      return {
        id: "todo-scanner",
        category: this.category,
        name: "Technical Debt",
        score: 0,
        status: "fail",
        issues: [
          {
            severity: "critical",
            message: `Todo scan failed: ${err}`,
            reportedBy: ["todo-scanner"],
          },
        ],
        toolsUsed: ["todo-scanner"],
        duration: elapsed(),
      };
    }
  }
}

function scanDirectory(dir: string, projectRoot: string): TodoItem[] {
  const todos: TodoItem[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".") || entry === "node_modules") continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        todos.push(...scanDirectory(fullPath, projectRoot));
      } else if (SOURCE_EXTENSIONS.has(extname(entry))) {
        todos.push(...scanFile(fullPath, projectRoot));
      }
    }
  } catch {
    // directory doesn't exist or can't be read
  }
  return todos;
}

function scanFile(filePath: string, projectRoot: string): TodoItem[] {
  const todos: TodoItem[] = [];
  try {
    const lines = readFileSync(filePath, "utf-8").split("\n");
    const relPath = filePath.replace(projectRoot + "/", "");
    for (let i = 0; i < lines.length; i++) {
      const match = stripStringLiterals(lines[i]).match(TODO_PATTERN);
      if (match) {
        todos.push({
          file: relPath,
          line: i + 1,
          kind: match[1].toUpperCase(),
          text: match[2].trim().slice(0, 100),
        });
      }
    }
  } catch {
    // can't read file
  }
  return todos;
}
