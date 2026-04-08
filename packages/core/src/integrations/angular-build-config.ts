import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

interface AngularBuildConfiguration {
  sourceMap?: boolean;
  optimization?: boolean;
  budgets?: unknown[];
  aot?: boolean;
}

interface AngularProject {
  architect?: {
    build?: {
      configurations?: {
        production?: AngularBuildConfiguration;
      };
    };
  };
}

export class AngularBuildConfigRunner extends BaseRunner {
  name = 'angular-build-config';
  category = 'performance' as const;
  applicableFrameworks = ['angular'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const angularJsonPath = join(projectPath, 'angular.json');

      if (!existsSync(angularJsonPath)) {
        return {
          id: 'angular-build-config',
          category: this.category,
          name: 'Angular Build Config',
          score: 100,
          status: 'pass',
          issues: [],
          toolsUsed: ['angular-build-config'],
          duration: elapsed(),
          metadata: { reason: 'no angular.json found' },
        };
      }

      const angularJson = JSON.parse(readFileSync(angularJsonPath, 'utf-8'));
      const issues: Issue[] = [];

      // Find the default project or first project
      const projects: Record<string, AngularProject> = angularJson.projects ?? {};
      const projectName = angularJson.defaultProject ?? Object.keys(projects)[0];

      if (!projectName || !projects[projectName]) {
        return {
          id: 'angular-build-config',
          category: this.category,
          name: 'Angular Build Config',
          score: 100,
          status: 'pass',
          issues: [],
          toolsUsed: ['angular-build-config'],
          duration: elapsed(),
          metadata: { reason: 'no projects found in angular.json' },
        };
      }

      const buildConfig = projects[projectName]?.architect?.build?.configurations?.production ?? {};

      if (buildConfig.sourceMap === true) {
        issues.push({
          severity: 'warning',
          message: 'Production build has sourceMap enabled — ships source code to end users',
          fix: {
            description: 'Set "sourceMap": false in the production build configuration.',
            command: `ng config projects.${projectName}.architect.build.configurations.production.sourceMap false`,
          },
          reportedBy: ['angular-build-config'],
        });
      }

      if (buildConfig.optimization === false) {
        issues.push({
          severity: 'warning',
          message: 'Production build has optimization disabled — no minification or tree-shaking',
          fix: {
            description: 'Set "optimization": true in the production build configuration.',
            command: `ng config projects.${projectName}.architect.build.configurations.production.optimization true`,
          },
          reportedBy: ['angular-build-config'],
        });
      }

      if (!buildConfig.budgets && !Array.isArray(buildConfig.budgets)) {
        issues.push({
          severity: 'warning',
          message: 'No bundle size budgets configured — no enforcement of bundle size limits',
          fix: {
            description:
              'Add a "budgets" array to the production build configuration to enforce bundle size limits.',
          },
          reportedBy: ['angular-build-config'],
        });
      }

      if (buildConfig.aot === false) {
        issues.push({
          severity: 'warning',
          message:
            'Production build has AOT compilation disabled — JIT compilation is slower and less secure',
          fix: {
            description:
              'Remove "aot": false from the production build configuration. AOT is the default since Angular 9.',
            command: `ng config projects.${projectName}.architect.build.configurations.production.aot true`,
          },
          reportedBy: ['angular-build-config'],
        });
      }

      const score = Math.max(20, 100 - issues.length * 20);

      return {
        id: 'angular-build-config',
        category: this.category,
        name: 'Angular Build Config',
        score,
        status: issues.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['angular-build-config'],
        duration: elapsed(),
        metadata: { project: projectName, issueCount: issues.length },
      };
    } catch (err) {
      return {
        id: 'angular-build-config',
        category: this.category,
        name: 'Angular Build Config',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['angular-build-config'],
          },
        ],
        toolsUsed: ['angular-build-config'],
        duration: elapsed(),
      };
    }
  }
}
