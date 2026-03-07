import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { globby } from 'globby';
import type { MonorepoInfo, ProjectInfo } from '../types.js';
import { detectPackageManager } from './detect-project.js';

type NotMonorepo = { isMonorepo: false };

/**
 * Parse a minimal subset of YAML: an array under a given key.
 * Handles only the simple `packages:` block used in pnpm-workspace.yaml and lerna.json.
 */
function parseYamlPackagesArray(content: string): string[] {
  const results: string[] = [];
  const lines = content.split('\n');
  let inPackages = false;
  for (const line of lines) {
    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      const match = /^\s+-\s+['"]?([^'"#\n]+?)['"]?\s*$/.exec(line);
      if (match) {
        results.push(match[1].trim());
      } else if (/^\S/.test(line)) {
        // New top-level key — done
        break;
      }
    }
  }
  return results;
}

/**
 * Expand glob patterns relative to rootPath, filter to directories that
 * contain a package.json, and return absolute paths excluding the root itself.
 */
async function discoverPackages(rootPath: string, patterns: string[]): Promise<string[]> {
  if (patterns.length === 0) return [];

  const matched = await globby(patterns, {
    cwd: rootPath,
    onlyDirectories: true,
    expandDirectories: false,
    absolute: true,
    ignore: ['**/node_modules/**'],
  });

  return matched.filter((dir) => {
    // Must have its own package.json and not be the root itself
    return dir !== resolve(rootPath) && existsSync(join(dir, 'package.json'));
  });
}

/**
 * Determine monorepo type and package glob patterns from the root.
 * Returns null if no monorepo signals are found.
 */
function detectSignals(
  rootPath: string,
): { type: MonorepoInfo['type']; patterns: string[] } | null {
  // 1. pnpm-workspace.yaml
  const pnpmWs = join(rootPath, 'pnpm-workspace.yaml');
  if (existsSync(pnpmWs)) {
    try {
      const content = readFileSync(pnpmWs, 'utf-8');
      const patterns = parseYamlPackagesArray(content);
      return { type: 'pnpm', patterns: patterns.length > 0 ? patterns : ['packages/*', 'apps/*'] };
    } catch {
      return { type: 'pnpm', patterns: ['packages/*', 'apps/*'] };
    }
  }

  // 2. lerna.json
  const lernaJson = join(rootPath, 'lerna.json');
  if (existsSync(lernaJson)) {
    try {
      const lerna = JSON.parse(readFileSync(lernaJson, 'utf-8'));
      const patterns: string[] = Array.isArray(lerna.packages) ? lerna.packages : ['packages/*'];
      return { type: 'lerna', patterns };
    } catch {
      return { type: 'lerna', patterns: ['packages/*'] };
    }
  }

  // 3. package.json workspaces (npm/yarn)
  const pkgJson = join(rootPath, 'package.json');
  if (existsSync(pkgJson)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJson, 'utf-8'));
      const workspaces: string[] | undefined =
        Array.isArray(pkg.workspaces)
          ? pkg.workspaces
          : Array.isArray(pkg.workspaces?.packages)
          ? pkg.workspaces.packages
          : undefined;

      if (workspaces && workspaces.length > 0) {
        // Determine if it's turbo, nx, or plain npm/yarn
        if (existsSync(join(rootPath, 'turbo.json'))) {
          return { type: 'turbo', patterns: workspaces };
        }
        if (existsSync(join(rootPath, 'nx.json'))) {
          return { type: 'nx', patterns: workspaces };
        }
        const hasYarn = existsSync(join(rootPath, 'yarn.lock'));
        return { type: hasYarn ? 'yarn' : 'npm', patterns: workspaces };
      }
    } catch {
      // fall through
    }
  }

  // 4. turbo.json or nx.json without package.json workspaces — still a monorepo signal
  if (existsSync(join(rootPath, 'turbo.json'))) {
    return { type: 'turbo', patterns: ['packages/*', 'apps/*'] };
  }
  if (existsSync(join(rootPath, 'nx.json'))) {
    return { type: 'nx', patterns: ['packages/*', 'apps/*', 'libs/*'] };
  }

  return null;
}

export async function detectMonorepo(rootPath: string): Promise<MonorepoInfo | NotMonorepo> {
  const signals = detectSignals(rootPath);
  if (!signals) return { isMonorepo: false };

  const packagePaths = await discoverPackages(rootPath, signals.patterns);
  if (packagePaths.length === 0) return { isMonorepo: false };

  const packageManager: ProjectInfo['packageManager'] = detectPackageManager(rootPath);

  return {
    isMonorepo: true,
    type: signals.type,
    packageManager,
    packagePaths,
  };
}
