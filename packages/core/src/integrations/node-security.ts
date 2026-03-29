import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { CheckResult, Issue, ProjectContext } from '../types.js';
import { BaseRunner } from './base.js';
import { timer } from '../utils/file-helpers.js';

const HELMET_PACKAGES   = ['helmet', 'koa-helmet', 'fastify-helmet'];
const CORS_PACKAGES     = ['cors', '@koa/cors', '@fastify/cors', 'koa2-cors'];
const RATE_LIMIT_PACKAGES = [
  'express-rate-limit',
  'rate-limiter-flexible',
  '@fastify/rate-limit',
  'koa-ratelimit',
];
const HTTP_SERVER_PACKAGES = [
  'express', 'fastify', 'koa', 'hapi', '@hapi/hapi',
  'restify', 'polka', 'micro', '@nestjs/core', 'h3',
];

export class NodeSecurityRunner extends BaseRunner {
  name     = 'node-security';
  category = 'security' as const;
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

    const hasHelmet    = HELMET_PACKAGES.some((p) => p in allDeps);
    const hasCors      = CORS_PACKAGES.some((p) => p in allDeps);
    const hasRateLimit = RATE_LIMIT_PACKAGES.some((p) => p in allDeps);

    const issues: Issue[] = [];
    let score = 0;

    if (hasHelmet) {
      score += 35;
    } else {
      issues.push({
        severity: 'critical',
        message: 'Missing security headers middleware (helmet). HTTP security headers protect against XSS, clickjacking, MIME sniffing, and other common attacks.',
        fix: {
          description: 'Install helmet and add app.use(helmet()) before your routes',
          command: 'npm install helmet',
          nextSteps: 'Add app.use(helmet()) before your routes',
        },
        reportedBy: ['node-security'],
      });
    }

    if (hasCors) {
      score += 30;
    } else {
      issues.push({
        severity: 'warning',
        message: 'Missing CORS middleware. Without explicit CORS configuration your API may be inaccessible from browser clients or accept requests from any origin.',
        fix: {
          description: 'Install cors and configure allowed origins explicitly',
          command: 'npm install cors',
          nextSteps: 'Configure allowed origins explicitly with cors({ origin: [...] })',
        },
        reportedBy: ['node-security'],
      });
    }

    if (hasRateLimit) {
      score += 35;
    } else {
      issues.push({
        severity: 'warning',
        message: 'Missing rate limiting middleware. Without rate limiting your API is vulnerable to DoS attacks and credential brute-forcing.',
        fix: {
          description: 'Install express-rate-limit and configure limits per route or globally',
          command: 'npm install express-rate-limit',
          nextSteps: 'Configure rate limits per route or globally',
        },
        reportedBy: ['node-security'],
      });
    }

    const status = score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail';

    return {
      id: 'node-security',
      category: this.category,
      name: 'Node Security Middleware',
      score,
      status,
      issues,
      toolsUsed: ['node-security'],
      duration: elapsed(),
    };
  }
}
