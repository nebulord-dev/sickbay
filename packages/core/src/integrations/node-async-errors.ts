import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import type { CheckResult, Issue } from '../types.js';
import { BaseRunner } from './base.js';
import { timer } from '../utils/file-helpers.js';

const SOURCE_EXTENSIONS = new Set(['.js', '.ts', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'test', 'tests', '__tests__']);

// Detects async route handler declarations (handles multiline via /s flag)
const ASYNC_ROUTE_RE = /(?:app|router)\s*\.\s*(?:get|post|put|patch|delete|all)\s*\([^;]*\basync\b/s;
// Detects try/catch usage
const TRY_CATCH_RE = /\btry\s*\{/;
// Detects express-async-errors import/require
const ASYNC_ERRORS_RE = /require\s*\(\s*['"]express-async-errors['"]\s*\)|from\s+['"]express-async-errors['"]/;
// Detects 4-param error middleware
const ERROR_MIDDLEWARE_RE = /\(\s*(?:err|error)\s*,\s*\w+\s*,\s*\w+\s*,\s*\w+\s*\)\s*(?:=>|\{)/;

function collectSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        files.push(...collectSourceFiles(full));
      } else if (SOURCE_EXTENSIONS.has(extname(entry))) {
        files.push(full);
      }
    } catch {
      // skip unreadable entries
    }
  }
  return files;
}

export class NodeAsyncErrorsRunner extends BaseRunner {
  name     = 'node-async-errors';
  category = 'code-quality' as const;
  applicableRuntimes = ['node'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const pkgPath = join(projectPath, 'package.json');

    if (!existsSync(pkgPath)) {
      return this.skipped('No package.json found');
    }

    const pkg     = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

    // express-async-errors patches Express globally — all handlers are protected
    if ('express-async-errors' in allDeps) {
      return {
        id: 'node-async-errors',
        category: this.category,
        name: 'Async Error Handling',
        score: 100,
        status: 'pass',
        issues: [
          {
            severity: 'info',
            message: 'express-async-errors detected — all async route handlers are automatically protected.',
            reportedBy: ['node-async-errors'],
          },
        ],
        toolsUsed: ['node-async-errors'],
        duration: elapsed(),
      };
    }

    const srcDir = join(projectPath, 'src');
    const files  = collectSourceFiles(existsSync(srcDir) ? srcDir : projectPath);

    let routeFiles     = 0;
    let protectedFiles = 0;
    let hasErrorMiddleware = false;

    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8');
        if (ASYNC_ERRORS_RE.test(content)) {
          hasErrorMiddleware = true;
          continue;
        }
        if (ERROR_MIDDLEWARE_RE.test(content)) hasErrorMiddleware = true;
        if (!ASYNC_ROUTE_RE.test(content)) continue;

        routeFiles++;
        if (TRY_CATCH_RE.test(content)) protectedFiles++;
      } catch {
        // skip unreadable files
      }
    }

    const issues: Issue[] = [];

    if (routeFiles === 0) {
      return {
        id: 'node-async-errors',
        category: this.category,
        name: 'Async Error Handling',
        score: 90,
        status: 'pass',
        issues,
        toolsUsed: ['node-async-errors'],
        duration: elapsed(),
      };
    }

    const unprotectedFiles = routeFiles - protectedFiles;
    const protectionRatio  = protectedFiles / routeFiles;

    if (unprotectedFiles > 0) {
      issues.push({
        severity: unprotectedFiles === routeFiles ? 'critical' : 'warning',
        message: `${unprotectedFiles} of ${routeFiles} route file(s) contain async handlers without try/catch. Unhandled promise rejections will crash the process in Node.js <15 or produce silent failures.`,
        fix: {
          description: 'Wrap async route handlers in try/catch or use express-async-errors to auto-wrap all handlers',
          command: 'npm install express-async-errors',
        },
        reportedBy: ['node-async-errors'],
      });
    }

    if (!hasErrorMiddleware) {
      issues.push({
        severity: 'warning',
        message: 'No Express error handling middleware found (4-parameter function: err, req, res, next). Without it, errors passed to next() have no centralized handler.',
        fix: {
          description: "Add app.use((err, req, res, next) => { res.status(500).json({ error: err.message }); }) after all routes",
        },
        reportedBy: ['node-async-errors'],
      });
    }

    const baseScore       = Math.round(protectionRatio * 80);
    const middlewareBonus = hasErrorMiddleware ? 20 : 0;
    const score           = Math.min(100, baseScore + middlewareBonus);
    const status          = score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail';

    return {
      id: 'node-async-errors',
      category: this.category,
      name: 'Async Error Handling',
      score,
      status,
      issues,
      toolsUsed: ['node-async-errors'],
      duration: elapsed(),
    };
  }
}
