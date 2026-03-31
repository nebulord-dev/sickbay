import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

import { timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

export class AngularChangeDetectionRunner extends BaseRunner {
  name = 'angular-change-detection';
  category = 'performance' as const;
  applicableFrameworks = ['angular'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const files = findComponentFiles(join(projectPath, 'src'), projectPath);
      const missing: string[] = [];

      for (const { relPath, fullPath } of files) {
        const content = readFileSync(fullPath, 'utf-8');
        if (
          content.includes('@Component(') &&
          !content.includes('ChangeDetectionStrategy.OnPush')
        ) {
          missing.push(relPath);
        }
      }

      const issues: Issue[] = missing.map((file) => ({
        severity: 'warning' as const,
        message: `${file} — component missing OnPush change detection`,
        file,
        fix: {
          description:
            'Add `changeDetection: ChangeDetectionStrategy.OnPush` to the @Component decorator to prevent unnecessary re-renders.',
        },
        reportedBy: ['angular-change-detection'],
      }));

      const score = Math.max(20, 100 - missing.length * 15);

      return {
        id: 'angular-change-detection',
        category: this.category,
        name: 'Angular Change Detection',
        score,
        status: missing.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['angular-change-detection'],
        duration: elapsed(),
        metadata: { filesScanned: files.length, missingOnPush: missing.length },
      };
    } catch (err) {
      return {
        id: 'angular-change-detection',
        category: this.category,
        name: 'Angular Change Detection',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['angular-change-detection'],
          },
        ],
        toolsUsed: ['angular-change-detection'],
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
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...findComponentFiles(fullPath, projectRoot, false));
      } else if (entry.endsWith('.component.ts')) {
        files.push({ relPath: fullPath.replace(projectRoot + '/', ''), fullPath });
      }
    }
  } catch (err) {
    if (isRoot) throw err;
    /* subdirectory doesn't exist or unreadable — skip */
  }
  return files;
}
