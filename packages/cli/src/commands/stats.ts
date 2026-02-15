import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, extname } from "path";
import { execSync } from "child_process";
import { detectProject } from "@vitals/core";
import type { ProjectInfo } from "@vitals/core";

/**
 * This module provides a function to gather various statistics about a project, including file counts, line counts, component types, dependencies, and git information.
 * The gatherStats function walks through the project directory, collects data on source files, counts lines of code, identifies React components, and retrieves git metadata if available.
 * The resulting ProjectStats object gives a comprehensive overview of the project's structure and health, which can be used for reporting or further analysis.
 */

export interface ProjectStats {
  project: ProjectInfo;
  files: {
    total: number;
    byExtension: Record<string, number>;
  };
  lines: {
    total: number;
    avgPerFile: number;
  };
  components: {
    total: number;
    functional: number;
    classBased: number;
  };
  dependencies: {
    prod: number;
    dev: number;
    total: number;
  };
  git: {
    commits: number;
    contributors: number;
    age: string;
    branch: string;
  } | null;
  testFiles: number;
  sourceSize: string;
}

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".turbo",
  ".cache",
  ".vite",
  "__pycache__",
  ".svelte-kit",
]);

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".less",
  ".sass",
  ".json",
  ".html",
  ".svg",
  ".vue",
  ".svelte",
]);

function walkDir(
  dir: string,
  extensions: Set<string>,
): { path: string; ext: string }[] {
  const results: { path: string; ext: string }[] = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.isDirectory()) continue;
      if (IGNORE_DIRS.has(entry.name)) continue;

      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkDir(fullPath, extensions));
      } else {
        const ext = extname(entry.name).toLowerCase();
        if (extensions.has(ext)) {
          results.push({ path: fullPath, ext });
        }
      }
    }
  } catch {
    // Permission errors, etc.
  }

  return results;
}

function countLines(filePath: string): number {
  try {
    const content = readFileSync(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

function countComponents(filePath: string): {
  functional: number;
  classBased: number;
} {
  try {
    const content = readFileSync(filePath, "utf-8");
    const functional =
      (
        content.match(
          /(?:export\s+)?(?:default\s+)?function\s+[A-Z]\w*\s*\(/g,
        ) ?? []
      ).length +
      (
        content.match(
          /(?:export\s+)?(?:default\s+)?const\s+[A-Z]\w*\s*[=:]\s*(?:\(|React\.)/g,
        ) ?? []
      ).length;
    const classBased = (
      content.match(
        /class\s+[A-Z]\w*\s+extends\s+(?:React\.)?(?:Component|PureComponent)/g,
      ) ?? []
    ).length;
    return { functional, classBased };
  } catch {
    return { functional: 0, classBased: 0 };
  }
}

function getGitInfo(projectPath: string): ProjectStats["git"] {
  try {
    if (!existsSync(join(projectPath, ".git"))) return null;

    const commits = parseInt(
      execSync("git rev-list --count HEAD", {
        cwd: projectPath,
        encoding: "utf-8",
      }).trim(),
      10,
    );

    const contributors = parseInt(
      execSync("git log --format='%ae' | sort -u | wc -l", {
        cwd: projectPath,
        encoding: "utf-8",
        shell: "/bin/sh",
      }).trim(),
      10,
    );

    const firstCommit = execSync("git log --reverse --format='%ar' | head -1", {
      cwd: projectPath,
      encoding: "utf-8",
      shell: "/bin/sh",
    }).trim();

    const branch = execSync("git branch --show-current", {
      cwd: projectPath,
      encoding: "utf-8",
    }).trim();

    return { commits, contributors, age: firstCommit, branch };
  } catch {
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function gatherStats(projectPath: string): Promise<ProjectStats> {
  const project = await detectProject(projectPath);

  const files = walkDir(projectPath, SOURCE_EXTENSIONS);
  const byExtension: Record<string, number> = {};
  for (const f of files) {
    byExtension[f.ext] = (byExtension[f.ext] ?? 0) + 1;
  }

  let totalLines = 0;
  let totalFunctional = 0;
  let totalClassBased = 0;
  let testFiles = 0;
  let totalBytes = 0;

  const componentExts = new Set([".tsx", ".jsx", ".js", ".ts"]);

  for (const f of files) {
    const lines = countLines(f.path);
    totalLines += lines;

    try {
      totalBytes += statSync(f.path).size;
    } catch {
      // ignore
    }

    if (componentExts.has(f.ext)) {
      const { functional, classBased } = countComponents(f.path);
      totalFunctional += functional;
      totalClassBased += classBased;
    }

    const name = f.path.toLowerCase();
    if (
      name.includes(".test.") ||
      name.includes(".spec.") ||
      name.includes("__tests__")
    ) {
      testFiles++;
    }
  }

  const git = getGitInfo(projectPath);

  return {
    project,
    files: {
      total: files.length,
      byExtension,
    },
    lines: {
      total: totalLines,
      avgPerFile: files.length > 0 ? Math.round(totalLines / files.length) : 0,
    },
    components: {
      total: totalFunctional + totalClassBased,
      functional: totalFunctional,
      classBased: totalClassBased,
    },
    dependencies: {
      prod: Object.keys(project.dependencies).length,
      dev: Object.keys(project.devDependencies).length,
      total: project.totalDependencies,
    },
    git,
    testFiles,
    sourceSize: formatBytes(totalBytes),
  };
}
