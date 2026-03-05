import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execa } from "execa";

/**
 * This module provides utility functions for file operations, command availability checks, timing, and robust JSON parsing.
 * It includes functions to read package.json, check if a command is available in the environment, verify file existence, and measure elapsed time.
 * The parseJsonOutput function is designed to handle CLI outputs that may contain non-JSON text or ANSI color codes, extracting valid JSON content reliably.
 * These utilities are essential for the various runners and integrations in the @vitals/core package to perform their checks and analyses effectively.
 */

// Root of the @vitals/core package — used as localDir so execa resolves
// bundled tool binaries from our own node_modules/.bin, not the target project's.
export const coreLocalDir = dirname(dirname(fileURLToPath(import.meta.url)));

export function readPackageJson(projectPath: string): Record<string, unknown> {
  const pkgPath = join(projectPath, "package.json");
  return JSON.parse(readFileSync(pkgPath, "utf-8"));
}

export async function isCommandAvailable(cmd: string): Promise<boolean> {
  // Check local node_modules/.bin first (bundled deps)
  if (existsSync(join(coreLocalDir, "node_modules", ".bin", cmd))) return true;
  // Fall back to PATH
  try {
    await execa("which", [cmd]);
    return true;
  } catch {
    return false;
  }
}

export function fileExists(projectPath: string, ...parts: string[]): boolean {
  return existsSync(join(projectPath, ...parts));
}

export const WARN_LINES = 400;

export function timer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}

/**
 * Safely extract and parse JSON from mixed CLI output that may contain logs, ANSI codes, etc.
 * Handles cases where tools output "[Vite] Proxy..." or other text before/after JSON.
 */
export function parseJsonOutput(
  stdout: string,
  fallback: string = "{}",
): unknown {
  if (!stdout || !stdout.trim()) {
    return JSON.parse(fallback);
  }

  // Strip ANSI color codes
  // eslint-disable-next-line no-control-regex
  const cleaned = stdout.replace(/\u001b\[[0-9;]*m/g, "");

  // Try parsing the whole output first (fast path)
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall through to line-by-line extraction
  }

  // Find lines that look like JSON (start with { or [)
  const lines = cleaned.split("\n");
  const jsonLines: string[] = [];
  let foundStart = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Start collecting when we find JSON start
    if (!foundStart && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
      foundStart = true;
    }

    if (foundStart) {
      jsonLines.push(line);

      // Try parsing accumulated lines
      const candidate = jsonLines.join("\n");
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
      return JSON.parse(jsonLines.join("\n"));
    } catch {
      // Fall through to final fallback
    }
  }

  // Last resort: return fallback
  return JSON.parse(fallback);
}
