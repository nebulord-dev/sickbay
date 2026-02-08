import { execa } from 'execa';
import { existsSync } from 'fs';
import { join } from 'path';
import { BaseRunner } from './base.js';
import { timer } from '../utils/file-helpers.js';
import type { CheckResult, Issue } from '../types.js';

interface ESLintMessage {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
}

interface ESLintFileResult {
  filePath: string;
  messages: ESLintMessage[];
  errorCount: number;
  warningCount: number;
}

export class ESLintRunner extends BaseRunner {
  name = 'eslint';
  category = 'code-quality' as const;

  async isApplicable(projectPath: string): Promise<boolean> {
    return (
      existsSync(join(projectPath, '.eslintrc.js')) ||
      existsSync(join(projectPath, '.eslintrc.cjs')) ||
      existsSync(join(projectPath, '.eslintrc.json')) ||
      existsSync(join(projectPath, '.eslintrc.yml')) ||
      existsSync(join(projectPath, 'eslint.config.js')) ||
      existsSync(join(projectPath, 'eslint.config.mjs')) ||
      existsSync(join(projectPath, 'eslint.config.cjs'))
    );
  }

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const { stdout } = await execa(
        'eslint',
        ['src', '--format', 'json', '--no-error-on-unmatched-pattern'],
        { cwd: projectPath, reject: false, preferLocal: true, timeout: 60_000 }
      );

      const results: ESLintFileResult[] = JSON.parse(stdout || '[]');

      let totalErrors = 0;
      let totalWarnings = 0;
      const issues: Issue[] = [];

      for (const file of results) {
        totalErrors += file.errorCount;
        totalWarnings += file.warningCount;

        if (file.errorCount > 0 || file.warningCount > 0) {
          const relPath = file.filePath.replace(projectPath + '/', '');
          const parts = [];
          if (file.errorCount > 0) parts.push(`${file.errorCount} error${file.errorCount > 1 ? 's' : ''}`);
          if (file.warningCount > 0) parts.push(`${file.warningCount} warning${file.warningCount > 1 ? 's' : ''}`);
          issues.push({
            severity: file.errorCount > 0 ? 'warning' : 'info',
            message: `${relPath}: ${parts.join(', ')}`,
            fix: { description: `Fix ESLint issues in ${relPath}`, command: `eslint ${relPath} --fix` },
            reportedBy: ['eslint'],
          });
        }
      }

      const score = Math.max(0, 100 - totalErrors * 5 - Math.round(totalWarnings * 0.5));

      return {
        id: 'eslint',
        category: this.category,
        name: 'Lint',
        score,
        status: totalErrors > 10 ? 'fail' : totalErrors > 0 ? 'warning' : totalWarnings > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['eslint'],
        duration: elapsed(),
        metadata: { errors: totalErrors, warnings: totalWarnings, files: results.length },
      };
    } catch (err) {
      return {
        id: 'eslint',
        category: this.category,
        name: 'Lint',
        score: 0,
        status: 'fail',
        issues: [{ severity: 'critical', message: `ESLint failed: ${err}`, reportedBy: ['eslint'] }],
        toolsUsed: ['eslint'],
        duration: elapsed(),
      };
    }
  }
}
