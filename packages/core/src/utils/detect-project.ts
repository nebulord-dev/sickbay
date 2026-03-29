import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import type { ProjectInfo, ProjectContext, Framework, Runtime, BuildTool, TestFramework } from "../types.js";

/**
 * detectProject analyzes the given project directory to extract key information about the project setup.
 * It reads the package.json file to determine the project's name, version, dependencies, and devDependencies.
 * The function checks for the presence of TypeScript configuration and ESLint/Prettier configurations to infer if those tools are being used.
 * It also detects the framework used (e.g., Next.js, Vite, Create React App) based on dependencies and configuration files.
 * Finally, it identifies the package manager in use by checking for lock files (pnpm-lock.yaml, yarn.lock).
 * This information is crucial for tailoring checks and recommendations specific to the project's technology stack and tooling.
 */

export async function detectProject(projectPath: string): Promise<ProjectInfo> {
  const pkgPath = join(projectPath, "package.json");
  if (!existsSync(pkgPath)) {
    throw new Error(`No package.json found at ${projectPath}`);
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const deps: Record<string, string> = pkg.dependencies ?? {};
  const devDeps: Record<string, string> = pkg.devDependencies ?? {};

  // Resolve pnpm catalog: references to actual versions
  const catalog = loadPnpmCatalog(projectPath);
  if (catalog) {
    for (const [name, ver] of Object.entries(deps)) {
      if (ver.startsWith("catalog:")) deps[name] = catalog[name] ?? ver;
    }
    for (const [name, ver] of Object.entries(devDeps)) {
      if (ver.startsWith("catalog:")) devDeps[name] = catalog[name] ?? ver;
    }
  }

  const allDeps = { ...deps, ...devDeps };

  const rawOverrides: Record<string, string> | undefined =
    pkg.pnpm?.overrides ?? pkg.overrides ?? pkg.resolutions ?? undefined;
  const overrides = rawOverrides && Object.keys(rawOverrides).length > 0
    ? rawOverrides
    : undefined;

  return {
    name: pkg.name ?? "unknown",
    version: pkg.version ?? "0.0.0",
    hasTypeScript:
      existsSync(join(projectPath, "tsconfig.json")) || "typescript" in allDeps,
    hasESLint:
      existsSync(join(projectPath, ".eslintrc.js")) ||
      existsSync(join(projectPath, ".eslintrc.json")) ||
      existsSync(join(projectPath, "eslint.config.js")) ||
      "eslint" in allDeps,
    hasPrettier:
      existsSync(join(projectPath, ".prettierrc")) ||
      existsSync(join(projectPath, ".prettierrc.json")) ||
      "prettier" in allDeps,
    framework: detectFramework(allDeps),
    packageManager: detectPackageManager(projectPath),
    totalDependencies: Object.keys(allDeps).length,
    dependencies: deps,
    devDependencies: devDeps,
    overrides,
  };
}

function detectFramework(
  deps: Record<string, string>,
): ProjectInfo["framework"] {
  if ("next" in deps) return "next";
  if ("@vitejs/plugin-react" in deps || "vite" in deps) return "vite";
  if ("react-scripts" in deps) return "cra";
  if ("react" in deps) return "react";
  if ("express" in deps) return "express";
  if ("fastify" in deps) return "fastify";
  if ("koa" in deps) return "koa";
  if ("hono" in deps) return "hono";
  if ("@hapi/hapi" in deps || "hapi" in deps) return "hapi";
  return "node";
}

export function detectPackageManager(
  projectPath: string,
): ProjectInfo["packageManager"] {
  let dir = projectPath;
  while (true) {
    if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
    if (existsSync(join(dir, "yarn.lock"))) return "yarn";
    if (existsSync(join(dir, "bun.lockb")) || existsSync(join(dir, "bun.lock"))) return "bun";
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return "npm";
}

export async function detectContext(projectPath: string): Promise<ProjectContext> {
  const pkgPath = join(projectPath, "package.json");
  if (!existsSync(pkgPath)) {
    return { runtime: "unknown", frameworks: [], buildTool: "unknown", testFramework: null };
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const deps: Record<string, string> = pkg.dependencies ?? {};
  const devDeps: Record<string, string> = pkg.devDependencies ?? {};
  const allDeps = { ...deps, ...devDeps };

  const frameworks: Framework[] = [];
  if ("@angular/core" in allDeps) frameworks.push("angular");
  if ("next" in allDeps) {
    frameworks.push("react", "next");
  } else if ("@remix-run/react" in allDeps) {
    frameworks.push("react", "remix");
  } else if ("react" in allDeps) {
    frameworks.push("react");
  }
  if ("vue" in allDeps) frameworks.push("vue");
  if ("svelte" in allDeps) frameworks.push("svelte");

  // Projects with no recognised UI framework are assumed to be Node. Projects without
  // a package.json return runtime: 'unknown', which causes all runtime-scoped runners
  // (node-*, react-perf, etc.) to be silently skipped via isApplicableToContext().
  const runtime: Runtime = frameworks.length === 0 ? "node" : "browser";

  let buildTool: BuildTool = "unknown";
  if ("vite" in allDeps || "@vitejs/plugin-react" in allDeps) buildTool = "vite";
  else if ("webpack" in allDeps) buildTool = "webpack";
  else if ("esbuild" in allDeps) buildTool = "esbuild";
  else if ("rollup" in allDeps) buildTool = "rollup";
  else if ("next" in allDeps) buildTool = "webpack";
  else if ("typescript" in allDeps) buildTool = "tsc";

  let testFramework: TestFramework = null;
  if ("vitest" in allDeps) testFramework = "vitest";
  else if ("jest" in allDeps) testFramework = "jest";
  else if ("mocha" in allDeps) testFramework = "mocha";

  return { runtime, frameworks, buildTool, testFramework };
}

/**
 * Walk up from projectPath to find pnpm-workspace.yaml and parse its catalog section.
 * Returns a map of package name → version, or null if no catalog is found.
 */
function loadPnpmCatalog(projectPath: string): Record<string, string> | null {
  let dir = projectPath;
  while (true) {
    const wsPath = join(dir, "pnpm-workspace.yaml");
    if (existsSync(wsPath)) {
      try {
        const content = readFileSync(wsPath, "utf-8");
        return parseCatalogFromYaml(content);
      } catch {
        return null;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Minimal YAML parser for the catalog: section of pnpm-workspace.yaml.
 * Avoids adding a YAML parsing dependency — the catalog format is simple
 * key-value pairs under a `catalog:` heading.
 */
function parseCatalogFromYaml(content: string): Record<string, string> | null {
  const lines = content.split("\n");
  const catalog: Record<string, string> = {};
  let inCatalog = false;

  for (const line of lines) {
    // Detect `catalog:` top-level key
    if (/^catalog:\s*$/.test(line)) {
      inCatalog = true;
      continue;
    }
    // End of catalog section when we hit another top-level key
    if (inCatalog && /^\S/.test(line)) {
      break;
    }
    if (inCatalog) {
      // Parse indented entries like "  '@types/react': ^19.2.14"
      const match = line.match(/^\s+['"]?([^'":\s][^'":]*?)['"]?\s*:\s*(.+)$/);
      if (match) {
        catalog[match[1].trim()] = match[2].trim();
      }
    }
  }

  return Object.keys(catalog).length > 0 ? catalog : null;
}
