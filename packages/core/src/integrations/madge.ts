import { execa } from 'execa';
import { BaseRunner } from './base.js';
import { timer, isCommandAvailable, fileExists, coreLocalDir } from '../utils/file-helpers.js';
import type { CheckResult, Issue } from '../types.js';

export class MadgeRunner extends BaseRunner {
  name = 'madge';
  category = 'code-quality' as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const available = await isCommandAvailable('madge');

    if (!available) {
      return this.skipped('madge not installed — run: npm i -g madge');
    }

    try {
      const hasTs = fileExists(projectPath, 'tsconfig.json');
      const args = hasTs
        ? ['--json', '--circular', '--ts-config', 'tsconfig.json', 'src']
        : ['--json', '--circular', 'src'];

      const { stdout } = await execa('madge', args, {
        cwd: projectPath,
        reject: false,
        preferLocal: true,
        localDir: coreLocalDir,
      });

      let circles: string[][];
      try {
        circles = JSON.parse(stdout || '[]');
      } catch {
        // madge printed an error instead of JSON — treat as no findings
        circles = [];
      }
      const issues: Issue[] = circles.map((cycle) => ({
        severity: 'warning' as const,
        message: `Circular dependency: ${cycle.join(' → ')}`,
        fix: { description: 'Refactor to break the circular dependency cycle' },
        reportedBy: ['madge'],
      }));

      return {
        id: 'madge',
        category: this.category,
        name: 'Circular Dependencies',
        score: circles.length === 0 ? 100 : Math.max(0, 100 - circles.length * 10),
        status: circles.length === 0 ? 'pass' : circles.length > 5 ? 'fail' : 'warning',
        issues,
        toolsUsed: ['madge'],
        duration: elapsed(),
        metadata: { circularCount: circles.length },
      };
    } catch (err) {
      return {
        id: 'madge',
        category: this.category,
        name: 'Circular Dependencies',
        score: 0,
        status: 'fail',
        issues: [{ severity: 'critical', message: `madge failed: ${err}`, reportedBy: ['madge'] }],
        toolsUsed: ['madge'],
        duration: elapsed(),
      };
    }
  }
}
