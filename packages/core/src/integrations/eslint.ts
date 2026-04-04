import { existsSync } from 'fs';
import { join } from 'path';

import { execa } from 'execa';

import { timer, parseJsonOutput } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue, RunOptions } from '../types.js';

interface EslintThresholds {
  maxErrors?: number;
}

/**
 * ESLintRunner uses ESLint to analyze the project's source code for linting issues, enforcing code quality and consistency.
 * It runs ESLint on the 'src' directory, parsing the JSON output to identify errors and warnings across all files.
 * The runner reports issues with actionable feedback, including commands to fix problems using ESLint's auto-fix feature.
 * It calculates an overall score based on the number of errors and warnings, providing insights into the code quality of the project.
 */

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

  async run(projectPath: string, options?: RunOptions): Promise<CheckResult> {
    const elapsed = timer();
    const thresholds = options?.checkConfig?.thresholds as EslintThresholds | undefined;
    const maxErrors = thresholds?.maxErrors ?? 10;

    try {
      const candidateDirs = ['src', 'lib', 'app'];
      const dirsToScan = candidateDirs.filter((d) => existsSync(join(projectPath, d)));

      if (dirsToScan.length === 0) {
        return this.skipped('No source directory found (looked for src, lib, app)');
      }

      const { stdout } = await execa(
        'eslint',
        [...dirsToScan, '--format', 'json', '--no-error-on-unmatched-pattern'],
        { cwd: projectPath, reject: false, preferLocal: true, timeout: 60_000 },
      );

      const results = parseJsonOutput(stdout, '[]') as ESLintFileResult[];

      let totalErrors = 0;
      let totalWarnings = 0;
      const issues: Issue[] = [];

      for (const file of results) {
        totalErrors += file.errorCount;
        totalWarnings += file.warningCount;

        if (file.errorCount > 0 || file.warningCount > 0) {
          const relPath = file.filePath.replace(projectPath + '/', '');
          const parts = [];
          if (file.errorCount > 0)
            parts.push(`${file.errorCount} error${file.errorCount > 1 ? 's' : ''}`);
          if (file.warningCount > 0)
            parts.push(`${file.warningCount} warning${file.warningCount > 1 ? 's' : ''}`);
          issues.push({
            severity: file.errorCount > 0 ? 'warning' : 'info',
            message: `${relPath}: ${parts.join(', ')}`,
            fix: {
              description: `Fix ESLint issues in ${relPath}`,
              command: `eslint ${relPath} --fix`,
              modifiesSource: true,
            },
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
        status:
          totalErrors > maxErrors
            ? 'fail'
            : totalErrors > 0
              ? 'warning'
              : totalWarnings > 0
                ? 'warning'
                : 'pass',
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
        issues: [
          { severity: 'critical', message: `ESLint failed: ${err}`, reportedBy: ['eslint'] },
        ],
        toolsUsed: ['eslint'],
        duration: elapsed(),
      };
    }
  }
}
