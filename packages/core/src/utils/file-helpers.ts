import { existsSync, readFileSync } from 'fs';
import { dirname, join, relative, sep } from 'path';
import { fileURLToPath } from 'url';

import { execa } from 'execa';

import { WARN_LINES } from '../constants.js';

/**
 * This module provides utility functions for file operations, command availability checks, timing, and robust JSON parsing.
 * It includes functions to read package.json, check if a command is available in the environment, verify file existence, and measure elapsed time.
 * The parseJsonOutput function is designed to handle CLI outputs that may contain non-JSON text or ANSI color codes, extracting valid JSON content reliably.
 * These utilities are essential for the various runners and integrations in the @nebulord/sickbay-core package to perform their checks and analyses effectively.
 */

// Root of the @nebulord/sickbay-core package — used as localDir so execa resolves
// bundled tool binaries from our own node_modules/.bin, not the target project's.
export const coreLocalDir = dirname(dirname(fileURLToPath(import.meta.url)));

export function readPackageJson(projectPath: string): Record<string, unknown> {
  const pkgPath = join(projectPath, 'package.json');
  return JSON.parse(readFileSync(pkgPath, 'utf-8'));
}

export async function isCommandAvailable(cmd: string): Promise<boolean> {
  // Check local node_modules/.bin first (bundled deps). On Windows, pnpm
  // creates `.cmd` / `.exe` / `.ps1` wrappers in addition to (or instead
  // of) the bare-name shell wrapper. Checking only the bare name on Windows
  // would silently miss every bundled tool and force the PATH fallback.
  const binDir = join(coreLocalDir, 'node_modules', '.bin');
  const localCandidates =
    process.platform === 'win32' ? [cmd, `${cmd}.cmd`, `${cmd}.exe`, `${cmd}.ps1`] : [cmd];
  if (localCandidates.some((c) => existsSync(join(binDir, c)))) return true;

  // Fall back to PATH lookup. `which` is POSIX-only — Windows uses `where`.
  // Without this branch, every PATH-installed tool returns false on Windows
  // and any runner relying on isCommandAvailable to detect a user-installed
  // tool would skip its check entirely.
  const lookupCmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    await execa(lookupCmd, [cmd]);
    return true;
  } catch {
    return false;
  }
}

export function fileExists(projectPath: string, ...parts: string[]): boolean {
  return existsSync(join(projectPath, ...parts));
}

/**
 * Compute a project-relative path from an absolute path, with forward
 * slashes regardless of platform.
 *
 * Why this exists: every check runner that walks the filesystem builds
 * absolute paths with `path.join`, then needs to display/store/match a
 * project-relative version. The natural way to do that is `path.relative`,
 * but on Windows that returns paths with backslashes — which then break
 * suppression rules (users write forward-slash globs), JSON snapshots
 * (compared across platforms), and dashboard rendering.
 *
 * Historical bug: 19 sites across 16 integrations used
 * `fullPath.replace(projectRoot + '/', '')` instead, which silently
 * produced wrong output on Windows because the literal `/` in the
 * search string never matched the actual `\` separator. The result was
 * that every "relative" path was actually the original absolute path
 * unchanged, breaking suppression matching and dashboard display for
 * all Windows users. This helper replaces every one of those sites.
 */
export function relativeFromRoot(projectRoot: string, fullPath: string): string {
  // path.relative returns paths with the platform-native separator (`\` on
  // Windows). Splitting on `sep` and rejoining with `/` normalizes to
  // forward slashes regardless of OS. On POSIX this is a no-op (`sep`
  // is already `/`), so the runtime cost is negligible.
  return relative(projectRoot, fullPath).split(sep).join('/');
}

export { WARN_LINES };

export function timer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}

/**
 * Safely extract and parse JSON from mixed CLI output that may contain logs, ANSI codes, etc.
 * Handles cases where tools output "[Vite] Proxy..." or other text before/after JSON.
 */
export function parseJsonOutput(stdout: string, fallback: string = '{}'): unknown {
  if (!stdout || !stdout.trim()) {
    return JSON.parse(fallback);
  }

  // Strip ANSI color codes
  // eslint-disable-next-line no-control-regex
  const cleaned = stdout.replace(/\u001b\[[0-9;]*m/g, '');

  // Try parsing the whole output first (fast path)
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall through to line-by-line extraction
  }

  // Find lines that look like JSON (start with { or [)
  const lines = cleaned.split('\n');
  const jsonLines: string[] = [];
  let foundStart = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Start collecting when we find JSON start
    if (!foundStart && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
      foundStart = true;
    }

    if (foundStart) {
      jsonLines.push(line);

      // Try parsing accumulated lines
      const candidate = jsonLines.join('\n');
      try {
        return JSON.parse(candidate);
      } catch {
        // Not complete yet, continue accumulating
      }
    }
  }

  // If we accumulated lines but couldn't parse, try the original fallback
  if (jsonLines.length > 0) {
    try {
      return JSON.parse(jsonLines.join('\n'));
    } catch {
      // Fall through to final fallback
    }
  }

  // Last resort: return fallback
  return JSON.parse(fallback);
}
