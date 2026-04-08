import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

import { relativeFromRoot, timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

export class AngularLazyRoutesRunner extends BaseRunner {
  name = 'angular-lazy-routes';
  category = 'performance' as const;
  applicableFrameworks = ['angular'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      let routeFiles: FileEntry[];
      try {
        routeFiles = findRouteFiles(join(projectPath, 'src'), projectPath);
      } catch (dirErr: unknown) {
        const code = (dirErr as NodeJS.ErrnoException).code;
        if (code === 'ENOENT' || code === 'ENOTDIR') {
          routeFiles = [];
        } else {
          throw dirErr;
        }
      }

      if (routeFiles.length === 0) {
        return {
          id: 'angular-lazy-routes',
          category: this.category,
          name: 'Angular Lazy Routes',
          score: 100,
          status: 'pass',
          issues: [],
          toolsUsed: ['angular-lazy-routes'],
          duration: elapsed(),
          metadata: { routeFiles: 0, staticRoutes: 0, lazyRoutes: 0, totalRoutes: 0 },
        };
      }

      let lazyRoutes = 0;
      let staticRoutes = 0;
      const issues: Issue[] = [];

      for (const { relPath, fullPath } of routeFiles) {
        const content = readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue;

          if (/\bloadComponent\s*:/.test(line)) {
            lazyRoutes++;
          } else if (/\bcomponent\s*:/.test(line)) {
            staticRoutes++;
            issues.push({
              severity: 'warning',
              message: `${relPath}:${i + 1} — static route component import; consider lazy loading`,
              file: relPath,
              suppressMatch: relPath,
              fix: {
                description:
                  "Replace `component: MyComponent` with `loadComponent: () => import('./my.component').then(m => m.MyComponent)` to enable route-level code splitting.",
              },
              reportedBy: ['angular-lazy-routes'],
            });
          }
        }
      }

      const totalRoutes = lazyRoutes + staticRoutes;
      const score =
        totalRoutes === 0 ? 100 : Math.max(20, Math.round((lazyRoutes / totalRoutes) * 100));

      return {
        id: 'angular-lazy-routes',
        category: this.category,
        name: 'Angular Lazy Routes',
        score,
        status: staticRoutes > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['angular-lazy-routes'],
        duration: elapsed(),
        metadata: { routeFiles: routeFiles.length, staticRoutes, lazyRoutes, totalRoutes },
      };
    } catch (err) {
      return {
        id: 'angular-lazy-routes',
        category: this.category,
        name: 'Angular Lazy Routes',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['angular-lazy-routes'],
          },
        ],
        toolsUsed: ['angular-lazy-routes'],
        duration: elapsed(),
      };
    }
  }
}

interface FileEntry {
  relPath: string;
  fullPath: string;
}

function findRouteFiles(dir: string, projectRoot: string, topLevel = true): FileEntry[] {
  const files: FileEntry[] = [];
  const entries = topLevel
    ? readdirSync(dir)
    : (() => {
        try {
          return readdirSync(dir);
        } catch {
          return [];
        }
      })();
  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      files.push(...findRouteFiles(fullPath, projectRoot, false));
    } else if (entry.endsWith('.routes.ts') || entry === 'app.config.ts') {
      files.push({ relPath: relativeFromRoot(projectRoot, fullPath), fullPath });
    }
  }
  return files;
}
