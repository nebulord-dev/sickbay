import { execa } from 'execa';
import { BaseRunner } from './base.js';
import { timer, isCommandAvailable, coreLocalDir } from '../utils/file-helpers.js';
import type { CheckResult, Issue } from '../types.js';

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

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const available = await isCommandAvailable('jscpd');

    if (!available) {
      return this.skipped('jscpd not installed — run: npm i -g jscpd');
    }

    try {
      const { stdout } = await execa(
        'jscpd',
        ['src', '--reporters', 'json', '--output', '/tmp/jscpd-vitals', '--silent'],
        { cwd: projectPath, reject: false, preferLocal: true, localDir: coreLocalDir }
      );

      // jscpd writes to file, try parsing stdout fallback
      let data: JscpdOutput = {};
      try {
        data = JSON.parse(stdout || '{}');
      } catch {
        // output may be written to file only
      }

      const percentage = data.statistics?.total.percentage ?? 0;
      const clones = data.statistics?.total.clones ?? 0;
      const issues: Issue[] = [];

      if (percentage > 5) {
        issues.push({
          severity: percentage > 20 ? 'critical' : 'warning',
          message: `${percentage.toFixed(1)}% code duplication detected (${clones} clone${clones !== 1 ? 's' : ''})`,
          fix: { description: 'Extract duplicated code into shared utilities or components' },
          reportedBy: ['jscpd'],
        });
      }

      return {
        id: 'jscpd',
        category: this.category,
        name: 'Code Duplication',
        score: Math.max(0, 100 - Math.round(percentage * 3)),
        status: percentage === 0 ? 'pass' : percentage > 20 ? 'fail' : percentage > 5 ? 'warning' : 'pass',
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
        issues: [{ severity: 'critical', message: `jscpd failed: ${err}`, reportedBy: ['jscpd'] }],
        toolsUsed: ['jscpd'],
        duration: elapsed(),
      };
    }
  }
}
