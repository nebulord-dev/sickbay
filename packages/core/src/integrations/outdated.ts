import { execa } from 'execa';
import { BaseRunner } from './base.js';
import { timer } from '../utils/file-helpers.js';
import { detectPackageManager } from '../utils/detect-project.js';
import type { CheckResult, Issue } from '../types.js';

/**
 * OutdatedRunner uses the package manager's outdated command to analyze the project's dependencies for outdated packages.
 * It detects which dependencies have newer versions available, parsing the output to identify the current and latest versions of each package.
 * The runner reports issues with actionable feedback, including commands to update outdated packages, helping to keep the project up-to-date and secure.
 * It calculates an overall score based on the number of outdated packages found, providing insights into the project's maintenance status.
 */

interface OutdatedEntry {
  name: string;
  current: string;
  latest: string;
  dev: boolean;
}

export class OutdatedRunner extends BaseRunner {
  name = 'outdated';
  category = 'dependencies' as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const pm = detectPackageManager(projectPath);

    // yarn and bun don't support `--json` in a parseable way (yarn outputs NDJSON,
    // bun outputs a formatted table). Rather than crash or return wrong results,
    // skip the check and surface a hint to run the command manually instead.
    if (pm === 'yarn' || pm === 'bun') {
      return this.skipped(`${pm} outdated not supported — run: ${pm} outdated`);
    }

    try {
      // Both npm and pnpm return exit code 1 when packages are outdated — use reject: false
      const { stdout } = await execa(pm, ['outdated', '--json'], {
        cwd: projectPath,
        reject: false,
        timeout: 60_000,
      });

      const entries = parseOutdated(stdout);
      const issues: Issue[] = entries.map((e) => {
        const updateType = getUpdateType(e.current, e.latest);
        const isMajor = updateType === 'major';
        return {
          severity: isMajor ? 'warning' : 'info',
          message: `${e.name}: ${e.current} → ${e.latest} (${updateType})`,
          fix: isMajor
            ? {
                description: `Update ${e.name} to ${e.latest} (major — review changelog before upgrading)`,
              }
            : {
                description: `Update ${e.name} to ${e.latest}`,
                command: `${pm} update ${e.name}`,
                nextSteps: 'Run tests to verify nothing broke',
              },
          reportedBy: ['outdated'],
        };
      });

      const count = issues.length;
      return {
        id: 'outdated',
        category: this.category,
        name: 'Outdated Packages',
        score: Math.max(0, 100 - count * 3),
        status: count === 0 ? 'pass' : count > 15 ? 'fail' : 'warning',
        issues,
        toolsUsed: [pm],
        duration: elapsed(),
        metadata: { outdatedCount: count },
      };
    } catch (err) {
      return {
        id: 'outdated',
        category: this.category,
        name: 'Outdated Packages',
        score: 0,
        status: 'fail',
        issues: [{ severity: 'critical', message: `${pm} outdated failed: ${err}`, reportedBy: ['outdated'] }],
        toolsUsed: [pm],
        duration: elapsed(),
      };
    }
  }
}

function parseOutdated(stdout: string): OutdatedEntry[] {
  if (!stdout.trim()) return [];

  try {
    // Both npm and pnpm return { pkgName: { current, latest, ... } }
    // npm uses `type`, pnpm uses `dependencyType`
    const raw: Record<string, { current: string; latest: string; type?: string; dependencyType?: string }> =
      JSON.parse(stdout);

    return Object.entries(raw)
      .filter(([_, info]) => info.current && info.latest) // Skip entries with missing version data
      .map(([name, info]) => ({
        name,
        current: info.current,
        latest: info.latest,
        dev: (info.type ?? info.dependencyType ?? '') === 'devDependencies',
      }));
  } catch {
    return [];
  }
}

function getVersionParts(version: string): [number, number, number] {
  if (!version) return [0, 0, 0];
  const cleaned = version.replace(/^[^0-9]*/, '');
  const parts = cleaned.split('.');
  return [
    parseInt(parts[0] ?? '0', 10),
    parseInt(parts[1] ?? '0', 10),
    parseInt(parts[2] ?? '0', 10),
  ];
}

function getUpdateType(current: string, latest: string): 'major' | 'minor' | 'patch' {
  const [curMaj, curMin] = getVersionParts(current);
  const [latMaj, latMin] = getVersionParts(latest);
  if (curMaj < latMaj) return 'major';
  if (curMin < latMin) return 'minor';
  return 'patch';
}
