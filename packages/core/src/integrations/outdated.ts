import { execa } from 'execa';
import { existsSync } from 'fs';
import { join } from 'path';
import { BaseRunner } from './base.js';
import { timer } from '../utils/file-helpers.js';
import type { CheckResult, Issue } from '../types.js';

type Pm = 'pnpm' | 'npm' | 'yarn';

interface OutdatedEntry {
  name: string;
  current: string;
  latest: string;
  dev: boolean;
}

export class OutdatedRunner extends BaseRunner {
  name = 'outdated';
  category = 'dependencies' as const;

  private detectPm(projectPath: string): Pm {
    if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
    if (existsSync(join(projectPath, 'yarn.lock'))) return 'yarn';
    return 'npm';
  }

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const pm = this.detectPm(projectPath);

    if (pm === 'yarn') {
      // yarn outdated JSON is NDJSON — complex to parse; skip gracefully
      return this.skipped('yarn outdated JSON not supported — run: yarn outdated');
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
        const isMajor = getMajor(e.current) < getMajor(e.latest);
        return {
          severity: isMajor ? 'warning' : 'info',
          message: `${e.name}: ${e.current} → ${e.latest}`,
          fix: {
            description: `Update ${e.name} to ${e.latest}`,
            command: `${pm} update ${e.name}`,
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

function getMajor(version: string): number {
  if (!version) return 0;
  // Strip leading non-numeric chars (^, ~, v, etc.) only from the start
  return parseInt(version.replace(/^[^0-9]*/, '').split('.')[0] ?? '0', 10);
}
