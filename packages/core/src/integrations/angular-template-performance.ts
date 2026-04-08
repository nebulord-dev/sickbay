import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

import { relativeFromRoot, timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

export class AngularTemplatePerformanceRunner extends BaseRunner {
  name = 'angular-template-performance';
  category = 'performance' as const;
  applicableFrameworks = ['angular'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const files = findComponentFiles(join(projectPath, 'src'), projectPath);
      const issues: Issue[] = [];

      for (const { relPath, fullPath } of files) {
        const content = readFileSync(fullPath, 'utf-8');

        // Extract inline template from @Component({ template: `...` })
        const templateMatch = content.match(/template\s*:\s*`([\s\S]*?)`/);
        const template = templateMatch?.[1] ?? '';

        // Check for *ngFor without trackBy
        checkNgForTrackBy(template, relPath, issues);

        // Check for @for without track
        checkForTrack(template, relPath, issues);

        // Check for function calls in interpolations and property bindings
        checkFunctionCalls(template, relPath, issues);
      }

      const score = Math.max(20, 100 - issues.length * 15);

      return {
        id: 'angular-template-performance',
        category: this.category,
        name: 'Angular Template Performance',
        score,
        status: issues.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['angular-template-performance'],
        duration: elapsed(),
        metadata: { filesScanned: files.length, violations: issues.length },
      };
    } catch (err) {
      return {
        id: 'angular-template-performance',
        category: this.category,
        name: 'Angular Template Performance',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['angular-template-performance'],
          },
        ],
        toolsUsed: ['angular-template-performance'],
        duration: elapsed(),
      };
    }
  }
}

function checkNgForTrackBy(template: string, relPath: string, issues: Issue[]): void {
  // Match *ngFor directives — the value may span the same line or be part of a multi-attribute element
  const ngForRegex = /\*ngFor\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = ngForRegex.exec(template)) !== null) {
    const directive = match[1];
    if (!directive.includes('trackBy')) {
      issues.push({
        severity: 'warning',
        message: `${relPath} — *ngFor without trackBy causes full list re-renders on any array change`,
        file: relPath,
        suppressMatch: relPath,
        fix: {
          description:
            'Add a trackBy function to the *ngFor directive (e.g. *ngFor="let item of items; trackBy: trackById").',
        },
        reportedBy: ['angular-template-performance'],
      });
    }
  }
}

function checkForTrack(template: string, relPath: string, issues: Issue[]): void {
  // Match @for blocks (Angular 17+ control flow)
  const forRegex = /@for\s*\(([^)]*)\)/g;
  let match;
  while ((match = forRegex.exec(template)) !== null) {
    const directive = match[1];
    if (!directive.includes('track')) {
      issues.push({
        severity: 'warning',
        message: `${relPath} — @for without track expression causes full list re-renders`,
        file: relPath,
        suppressMatch: relPath,
        fix: {
          description:
            'Add a track expression to the @for block (e.g. @for (item of items; track item.id)).',
        },
        reportedBy: ['angular-template-performance'],
      });
    }
  }
}

function checkFunctionCalls(template: string, relPath: string, issues: Issue[]): void {
  // Check interpolations: {{ someMethod() }}
  const interpolationRegex = /\{\{\s*(\w+)\s*\(/g;
  let match;
  while ((match = interpolationRegex.exec(template)) !== null) {
    const fnName = match[1];
    // Skip Angular built-ins and safe patterns
    if (fnName === '$any' || fnName === '$event') continue;
    issues.push({
      severity: 'warning',
      message: `${relPath} — function call \`${fnName}()\` in template re-runs on every change detection cycle`,
      file: relPath,
      suppressMatch: relPath,
      fix: {
        description:
          'Replace the function call with a pre-computed property, a pipe, or use memoization to avoid re-execution on every change detection cycle.',
      },
      reportedBy: ['angular-template-performance'],
    });
  }

  // Check property bindings: [attr]="someMethod()" but NOT (event)="handler()"
  const bindingRegex = /\[(\w+)\]\s*=\s*"(\w+)\s*\(/g;
  while ((match = bindingRegex.exec(template)) !== null) {
    const fnName = match[2];
    if (fnName === '$any' || fnName === '$event') continue;
    issues.push({
      severity: 'warning',
      message: `${relPath} — function call \`${fnName}()\` in property binding re-runs on every change detection cycle`,
      file: relPath,
      suppressMatch: relPath,
      fix: {
        description:
          'Replace the function call with a pre-computed property, a pipe, or use memoization to avoid re-execution on every change detection cycle.',
      },
      reportedBy: ['angular-template-performance'],
    });
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
