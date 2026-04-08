import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

import { relativeFromRoot, timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

const CLEANUP_PATTERNS = [
  'takeUntilDestroyed(',
  'takeUntil(',
  'DestroyRef',
  'ngOnDestroy',
  '.unsubscribe(',
];

export class AngularSubscriptionsRunner extends BaseRunner {
  name = 'angular-subscriptions';
  category = 'code-quality' as const;
  applicableFrameworks = ['angular'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const files = findComponentFiles(join(projectPath, 'src'), projectPath);
      const leaky: string[] = [];

      for (const { relPath, fullPath } of files) {
        const content = readFileSync(fullPath, 'utf-8');
        if (content.includes('.subscribe(')) {
          const hasCleanup = CLEANUP_PATTERNS.some((p) => content.includes(p));
          if (!hasCleanup) {
            leaky.push(relPath);
          }
        }
      }

      const issues: Issue[] = leaky.map((file) => ({
        severity: 'warning' as const,
        message: `${file} — possible unguarded subscription (no takeUntilDestroyed, takeUntil, or ngOnDestroy found)`,
        file,
        suppressMatch: file,
        fix: {
          description:
            'Use `takeUntilDestroyed()` from `@angular/core/rxjs-interop` or call `.unsubscribe()` in `ngOnDestroy` to prevent memory leaks.',
        },
        reportedBy: ['angular-subscriptions'],
      }));

      const score = Math.max(20, 100 - leaky.length * 20);

      return {
        id: 'angular-subscriptions',
        category: this.category,
        name: 'Angular Subscriptions',
        score,
        status: leaky.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['angular-subscriptions'],
        duration: elapsed(),
        metadata: { filesScanned: files.length, leakyComponents: leaky.length },
      };
    } catch (err) {
      return {
        id: 'angular-subscriptions',
        category: this.category,
        name: 'Angular Subscriptions',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['angular-subscriptions'],
          },
        ],
        toolsUsed: ['angular-subscriptions'],
        duration: elapsed(),
      };
    }
  }
}

interface FileEntry {
  relPath: string;
  fullPath: string;
}

function findComponentFiles(dir: string, projectRoot: string, isRoot = true): FileEntry[] {
  const files: FileEntry[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const fullPath = join(dir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        files.push(...findComponentFiles(fullPath, projectRoot, false));
      } else if (entry.endsWith('.component.ts')) {
        files.push({ relPath: relativeFromRoot(projectRoot, fullPath), fullPath });
      }
    }
  } catch (err) {
    if (isRoot) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw err;
    }
  }
  return files;
}
