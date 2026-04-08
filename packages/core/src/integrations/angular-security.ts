import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

import { relativeFromRoot, timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

const BYPASS_METHODS = [
  'bypassSecurityTrustHtml(',
  'bypassSecurityTrustScript(',
  'bypassSecurityTrustUrl(',
  'bypassSecurityTrustResourceUrl(',
  'bypassSecurityTrustStyle(',
];

export class AngularSecurityRunner extends BaseRunner {
  name = 'angular-security';
  category = 'security' as const;
  applicableFrameworks = ['angular'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const files = findSourceFiles(join(projectPath, 'src'), projectPath);
      const issues: Issue[] = [];

      for (const { relPath, fullPath } of files) {
        const content = readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          for (const method of BYPASS_METHODS) {
            if (line.includes(method)) {
              issues.push({
                severity: 'warning',
                message: `${relPath}:${i + 1} — DomSanitizer ${method.slice(0, -1)}() bypasses XSS protection`,
                file: relPath,
                suppressMatch: relPath,
                fix: {
                  description:
                    "Avoid bypassing Angular's built-in sanitization. Use safe values or sanitize input before rendering.",
                },
                reportedBy: ['angular-security'],
              });
            }
          }

          if (line.includes('[innerHTML]')) {
            issues.push({
              severity: 'warning',
              message: `${relPath}:${i + 1} — [innerHTML] binding is a potential XSS vector if content is user-controlled`,
              file: relPath,
              suppressMatch: relPath,
              fix: {
                description:
                  "Prefer Angular's built-in text interpolation or use DomSanitizer explicitly when innerHTML is required.",
              },
              reportedBy: ['angular-security'],
            });
          }
        }
      }

      const score = Math.max(20, 100 - issues.length * 20);

      return {
        id: 'angular-security',
        category: this.category,
        name: 'Angular Security',
        score,
        status: issues.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['angular-security'],
        duration: elapsed(),
        metadata: { filesScanned: files.length, violations: issues.length },
      };
    } catch (err) {
      return {
        id: 'angular-security',
        category: this.category,
        name: 'Angular Security',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['angular-security'],
          },
        ],
        toolsUsed: ['angular-security'],
        duration: elapsed(),
      };
    }
  }
}

interface FileEntry {
  relPath: string;
  fullPath: string;
}

function findSourceFiles(dir: string, projectRoot: string, isRoot = true): FileEntry[] {
  const files: FileEntry[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...findSourceFiles(fullPath, projectRoot, false));
      } else if (entry.endsWith('.ts') || entry.endsWith('.html')) {
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
