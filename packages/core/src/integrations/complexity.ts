import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { BaseRunner } from './base.js';
import { timer } from '../utils/file-helpers.js';
import type { CheckResult, Issue } from '../types.js';

/**
 * ComplexityRunner analyzes the source code files in the 'src' directory to identify files with high line counts, which can indicate complexity and maintenance challenges.
 * It reports files that exceed defined line thresholds, providing feedback on potential refactoring opportunities to improve code maintainability.
 * The runner also calculates overall statistics such as total lines of code and average lines per file to give a broader view of code complexity in the project.
 */

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']);
const WARN_LINES = 300;
const CRITICAL_LINES = 500;

interface FileStats {
  path: string;
  lines: number;
}

export class ComplexityRunner extends BaseRunner {
  name = 'complexity';
  category = 'code-quality' as const;

  async isApplicable(projectPath: string): Promise<boolean> {
    return existsSync(join(projectPath, 'src'));
  }

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const files = scanDirectory(join(projectPath, 'src'), projectPath);

      const oversized = files.filter((f) => f.lines >= WARN_LINES);
      const issues: Issue[] = oversized.map((f) => ({
        severity: (f.lines >= CRITICAL_LINES ? 'warning' : 'info') as Issue['severity'],
        message: `${f.path}: ${f.lines} lines — consider splitting into smaller modules`,
        fix: { description: 'Extract concerns into smaller, focused files' },
        reportedBy: ['complexity'],
      }));

      const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
      const avgLines = files.length > 0 ? Math.round(totalLines / files.length) : 0;
      const score = Math.max(0, 100 - oversized.length * 10);
      const topFiles = [...files].sort((a, b) => b.lines - a.lines).slice(0, 10);

      return {
        id: 'complexity',
        category: this.category,
        name: 'File Complexity',
        score,
        status: oversized.some((f) => f.lines >= CRITICAL_LINES) ? 'warning' : oversized.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['complexity'],
        duration: elapsed(),
        metadata: { totalFiles: files.length, totalLines, avgLines, oversizedCount: oversized.length, topFiles },
      };
    } catch (err) {
      return {
        id: 'complexity',
        category: this.category,
        name: 'File Complexity',
        score: 0,
        status: 'fail',
        issues: [{ severity: 'critical', message: `Complexity scan failed: ${err}`, reportedBy: ['complexity'] }],
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
      ) continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...scanDirectory(fullPath, projectRoot));
      } else if (SOURCE_EXTENSIONS.has(extname(entry)) && !isTestFile(entry)) {
        try {
          const lines = readFileSync(fullPath, 'utf-8').split('\n').filter((l) => l.trim()).length;
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
