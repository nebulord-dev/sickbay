import { readFileSync } from 'fs';
import { join } from 'path';
import type { CheckResult, Issue } from '../types.js';
import { BaseRunner } from './base.js';
import { timer, fileExists } from '../utils/file-helpers.js';

/**
 * HeavyDepsRunner scans the project's dependencies for known heavy or unnecessary packages, providing insights into potential performance issues.
 * It checks the package.json for dependencies that are commonly considered heavy or have lighter alternatives, such as moment, lodash, and jquery.
 * The runner reports issues with actionable feedback on replacing heavy dependencies with more efficient alternatives, helping to optimize the project's performance and reduce bundle size.
 */

interface HeavyDep {
  alternative: string;
  reason: string;
  severity: 'warning' | 'info';
}

const HEAVY_DEPS: Record<string, HeavyDep> = {
  'moment': {
    alternative: 'dayjs or date-fns',
    reason: 'moment is 300KB+ and mutable — modern alternatives are ~2KB',
    severity: 'warning',
  },
  'lodash': {
    alternative: 'lodash-es or individual lodash/* imports',
    reason: 'Full lodash bundle is 70KB+ — use tree-shakeable imports instead',
    severity: 'warning',
  },
  'underscore': {
    alternative: 'native JS methods (map, filter, reduce, etc.)',
    reason: 'Most underscore utilities have native equivalents',
    severity: 'warning',
  },
  'jquery': {
    alternative: 'native DOM APIs (querySelector, fetch, classList, etc.)',
    reason: 'Modern browsers cover virtually all jQuery use cases natively',
    severity: 'warning',
  },
  'request': {
    alternative: 'native fetch or undici',
    reason: 'request is deprecated and heavy',
    severity: 'warning',
  },
  'bluebird': {
    alternative: 'native Promises',
    reason: 'Native Promises are performant in modern Node/browsers',
    severity: 'info',
  },
  'axios': {
    alternative: 'native fetch',
    reason: 'fetch is built-in to Node 18+ and all modern browsers',
    severity: 'info',
  },
  'left-pad': {
    alternative: 'String.prototype.padStart()',
    reason: 'padStart is a native JS method',
    severity: 'info',
  },
  'is-even': {
    alternative: 'n % 2 === 0',
    reason: 'Trivial one-liner — no package needed',
    severity: 'info',
  },
  'is-odd': {
    alternative: 'n % 2 !== 0',
    reason: 'Trivial one-liner — no package needed',
    severity: 'info',
  },
  'is-number': {
    alternative: 'typeof n === "number" or Number.isFinite()',
    reason: 'Trivial check — no package needed',
    severity: 'info',
  },
  'classnames': {
    alternative: 'clsx (lighter drop-in replacement)',
    reason: 'clsx is smaller and faster',
    severity: 'info',
  },
  'node-fetch': {
    alternative: 'native fetch (Node 18+)',
    reason: 'fetch is built-in to Node 18+',
    severity: 'info',
  },
  'moment-timezone': {
    alternative: 'Intl.DateTimeFormat or date-fns-tz',
    reason: 'moment-timezone bundles all IANA timezone data — 500KB+ unminified',
    severity: 'warning',
  },
  'uuid': {
    alternative: 'crypto.randomUUID()',
    reason: 'crypto.randomUUID() is native in Node 14.17+ and all modern browsers',
    severity: 'info',
  },
  'rimraf': {
    alternative: 'fs.rm(path, { recursive: true, force: true })',
    reason: 'fs.rm with recursive option is built into Node 14.14+',
    severity: 'info',
  },
  'mkdirp': {
    alternative: 'fs.mkdir(path, { recursive: true })',
    reason: 'fs.mkdir with recursive option is built into Node 10.12+',
    severity: 'info',
  },
  'qs': {
    alternative: 'URLSearchParams',
    reason: 'URLSearchParams handles query string parsing natively in Node and browsers',
    severity: 'info',
  },
};

export class HeavyDepsRunner extends BaseRunner {
  name = 'heavy-deps';
  category = 'performance' as const;

  async isApplicable(projectPath: string): Promise<boolean> {
    return fileExists(projectPath, 'package.json');
  }

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const pkg = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf-8'));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      const depNames = Object.keys(allDeps || {});
      const found: Array<{ name: string; info: HeavyDep }> = [];

      for (const dep of depNames) {
        const info = HEAVY_DEPS[dep];
        if (info) {
          found.push({ name: dep, info });
        }
      }

      const issues: Issue[] = found.map((f) => ({
        severity: f.info.severity,
        message: `${f.name} — ${f.info.reason}`,
        fix: {
          description: `Consider replacing with ${f.info.alternative}`,
        },
        reportedBy: ['heavy-deps'],
      }));

      const warningCount = found.filter((f) => f.info.severity === 'warning').length;
      const infoCount = found.filter((f) => f.info.severity === 'info').length;
      const score = Math.max(30, 100 - warningCount * 10 - infoCount * 5);

      return {
        id: 'heavy-deps',
        category: this.category,
        name: 'Heavy Dependencies',
        score,
        status: warningCount > 0 ? 'warning' : infoCount > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['heavy-deps'],
        duration: elapsed(),
        metadata: {
          totalDeps: depNames.length,
          heavyDepsFound: found.length,
          heavyDeps: found.map((f) => f.name),
        },
      };
    } catch (err) {
      return {
        id: 'heavy-deps',
        category: this.category,
        name: 'Heavy Dependencies',
        score: 0,
        status: 'fail',
        issues: [{ severity: 'critical', message: `Heavy deps check failed: ${err}`, reportedBy: ['heavy-deps'] }],
        toolsUsed: ['heavy-deps'],
        duration: elapsed(),
      };
    }
  }
}
