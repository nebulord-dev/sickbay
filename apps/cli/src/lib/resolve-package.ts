import { readFileSync } from "fs";
import { join } from "path";
import { detectMonorepo } from "@sickbay/core";
import type { MonorepoInfo } from "@sickbay/core";

export interface MonorepoResolution {
  isMonorepo: true;
  monorepoInfo: MonorepoInfo;
  targetPath?: string;
  packagePaths: string[];
  packageNames: Map<string, string>;
}

export interface SingleProjectResolution {
  isMonorepo: false;
  targetPath: string;
}

export type ProjectResolution = MonorepoResolution | SingleProjectResolution;

/**
 * Resolve a project path into either a single project or a monorepo with
 * optional --package scoping. Shared by the main scan and all subcommands.
 */
export async function resolveProject(
  projectPath: string,
  packageName?: string,
): Promise<ProjectResolution> {
  const monorepoInfo = await detectMonorepo(projectPath);

  if (!monorepoInfo.isMonorepo) {
    if (packageName) {
      process.stderr.write(
        `--package flag used but "${projectPath}" is not a monorepo\n`,
      );
      process.exit(1);
    }
    return { isMonorepo: false, targetPath: projectPath };
  }

  const packageNames = new Map<string, string>();
  for (const p of monorepoInfo.packagePaths) {
    try {
      const pkg = JSON.parse(readFileSync(join(p, "package.json"), "utf-8"));
      packageNames.set(p, pkg.name ?? p);
    } catch {
      packageNames.set(p, p);
    }
  }

  if (packageName) {
    const targetPath = monorepoInfo.packagePaths.find((p) => {
      const name = packageNames.get(p) ?? "";
      return name === packageName || name.endsWith(`/${packageName}`);
    });

    if (!targetPath) {
      process.stderr.write(
        `Package "${packageName}" not found in monorepo\n`,
      );
      process.exit(1);
    }

    return {
      isMonorepo: true,
      monorepoInfo,
      targetPath,
      packagePaths: monorepoInfo.packagePaths,
      packageNames,
    };
  }

  return {
    isMonorepo: true,
    monorepoInfo,
    packagePaths: monorepoInfo.packagePaths,
    packageNames,
  };
}

/** Get a short display name for a package (strip scope prefix). */
export function shortName(fullName: string): string {
  const slashIdx = fullName.lastIndexOf("/");
  return slashIdx >= 0 ? fullName.substring(slashIdx + 1) : fullName;
}
