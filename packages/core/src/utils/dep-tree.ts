import { execa } from 'execa';
import type { ProjectInfo } from '../types.js';

export interface DependencyTreeNode {
  name: string;
  version: string;
  dependencies?: Record<string, DependencyTreeNode>;
}

export interface DependencyTree {
  name: string;
  version: string;
  packageManager: string;
  dependencies: Record<string, DependencyTreeNode>;
}

export interface MonorepoDependencyTree {
  packages: Record<string, DependencyTree>;
}

function normalizeDeps(
  raw: Record<string, any> | undefined,
): Record<string, DependencyTreeNode> {
  if (!raw) return {};
  const result: Record<string, DependencyTreeNode> = {};
  for (const [name, info] of Object.entries(raw)) {
    result[name] = {
      name,
      version: info.version ?? 'unknown',
      ...(info.dependencies && Object.keys(info.dependencies).length > 0
        ? { dependencies: normalizeDeps(info.dependencies) }
        : {}),
    };
  }
  return result;
}

export async function getDependencyTree(
  projectPath: string,
  packageManager: ProjectInfo['packageManager'],
): Promise<DependencyTree> {
  const empty: DependencyTree = {
    name: '',
    version: '',
    packageManager,
    dependencies: {},
  };

  // bun doesn't support ls --json in a parseable way
  if (packageManager === 'bun') return empty;

  try {
    const args =
      packageManager === 'yarn'
        ? ['list', '--json', '--depth', '1']
        : ['ls', '--json', '--depth', '1'];

    const { stdout } = await execa(packageManager, args, {
      cwd: projectPath,
      reject: false,
      timeout: 30_000,
    });

    const parsed = JSON.parse(stdout);

    // pnpm returns an array, npm/yarn return an object
    const root = Array.isArray(parsed) ? parsed[0] : parsed;

    return {
      name: root.name ?? '',
      version: root.version ?? '',
      packageManager,
      dependencies: normalizeDeps(root.dependencies),
    };
  } catch {
    return empty;
  }
}
