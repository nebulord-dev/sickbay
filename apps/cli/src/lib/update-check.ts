import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
}

interface UpdateCache {
  latestVersion: string;
  checkedAt: number;
}

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const REGISTRY_URL = 'https://registry.npmjs.org/sickbay/latest';

const SICKBAY_DIR = join(homedir(), '.sickbay');
const CACHE_PATH = join(SICKBAY_DIR, 'update-check.json');

export function isNewerVersion(current: string, latest: string): boolean {
  try {
    // Strip prerelease suffix (e.g. "1.4.0-beta.1" → "1.4.0")
    const cleanCurrent = current.split('-')[0];
    const cleanLatest = latest.split('-')[0];

    const currentParts = cleanCurrent.split('.').map(Number);
    const latestParts = cleanLatest.split('.').map(Number);

    if (
      currentParts.length !== 3 ||
      latestParts.length !== 3 ||
      currentParts.some(isNaN) ||
      latestParts.some(isNaN)
    ) {
      return false;
    }

    for (let i = 0; i < 3; i++) {
      if (latestParts[i] > currentParts[i]) return true;
      if (latestParts[i] < currentParts[i]) return false;
    }

    return false;
  } catch {
    return false;
  }
}

export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    // Try to read cache
    if (existsSync(CACHE_PATH)) {
      try {
        const raw = readFileSync(CACHE_PATH, 'utf8') as string;
        const cache = JSON.parse(raw) as UpdateCache;
        const age = Date.now() - cache.checkedAt;

        if (age < CACHE_TTL_MS) {
          // Cache is fresh — use it
          if (isNewerVersion(currentVersion, cache.latestVersion)) {
            return { currentVersion, latestVersion: cache.latestVersion };
          }
          return null;
        }
      } catch {
        // Malformed cache — fall through to fetch
      }
    }

    // Cache is missing or stale — fetch from registry
    const response = await fetch(REGISTRY_URL, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { version: string };
    const latestVersion = data.version;

    // Write cache (non-critical — swallow failures)
    try {
      mkdirSync(SICKBAY_DIR, { recursive: true });
      writeFileSync(
        CACHE_PATH,
        JSON.stringify({ latestVersion, checkedAt: Date.now() } satisfies UpdateCache),
      );
    } catch {
      // Cache write failure is non-critical
    }

    if (isNewerVersion(currentVersion, latestVersion)) {
      return { currentVersion, latestVersion };
    }

    return null;
  } catch {
    return null;
  }
}
