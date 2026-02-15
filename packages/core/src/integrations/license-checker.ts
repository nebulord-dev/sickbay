import { execa } from 'execa';
import { BaseRunner } from './base.js';
import { timer, isCommandAvailable, coreLocalDir, parseJsonOutput } from '../utils/file-helpers.js';
import type { CheckResult, Issue } from '../types.js';

/**
 * LicenseCheckerRunner uses the license-checker tool to analyze the project's dependencies for problematic licenses.
 * It checks the licenses of all production dependencies, flagging those that may be incompatible with commercial use.
 * The runner reports issues with actionable feedback, including commands to review or replace dependencies with problematic licenses.
 * It calculates an overall score based on the number of flagged licenses, providing insights into the project's license compliance.
 */

const PROBLEMATIC_LICENSES = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.1', 'LGPL-3.0', 'CC-BY-NC'];

interface LicenseInfo {
  licenses: string;
  repository?: string;
}

export class LicenseCheckerRunner extends BaseRunner {
  name = 'license-checker';
  category = 'security' as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const available = await isCommandAvailable('license-checker');

    if (!available) {
      return this.skipped('license-checker not installed — run: npm i -g license-checker');
    }

    try {
      const { stdout } = await execa('license-checker', ['--json', '--production'], {
        cwd: projectPath,
        reject: false,
        preferLocal: true,
        localDir: coreLocalDir,
      });

      const licenses = parseJsonOutput(stdout, '{}') as Record<string, LicenseInfo>;
      const issues: Issue[] = [];

      for (const [pkg, info] of Object.entries(licenses)) {
        const license = info.licenses;
        if (PROBLEMATIC_LICENSES.some((l) => license.includes(l))) {
          issues.push({
            severity: 'warning',
            message: `${pkg} uses ${license} license — may be incompatible with commercial use`,
            fix: { description: `Review or replace ${pkg.split('@')[0]}` },
            reportedBy: ['license-checker'],
          });
        }
      }

      return {
        id: 'license-checker',
        category: this.category,
        name: 'License Compliance',
        score: issues.length === 0 ? 100 : Math.max(60, 100 - issues.length * 10),
        status: issues.length === 0 ? 'pass' : 'warning',
        issues,
        toolsUsed: ['license-checker'],
        duration: elapsed(),
        metadata: { totalPackages: Object.keys(licenses).length, flagged: issues.length },
      };
    } catch (err) {
      return {
        id: 'license-checker',
        category: this.category,
        name: 'License Compliance',
        score: 0,
        status: 'fail',
        issues: [{ severity: 'critical', message: `license-checker failed: ${err}`, reportedBy: ['license-checker'] }],
        toolsUsed: ['license-checker'],
        duration: elapsed(),
      };
    }
  }
}
