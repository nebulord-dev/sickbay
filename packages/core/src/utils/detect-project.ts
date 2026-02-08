import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { ProjectInfo } from '../types.js';

export async function detectProject(projectPath: string): Promise<ProjectInfo> {
  const pkgPath = join(projectPath, 'package.json');
  if (!existsSync(pkgPath)) {
    throw new Error(`No package.json found at ${projectPath}`);
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const deps: Record<string, string> = pkg.dependencies ?? {};
  const devDeps: Record<string, string> = pkg.devDependencies ?? {};
  const allDeps = { ...deps, ...devDeps };

  return {
    name: pkg.name ?? 'unknown',
    version: pkg.version ?? '0.0.0',
    hasTypeScript: existsSync(join(projectPath, 'tsconfig.json')) || 'typescript' in allDeps,
    hasESLint:
      existsSync(join(projectPath, '.eslintrc.js')) ||
      existsSync(join(projectPath, '.eslintrc.json')) ||
      existsSync(join(projectPath, 'eslint.config.js')) ||
      'eslint' in allDeps,
    hasPrettier:
      existsSync(join(projectPath, '.prettierrc')) ||
      existsSync(join(projectPath, '.prettierrc.json')) ||
      'prettier' in allDeps,
    framework: detectFramework(allDeps),
    packageManager: detectPackageManager(projectPath),
    totalDependencies: Object.keys(allDeps).length,
    dependencies: deps,
    devDependencies: devDeps,
  };
}

function detectFramework(deps: Record<string, string>): ProjectInfo['framework'] {
  if ('next' in deps) return 'next';
  if ('@vitejs/plugin-react' in deps || 'vite' in deps) return 'vite';
  if ('react-scripts' in deps) return 'cra';
  if ('react' in deps) return 'react';
  return 'unknown';
}

function detectPackageManager(projectPath: string): ProjectInfo['packageManager'] {
  if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(projectPath, 'yarn.lock'))) return 'yarn';
  return 'npm';
}
