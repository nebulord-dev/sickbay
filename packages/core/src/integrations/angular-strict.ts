import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

export class AngularStrictRunner extends BaseRunner {
  name = 'angular-strict';
  category = 'code-quality' as const;
  applicableFrameworks = ['angular'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const tsconfigPath = join(projectPath, 'tsconfig.json');

      if (!existsSync(tsconfigPath)) {
        return {
          id: 'angular-strict',
          category: this.category,
          name: 'Angular Strict Mode',
          score: 100,
          status: 'pass',
          issues: [],
          toolsUsed: ['angular-strict'],
          duration: elapsed(),
          metadata: { reason: 'no tsconfig.json found' },
        };
      }

      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
      const compilerOptions: Record<string, unknown> = tsconfig.compilerOptions ?? {};
      const angularOptions: Record<string, unknown> = tsconfig.angularCompilerOptions ?? {};

      const issues: Issue[] = [];

      if (!compilerOptions['strict']) {
        issues.push({
          severity: 'warning',
          message:
            'TypeScript strict mode is disabled — could not confirm strict mode is enabled (check parent configs if using extends)',
          fix: {
            description:
              'Enable `strict: true` in `compilerOptions` for full TypeScript strict mode.',
          },
          reportedBy: ['angular-strict'],
        });
      }

      if (!angularOptions['strictTemplates']) {
        issues.push({
          severity: 'warning',
          message:
            'Angular strictTemplates is disabled — could not confirm strictTemplates is enabled (check parent configs if using extends)',
          fix: {
            description:
              'Enable `strictTemplates: true` in `angularCompilerOptions` to catch template type errors at build time.',
          },
          reportedBy: ['angular-strict'],
        });
      }

      if (!angularOptions['strictInjectionParameters']) {
        issues.push({
          severity: 'warning',
          message:
            'Angular strictInjectionParameters is disabled — could not confirm strictInjectionParameters is enabled (check parent configs if using extends)',
          fix: {
            description:
              'Enable `strictInjectionParameters: true` in `angularCompilerOptions` to catch missing injection token errors.',
          },
          reportedBy: ['angular-strict'],
        });
      }

      const score = Math.max(20, 100 - issues.length * 27);

      return {
        id: 'angular-strict',
        category: this.category,
        name: 'Angular Strict Mode',
        score,
        status: issues.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['angular-strict'],
        duration: elapsed(),
        metadata: {
          strict: !!compilerOptions['strict'],
          strictTemplates: !!angularOptions['strictTemplates'],
          strictInjectionParameters: !!angularOptions['strictInjectionParameters'],
        },
      };
    } catch (err) {
      return {
        id: 'angular-strict',
        category: this.category,
        name: 'Angular Strict Mode',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['angular-strict'],
          },
        ],
        toolsUsed: ['angular-strict'],
        duration: elapsed(),
      };
    }
  }
}
