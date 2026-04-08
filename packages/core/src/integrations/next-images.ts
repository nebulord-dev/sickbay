import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

import { relativeFromRoot, timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

export class NextImagesRunner extends BaseRunner {
  name = 'next-images';
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
      const imgRegex = /<img[\s>]/;

      for (const { relPath, fullPath } of files) {
        const content = readFileSync(fullPath, 'utf-8');
        if (imgRegex.test(content)) {
          violations.push(relPath);
        }
      }

      const issues: Issue[] = violations.map((file) => ({
        severity: 'warning' as const,
        message: `${file} — raw image element; use next/image for automatic optimization`,
        file,
        suppressMatch: file,
        fix: {
          description:
            'Replace <img> with the <Image> component from next/image for automatic optimization, lazy loading, and Core Web Vitals improvements.',
        },
        reportedBy: ['next-images'],
      }));

      const score = Math.max(20, 100 - violations.length * 10);

      return {
        id: 'next-images',
        category: this.category,
        name: 'Next.js Image Optimization',
        score,
        status: violations.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['next-images'],
        duration: elapsed(),
        metadata: { filesScanned: files.length, violations: violations.length },
      };
    } catch (err) {
      return {
        id: 'next-images',
        category: this.category,
        name: 'Next.js Image Optimization',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['next-images'],
          },
        ],
        toolsUsed: ['next-images'],
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
