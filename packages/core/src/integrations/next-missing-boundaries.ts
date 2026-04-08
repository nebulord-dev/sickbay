import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

import { relativeFromRoot, timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

export class NextMissingBoundariesRunner extends BaseRunner {
  name = 'next-missing-boundaries';
  category = 'code-quality' as const;
  applicableFrameworks = ['next'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      // Check both app/ and src/app/ paths
      const appPaths = [join(projectPath, 'app'), join(projectPath, 'src', 'app')];

      let pageDirs: string[] = [];
      for (const appPath of appPaths) {
        pageDirs.push(...findPageDirs(appPath, projectPath, true));
      }

      const issues: Issue[] = [];
      let segmentsChecked = 0;
      let missingLoading = 0;
      let missingError = 0;

      for (const pageDir of pageDirs) {
        segmentsChecked++;
        const relDir = relativeFromRoot(projectPath, pageDir);

        // Check for missing loading.tsx/jsx
        if (
          !existsSync(join(pageDir, 'loading.tsx')) &&
          !existsSync(join(pageDir, 'loading.jsx'))
        ) {
          missingLoading++;
          issues.push({
            severity: 'info' as const,
            message: `${relDir} — missing loading.tsx (Suspense boundary for this route segment)`,
            suppressMatch: relDir,
            fix: {
              description:
                "Add loading.tsx to show a skeleton UI while this route's data loads (App Router Suspense boundary).",
            },
            reportedBy: ['next-missing-boundaries'],
          });
        }

        // Check for missing error.tsx/jsx
        if (!existsSync(join(pageDir, 'error.tsx')) && !existsSync(join(pageDir, 'error.jsx'))) {
          missingError++;
          issues.push({
            severity: 'info' as const,
            message: `${relDir} — missing error.tsx (error boundary for this route segment)`,
            suppressMatch: relDir,
            fix: {
              description:
                "Add error.tsx with 'use client' to gracefully handle errors in this route segment.",
            },
            reportedBy: ['next-missing-boundaries'],
          });
        }
      }

      const score = Math.max(20, 100 - issues.length * 15);

      return {
        id: 'next-missing-boundaries',
        category: this.category,
        name: 'Next.js Missing Boundaries',
        score,
        status: issues.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['next-missing-boundaries'],
        duration: elapsed(),
        metadata: {
          segmentsChecked,
          missingLoading,
          missingError,
        },
      };
    } catch (err) {
      return {
        id: 'next-missing-boundaries',
        category: this.category,
        name: 'Next.js Missing Boundaries',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['next-missing-boundaries'],
          },
        ],
        toolsUsed: ['next-missing-boundaries'],
        duration: elapsed(),
      };
    }
  }
}

function findPageDirs(dir: string, projectRoot: string, isRoot = true): string[] {
  const dirs: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const fullPath = join(dir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      // Check if this dir has a page file
      const hasPage =
        existsSync(join(fullPath, 'page.tsx')) || existsSync(join(fullPath, 'page.jsx'));
      if (hasPage) dirs.push(fullPath);
      // Recurse
      dirs.push(...findPageDirs(fullPath, projectRoot, false));
    }
  } catch (err) {
    if (isRoot) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw err;
    }
    /* directory doesn't exist or unreadable — skip */
  }
  return dirs;
}
