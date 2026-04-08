import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

import { relativeFromRoot, timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

const INTERNAL_LINK_REGEX = /<a\s[^>]*href=["'](\/|\.\/)/;

export class NextLinkRunner extends BaseRunner {
  name = 'next-link';
  category = 'performance' as const;
  applicableFrameworks = ['next'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const files = [
        ...findJsxFiles(join(projectPath, 'app'), projectPath),
        ...findJsxFiles(join(projectPath, 'src'), projectPath),
      ];

      const violations: string[] = [];

      for (const { relPath, fullPath } of files) {
        const content = readFileSync(fullPath, 'utf-8');
        if (INTERNAL_LINK_REGEX.test(content)) {
          violations.push(relPath);
        }
      }

      const issues: Issue[] = violations.map((file) => ({
        severity: 'warning' as const,
        message: `${file} — raw anchor tag for internal navigation; use next/link`,
        file,
        suppressMatch: file,
        fix: {
          description:
            'Replace <a href="/path"> with <Link href="/path"> from next/link to enable client-side navigation and prefetching.',
        },
        reportedBy: ['next-link'],
      }));

      const score = Math.max(20, 100 - violations.length * 15);

      return {
        id: 'next-link',
        category: this.category,
        name: 'Next.js Link Usage',
        score,
        status: violations.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['next-link'],
        duration: elapsed(),
        metadata: { filesScanned: files.length, violations: violations.length },
      };
    } catch (err) {
      return {
        id: 'next-link',
        category: this.category,
        name: 'Next.js Link Usage',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['next-link'],
          },
        ],
        toolsUsed: ['next-link'],
        duration: elapsed(),
      };
    }
  }
}

interface FileEntry {
  relPath: string;
  fullPath: string;
}

function findJsxFiles(dir: string, projectRoot: string, isRoot = true): FileEntry[] {
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
        files.push(...findJsxFiles(fullPath, projectRoot, false));
      } else if (entry.endsWith('.tsx') || entry.endsWith('.jsx')) {
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
