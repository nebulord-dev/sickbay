import { execa } from 'execa';

import { timer, isCommandAvailable, coreLocalDir, parseJsonOutput } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue, RunOptions } from '../types.js';

interface JscpdThresholds {
  warnPercent?: number;
  criticalPercent?: number;
}

/**
 * Jscpd is a code duplication detection tool that identifies duplicate code blocks in a project.
 * The statistics object contains a total field with the percentage of duplicated code and the number of clones detected.
 * This information is used to assess the level of code duplication in the project and provide feedback on potential refactoring opportunities.
 */

interface JscpdStats {
  total: { percentage: number; clones: number };
}

interface JscpdOutput {
  statistics?: JscpdStats;
  duplicates?: Array<{
    firstFile?: { name: string };
    secondFile?: { name: string };
    lines: number;
  }>;
}

export class JscpdRunner extends BaseRunner {
  name = 'jscpd';
  category = 'code-quality' as const;

  async run(projectPath: string, options?: RunOptions): Promise<CheckResult> {
    const elapsed = timer();
    const thresholds = options?.checkConfig?.thresholds as JscpdThresholds | undefined;
    const warnPercent = thresholds?.warnPercent ?? 5;
    const criticalPercent = thresholds?.criticalPercent ?? 20;
    const available = await isCommandAvailable('jscpd');

    if (!available) {
      return this.skipped('jscpd not installed — run: npm i -g jscpd');
    }

    try {
      const { stdout } = await execa(
        'jscpd',
        ['src', '--reporters', 'json', '--output', '/tmp/jscpd-sickbay', '--silent'],
        {
          cwd: projectPath,
          reject: false,
          preferLocal: true,
          localDir: coreLocalDir,
        },
      );

      // jscpd writes to file, try parsing stdout fallback
      let data: JscpdOutput = {};
      try {
        data = parseJsonOutput(stdout, '{}') as JscpdOutput;
      } catch {
        // output may be written to file only
      }

      const percentage = data.statistics?.total.percentage ?? 0;
      const clones = data.statistics?.total.clones ?? 0;
      const issues: Issue[] = [];

      if (percentage > warnPercent) {
        issues.push({
          severity: percentage > criticalPercent ? 'critical' : 'warning',
          message: `${percentage.toFixed(1)}% code duplication detected (${clones} clone${clones !== 1 ? 's' : ''})`,
          fix: {
            description: 'Extract duplicated code into shared utilities or components',
          },
          reportedBy: ['jscpd'],
        });
      }

      return {
        id: 'jscpd',
        category: this.category,
        name: 'Code Duplication',
        score: Math.max(0, 100 - Math.round(percentage * 3)),
        status:
          percentage === 0
            ? 'pass'
            : percentage > criticalPercent
              ? 'fail'
              : percentage > warnPercent
                ? 'warning'
                : 'pass',
        issues,
        toolsUsed: ['jscpd'],
        duration: elapsed(),
        metadata: { percentage, clones },
      };
    } catch (err) {
      return {
        id: 'jscpd',
        category: this.category,
        name: 'Code Duplication',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `jscpd failed: ${err}`,
            reportedBy: ['jscpd'],
          },
        ],
        toolsUsed: ['jscpd'],
        duration: elapsed(),
      };
    }
  }
}
