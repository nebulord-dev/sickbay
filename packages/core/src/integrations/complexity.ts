import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';

import { timer } from '../utils/file-helpers.js';
import { classifyFile, getFileTypeLabel, FILE_TYPE_THRESHOLDS } from '../utils/file-types.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue, RunOptions } from '../types.js';
import type { FileType } from '../utils/file-types.js';

/**
 * ComplexityRunner analyzes the source code files in the 'src' directory to identify files with high line counts, which can indicate complexity and maintenance challenges.
 * It reports files that exceed defined line thresholds, providing feedback on potential refactoring opportunities to improve code maintainability.
 * The runner also calculates overall statistics such as total lines of code and average lines per file to give a broader view of code complexity in the project.
 */

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']);

interface FileStats {
  path: string;
  lines: number;
}

const SOURCE_DIRS = ['src', 'app', 'lib'];

export class ComplexityRunner extends BaseRunner {
  name = 'complexity';
  category = 'code-quality' as const;

  async isApplicable(projectPath: string): Promise<boolean> {
    return SOURCE_DIRS.some((dir) => existsSync(join(projectPath, dir)));
  }

  async run(projectPath: string, options?: RunOptions): Promise<CheckResult> {
    const elapsed = timer();
    const userThresholds = options?.checkConfig?.thresholds as
      | Partial<Record<FileType, { warn?: number; critical?: number }>>
      | undefined;

    // Merge user thresholds with defaults
    const mergedThresholds = { ...FILE_TYPE_THRESHOLDS };
    if (userThresholds) {
      for (const [key, overrides] of Object.entries(userThresholds)) {
        const ft = key as FileType;
        if (mergedThresholds[ft] && overrides) {
          mergedThresholds[ft] = {
            warn: overrides.warn ?? mergedThresholds[ft].warn,
            critical: overrides.critical ?? mergedThresholds[ft].critical,
          };
        }
      }
    }

    const resolveThresholds = (filePath: string) => {
      const fileType = classifyFile(filePath);
      return { ...mergedThresholds[fileType], fileType };
    };

    try {
      const files = SOURCE_DIRS.flatMap((dir) =>
        existsSync(join(projectPath, dir))
          ? scanDirectory(join(projectPath, dir), projectPath)
          : [],
      );

      const issues: Issue[] = [];
      let oversizedCount = 0;

      for (const f of files) {
        const { warn, critical, fileType } = resolveThresholds(f.path);
        if (f.lines >= warn) {
          oversizedCount++;
          const label = getFileTypeLabel(fileType);
          issues.push({
            severity: (f.lines >= critical ? 'warning' : 'info') as Issue['severity'],
            message: `${f.path} (${label}): ${f.lines} lines — consider splitting (threshold: ${warn})`,
            fix: { description: 'Extract concerns into smaller, focused files' },
            reportedBy: ['complexity'],
          });
        }
      }

      const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
      const avgLines = files.length > 0 ? Math.round(totalLines / files.length) : 0;
      const score = Math.max(0, 100 - oversizedCount * 10);
      const topFiles = [...files]
        .sort((a, b) => b.lines - a.lines)
        .slice(0, 10)
        .map((f) => {
          const { warn, critical, fileType } = resolveThresholds(f.path);
          return { ...f, fileType, warn, critical };
        });

      return {
        id: 'complexity',
        category: this.category,
        name: 'File Complexity',
        score,
        status: issues.some((i) => i.severity === 'warning')
          ? 'warning'
          : oversizedCount > 0
            ? 'warning'
            : 'pass',
        issues,
        toolsUsed: ['complexity'],
        duration: elapsed(),
        metadata: {
          totalFiles: files.length,
          totalLines,
          avgLines,
          oversizedCount,
          topFiles,
        },
      };
    } catch (err) {
      return {
        id: 'complexity',
        category: this.category,
        name: 'File Complexity',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Complexity scan failed: ${err}`,
            reportedBy: ['complexity'],
          },
        ],
        toolsUsed: ['complexity'],
        duration: elapsed(),
      };
    }
  }
}

function scanDirectory(dir: string, projectRoot: string): FileStats[] {
  const files: FileStats[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (
        entry.startsWith('.') ||
        entry === 'node_modules' ||
        entry === '__tests__' ||
        entry === 'test' ||
        entry === 'tests'
      )
        continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...scanDirectory(fullPath, projectRoot));
      } else if (SOURCE_EXTENSIONS.has(extname(entry)) && !isTestFile(entry)) {
        try {
          const lines = readFileSync(fullPath, 'utf-8')
            .split('\n')
            .filter((l) => l.trim()).length;
          files.push({ path: fullPath.replace(projectRoot + '/', ''), lines });
        } catch {
          // skip unreadable files
        }
      }
    }
  } catch {
    // directory doesn't exist
  }
  return files;
}

function isTestFile(filename: string): boolean {
  return /\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$/.test(filename);
}
