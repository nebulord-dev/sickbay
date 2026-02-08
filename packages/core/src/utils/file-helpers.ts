import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execa } from 'execa';

// Root of the @vitals/core package — used as localDir so execa resolves
// bundled tool binaries from our own node_modules/.bin, not the target project's.
export const coreLocalDir = dirname(dirname(fileURLToPath(import.meta.url)));

export function readPackageJson(projectPath: string): Record<string, unknown> {
  const pkgPath = join(projectPath, 'package.json');
  return JSON.parse(readFileSync(pkgPath, 'utf-8'));
}

export async function isCommandAvailable(cmd: string): Promise<boolean> {
  // Check local node_modules/.bin first (bundled deps)
  if (existsSync(join(coreLocalDir, 'node_modules', '.bin', cmd))) return true;
  // Fall back to PATH
  try {
    await execa('which', [cmd]);
    return true;
  } catch {
    return false;
  }
}

export function fileExists(projectPath: string, ...parts: string[]): boolean {
  return existsSync(join(projectPath, ...parts));
}

export function timer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
