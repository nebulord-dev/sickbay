import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { CheckResult, Issue, ProjectContext } from '../types.js';
import { BaseRunner } from './base.js';
import { timer } from '../utils/file-helpers.js';

const VALIDATION_PACKAGES = [
  'zod',
  'joi',
  'express-validator',
  'yup',
  'ajv',
  '@sinclair/typebox',
  'valibot',
];
const HTTP_SERVER_PACKAGES = [
  'express', 'fastify', 'koa', 'hapi', '@hapi/hapi',
  'restify', 'polka', 'micro', '@nestjs/core', 'h3',
];

export class NodeInputValidationRunner extends BaseRunner {
  name     = 'node-input-validation';
  category = 'code-quality' as const;
  applicableRuntimes = ['node'] as const;

  async isApplicable(projectPath: string, _context: ProjectContext): Promise<boolean> {
    const pkgPath = join(projectPath, 'package.json');
    if (!existsSync(pkgPath)) return false;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    return HTTP_SERVER_PACKAGES.some((p) => p in allDeps);
  }

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const pkgPath = join(projectPath, 'package.json');

    if (!existsSync(pkgPath)) {
      return this.skipped('No package.json found');
    }

    const pkg     = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

    const found = VALIDATION_PACKAGES.find((p) => p in allDeps);

    if (found) {
      const issues: Issue[] = [
        {
          severity: 'info',
          message: `Input validation library detected: ${found}`,
          reportedBy: ['node-input-validation'],
        },
      ];
      return {
        id: 'node-input-validation',
        category: this.category,
        name: 'Input Validation',
        score: 85,
        status: 'pass',
        issues,
        toolsUsed: ['node-input-validation'],
        duration: elapsed(),
      };
    }

    const issues: Issue[] = [
      {
        severity: 'warning',
        message:
          'No input validation library found. Without validation, your API may accept malformed data leading to runtime errors or security vulnerabilities.',
        fix: {
          description: 'Add an input validation library and validate all incoming request data',
          command: 'npm install zod',
        },
        reportedBy: ['node-input-validation'],
      },
    ];

    return {
      id: 'node-input-validation',
      category: this.category,
      name: 'Input Validation',
      score: 20,
      status: 'warning',
      issues,
      toolsUsed: ['node-input-validation'],
      duration: elapsed(),
    };
  }
}
