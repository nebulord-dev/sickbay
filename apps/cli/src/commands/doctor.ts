import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { detectProject, detectPackageManager } from "@sickbay/core";

/**
 * This module defines a set of diagnostic checks that can be run against a JavaScript/TypeScript project to identify common issues and best practice violations. Each check returns a DiagnosticResult indicating whether the check passed, failed, or has warnings, along with messages and potential fixes. The runDiagnostics function executes all checks and aggregates their results for reporting.
 */

export interface DiagnosticResult {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn";
  message: string;
  fixCommand?: string;
  fixDescription?: string;
}

type DiagnosticCheck = (projectPath: string) => Promise<DiagnosticResult>;

async function checkGitignore(projectPath: string): Promise<DiagnosticResult> {
  const gitignorePath = join(projectPath, ".gitignore");
  if (!existsSync(gitignorePath)) {
    return {
      id: "gitignore",
      label: ".gitignore exists",
      status: "fail",
      message: "No .gitignore found",
      fixDescription: "Create .gitignore with standard entries",
    };
  }
  const content = readFileSync(gitignorePath, "utf-8");
  const lines = content.split("\n").map((l) => l.trim());
  const required = ["node_modules", ".env", "dist", ".DS_Store"];
  const missing = required.filter((entry) => !lines.includes(entry));
  if (missing.length > 0) {
    return {
      id: "gitignore",
      label: ".gitignore entries",
      status: "warn",
      message: `Missing entries: ${missing.join(", ")}`,
      fixDescription: `Add ${missing.join(", ")} to .gitignore`,
    };
  }
  return {
    id: "gitignore",
    label: ".gitignore entries",
    status: "pass",
    message: "All standard entries present",
  };
}

async function checkEnginesField(
  projectPath: string,
): Promise<DiagnosticResult> {
  const pkg = JSON.parse(
    readFileSync(join(projectPath, "package.json"), "utf-8"),
  );
  if (!pkg.engines) {
    return {
      id: "engines",
      label: "package.json engines field",
      status: "warn",
      message: "No engines field — Node.js version not specified",
      fixDescription: 'Add "engines": { "node": ">=18.0.0" } to package.json',
    };
  }
  return {
    id: "engines",
    label: "package.json engines field",
    status: "pass",
    message: `node ${pkg.engines.node ?? "unspecified"}`,
  };
}

async function checkBrowserslist(
  projectPath: string,
): Promise<DiagnosticResult> {
  const pkg = JSON.parse(
    readFileSync(join(projectPath, "package.json"), "utf-8"),
  );
  const hasFile =
    existsSync(join(projectPath, ".browserslistrc")) ||
    existsSync(join(projectPath, "browserslist"));
  const hasField = !!pkg.browserslist;
  if (!hasFile && !hasField) {
    return {
      id: "browserslist",
      label: "Browserslist config",
      status: "warn",
      message: "No browserslist config — browser targets not defined",
      fixDescription: "Create .browserslistrc with default targets",
    };
  }
  return {
    id: "browserslist",
    label: "Browserslist config",
    status: "pass",
    message: "Browserslist configured",
  };
}

async function checkNodeVersion(
  projectPath: string,
): Promise<DiagnosticResult> {
  const hasNvmrc = existsSync(join(projectPath, ".nvmrc"));
  const hasNodeVersion = existsSync(join(projectPath, ".node-version"));
  const hasToolVersions = existsSync(join(projectPath, ".tool-versions"));
  if (!hasNvmrc && !hasNodeVersion && !hasToolVersions) {
    return {
      id: "node-version",
      label: "Node version pinning",
      status: "warn",
      message: "No .nvmrc or .node-version — Node version not pinned",
      fixDescription: "Create .nvmrc with current Node version",
    };
  }
  return {
    id: "node-version",
    label: "Node version pinning",
    status: "pass",
    message: hasNvmrc
      ? ".nvmrc found"
      : hasNodeVersion
        ? ".node-version found"
        : ".tool-versions found",
  };
}

async function checkNpmScripts(projectPath: string): Promise<DiagnosticResult> {
  const pkg = JSON.parse(
    readFileSync(join(projectPath, "package.json"), "utf-8"),
  );
  const scripts = pkg.scripts ?? {};
  const expected = ["lint", "test", "build"];
  const missing = expected.filter((s) => !scripts[s]);
  if (missing.length > 0) {
    return {
      id: "npm-scripts",
      label: "Essential npm scripts",
      status:
        missing.includes("build") || missing.includes("test") ? "fail" : "warn",
      message: `Missing scripts: ${missing.join(", ")}`,
      fixDescription: `Add ${missing.join(", ")} scripts to package.json`,
    };
  }
  return {
    id: "npm-scripts",
    label: "Essential npm scripts",
    status: "pass",
    message: "lint, test, build all defined",
  };
}

async function checkLockfile(projectPath: string): Promise<DiagnosticResult> {
  const hasNpmLock = existsSync(join(projectPath, "package-lock.json"));
  const hasPnpmLock = existsSync(join(projectPath, "pnpm-lock.yaml"));
  const hasYarnLock = existsSync(join(projectPath, "yarn.lock"));
  const hasBunLock =
    existsSync(join(projectPath, "bun.lockb")) ||
    existsSync(join(projectPath, "bun.lock"));
  if (!hasNpmLock && !hasPnpmLock && !hasYarnLock && !hasBunLock) {
    return {
      id: "lockfile",
      label: "Lockfile present",
      status: "fail",
      message: "No lockfile found — dependencies not pinned",
      fixCommand: "npm install",
      fixDescription: "Generate lockfile with npm install",
    };
  }
  const lockfileNames: Record<string, string> = {
    pnpm: "pnpm-lock.yaml",
    yarn: "yarn.lock",
    bun: "bun.lockb",
    npm: "package-lock.json",
  };
  return {
    id: "lockfile",
    label: "Lockfile present",
    status: "pass",
    message: lockfileNames[detectPackageManager(projectPath)],
  };
}

async function checkEditorconfig(
  projectPath: string,
): Promise<DiagnosticResult> {
  if (!existsSync(join(projectPath, ".editorconfig"))) {
    return {
      id: "editorconfig",
      label: ".editorconfig",
      status: "warn",
      message: "No .editorconfig — editor settings not standardized",
      fixDescription: "Create .editorconfig with standard settings",
    };
  }
  return {
    id: "editorconfig",
    label: ".editorconfig",
    status: "pass",
    message: ".editorconfig found",
  };
}

async function checkPrettier(projectPath: string): Promise<DiagnosticResult> {
  const info = await detectProject(projectPath);
  if (!info.hasPrettier) {
    return {
      id: "prettier",
      label: "Prettier config",
      status: "warn",
      message: "No Prettier configured — code formatting not standardized",
      fixCommand: "npm install -D prettier",
      fixDescription: "Install prettier and create .prettierrc",
    };
  }
  return {
    id: "prettier",
    label: "Prettier config",
    status: "pass",
    message: "Prettier configured",
  };
}

async function checkESLintConfig(
  projectPath: string,
): Promise<DiagnosticResult> {
  const info = await detectProject(projectPath);
  if (!info.hasESLint) {
    return {
      id: "eslint-config",
      label: "ESLint config",
      status: "fail",
      message: "No ESLint configured — no lint rules enforced",
      fixCommand: "npm init @eslint/config",
      fixDescription: "Initialize ESLint configuration",
    };
  }
  return {
    id: "eslint-config",
    label: "ESLint config",
    status: "pass",
    message: "ESLint configured",
  };
}

async function checkTsconfig(projectPath: string): Promise<DiagnosticResult> {
  const info = await detectProject(projectPath);
  const hasTsconfig = existsSync(join(projectPath, "tsconfig.json"));
  if (info.hasTypeScript && !hasTsconfig) {
    return {
      id: "tsconfig",
      label: "TypeScript config",
      status: "fail",
      message: "TypeScript deps found but no tsconfig.json",
      fixCommand: "npx tsc --init",
      fixDescription: "Generate tsconfig.json",
    };
  }
  if (!info.hasTypeScript) {
    return {
      id: "tsconfig",
      label: "TypeScript",
      status: "warn",
      message: "TypeScript not in use (consider adopting)",
    };
  }
  return {
    id: "tsconfig",
    label: "TypeScript config",
    status: "pass",
    message: "tsconfig.json found",
  };
}

async function checkEnvExample(projectPath: string): Promise<DiagnosticResult> {
  const hasEnv = existsSync(join(projectPath, ".env"));
  const hasExample =
    existsSync(join(projectPath, ".env.example")) ||
    existsSync(join(projectPath, ".env.template")) ||
    existsSync(join(projectPath, ".env.sample"));
  if (hasEnv && !hasExample) {
    return {
      id: "env-example",
      label: ".env.example",
      status: "warn",
      message:
        ".env exists but no .env.example — team members won't know required vars",
      fixDescription: "Create .env.example with variable names (no values)",
    };
  }
  if (!hasEnv) {
    return {
      id: "env-example",
      label: ".env.example",
      status: "pass",
      message: "No .env file (not applicable)",
    };
  }
  return {
    id: "env-example",
    label: ".env.example",
    status: "pass",
    message: ".env.example exists",
  };
}

async function checkReactVersions(
  projectPath: string,
): Promise<DiagnosticResult> {
  const pkg = JSON.parse(
    readFileSync(join(projectPath, "package.json"), "utf-8"),
  );
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const react = deps["react"];
  const reactDom = deps["react-dom"];

  if (!react) {
    return {
      id: "react-versions",
      label: "React version consistency",
      status: "pass",
      message: "Not a React project",
    };
  }
  if (!reactDom) {
    return {
      id: "react-versions",
      label: "React version consistency",
      status: "warn",
      message: "react installed but react-dom missing",
      fixCommand: `npm install react-dom@${react}`,
      fixDescription: "Install react-dom matching react version",
    };
  }
  if (react !== reactDom) {
    return {
      id: "react-versions",
      label: "React version consistency",
      status: "fail",
      message: `react@${react} and react-dom@${reactDom} version mismatch`,
      fixCommand: `npm install react-dom@${react}`,
      fixDescription: "Align react-dom version with react",
    };
  }
  return {
    id: "react-versions",
    label: "React version consistency",
    status: "pass",
    message: `react and react-dom both at ${react}`,
  };
}

const ALL_DIAGNOSTICS: DiagnosticCheck[] = [
  checkGitignore,
  checkEnginesField,
  checkBrowserslist,
  checkNodeVersion,
  checkNpmScripts,
  checkLockfile,
  checkEditorconfig,
  checkPrettier,
  checkESLintConfig,
  checkTsconfig,
  checkEnvExample,
  checkReactVersions,
];

export async function runDiagnostics(
  projectPath: string,
): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  for (const check of ALL_DIAGNOSTICS) {
    try {
      results.push(await check(projectPath));
    } catch (err) {
      results.push({
        id: "unknown",
        label: "Unknown check",
        status: "fail",
        message: `Check failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  return results;
}
