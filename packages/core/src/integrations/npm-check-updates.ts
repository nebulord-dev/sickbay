import { execa } from 'execa';
import { BaseRunner } from './base.js';
import { timer, isCommandAvailable, coreLocalDir } from '../utils/file-helpers.js';
import type { CheckResult, Issue } from '../types.js';

export class NpmCheckUpdatesRunner extends BaseRunner {
  name = 'npm-check-updates';
  category = 'dependencies' as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const available = await isCommandAvailable('ncu');

    if (!available) {
      return this.skipped('ncu not installed — run: npm i -g npm-check-updates');
    }

    try {
      const { stdout } = await execa('ncu', ['--jsonUpgraded', '--loglevel', 'silent'], {
        cwd: projectPath,
        reject: false,
        preferLocal: true,
        localDir: coreLocalDir,
      });

      // --jsonUpgraded returns { pkg: newVersion }
      const upgrades: Record<string, string> = JSON.parse(stdout || '{}');

      // Read current versions from package.json to detect major bumps
      let currentVersions: Record<string, string> = {};
      try {
        const { readPackageJson } = await import('../utils/file-helpers.js');
        const pkg = readPackageJson(projectPath) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        currentVersions = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      } catch { /* ignore */ }

      const issues: Issue[] = [];
      for (const [pkg, newVersion] of Object.entries(upgrades)) {
        const currentVersion = currentVersions[pkg] ?? '';
        const isMajor = detectMajorBump(currentVersion, newVersion);
        issues.push({
          severity: isMajor ? 'warning' : 'info',
          message: `${pkg}: ${currentVersion} → ${newVersion}`,
          fix: {
            description: `Update ${pkg} to ${newVersion}`,
            command: `npx npm-check-updates -u`,
          },
          reportedBy: ['npm-check-updates'],
        });
      }

      const count = issues.length;
      const score = Math.max(0, 100 - count * 3);

      return {
        id: 'npm-check-updates',
        category: this.category,
        name: 'Outdated Packages',
        score,
        status: count === 0 ? 'pass' : count > 15 ? 'fail' : 'warning',
        issues,
        toolsUsed: ['npm-check-updates'],
        duration: elapsed(),
        metadata: { outdatedCount: count, upgrades },
      };
    } catch (err) {
      return {
        id: 'npm-check-updates',
        category: this.category,
        name: 'Outdated Packages',
        score: 0,
        status: 'fail',
        issues: [{ severity: 'critical', message: `ncu failed: ${err}`, reportedBy: ['ncu'] }],
        toolsUsed: ['npm-check-updates'],
        duration: elapsed(),
      };
    }
  }
}

function detectMajorBump(from: string, to: string): boolean {
  const fromMajor = parseInt(from.replace(/[^0-9]/, '').split('.')[0] ?? '0', 10);
  const toMajor = parseInt(to.replace(/[^0-9]/, '').split('.')[0] ?? '0', 10);
  return !isNaN(fromMajor) && !isNaN(toMajor) && toMajor > fromMajor;
}
