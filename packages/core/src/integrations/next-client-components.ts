import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

import { timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

export class NextClientComponentsRunner extends BaseRunner {
  name = 'next-client-components';
  category = 'performance' as const;
  applicableFrameworks = ['next'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const files = [
        ...findJsxFiles(join(projectPath, 'app'), projectPath),
        ...findJsxFiles(join(projectPath, 'src'), projectPath),
      ];

      const unnecessary: string[] = [];
      let clientCount = 0;

      for (const { relPath, fullPath } of files) {
        const content = readFileSync(fullPath, 'utf-8');
        const trimmed = content.trim();

        // Check if file starts with "use client" directive
        const isUseClient =
          trimmed.startsWith('"use client"') || trimmed.startsWith("'use client'");

        if (!isUseClient) {
          continue;
        }

        clientCount++;

        // Check for hooks
        const hasHooks =
          /\b(useState|useEffect|useRef|useCallback|useMemo|useContext|useReducer)\b/.test(
            content
          );

        // Check for event handlers: /\bon[A-Z][a-zA-Z]*\s*=\s*\{/
        const hasEventHandlers = /\bon[A-Z][a-zA-Z]*\s*=\s*\{/.test(content);

        if (!hasHooks && !hasEventHandlers) {
          unnecessary.push(relPath);
        }
      }

      const issues: Issue[] = unnecessary.map((file) => ({
        severity: 'warning' as const,
        message: `${file} — may not need 'use client' (no hooks or event handlers detected)`,
        file,
        fix: {
          description:
            "This component may not need 'use client' — it contains no hooks or event handlers. Moving it to a Server Component reduces client bundle size.",
        },
        reportedBy: ['next-client-components'],
      }));

      const score = Math.max(20, 100 - unnecessary.length * 15);

      return {
        id: 'next-client-components',
        category: this.category,
        name: 'Next.js Client Components',
        score,
        status: unnecessary.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['next-client-components'],
        duration: elapsed(),
        metadata: {
          filesScanned: files.length,
          clientFiles: clientCount,
          unnecessaryClientFiles: unnecessary.length,
        },
      };
    } catch (err) {
      return {
        id: 'next-client-components',
        category: this.category,
        name: 'Next.js Client Components',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['next-client-components'],
          },
        ],
        toolsUsed: ['next-client-components'],
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
        files.push({ relPath: fullPath.replace(projectRoot + '/', ''), fullPath });
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
