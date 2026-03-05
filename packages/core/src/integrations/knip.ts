import { execa } from 'execa';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { BaseRunner } from './base.js';
import { timer, isCommandAvailable, coreLocalDir, parseJsonOutput } from '../utils/file-helpers.js';
import type { CheckResult, Issue } from '../types.js';

// Packages that are only ever imported in test files — knip flags them as unused
// when test files are excluded from its entry points, which is a false positive.
const TEST_ONLY_PACKAGE_PREFIXES = ['@testing-library/'];
const TEST_RUNNER_PACKAGES = ['vitest', 'jest', '@jest/core', '@jest/globals'];

/**
 * KnipRunner uses the Knip tool to analyze the project's source code for unused files, dependencies, devDependencies, exports, and types.
 * It runs Knip with a JSON reporter, parsing the output to identify various types of unused code and dependencies.
 * The runner reports issues with actionable feedback, including commands to remove unused files and dependencies, helping to clean up the project and reduce bloat.
 * It calculates an overall score based on the number of issues found, providing insights into the level of unused code in the project.
 */

interface KnipItem { name: string; }

interface KnipFileIssue {
  file: string;
  dependencies?: KnipItem[];
  devDependencies?: KnipItem[];
  exports?: KnipItem[];
  types?: KnipItem[];
}

interface KnipOutput {
  files?: string[];
  issues?: KnipFileIssue[];
}

export class KnipRunner extends BaseRunner {
  name = 'knip';
  category = 'dependencies' as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const available = await isCommandAvailable('knip');

    if (!available) {
      return this.skipped('knip not installed — run: npm i -g knip');
    }

    try {
      const { stdout } = await execa('knip', ['--reporter', 'json', '--no-progress'], {
        cwd: projectPath,
        reject: false,
        preferLocal: true,
        localDir: coreLocalDir,
      });

      const data = parseJsonOutput(stdout, '{}') as KnipOutput;
      const issues: Issue[] = [];

      // Unused files
      (data.files ?? []).forEach((f) =>
        issues.push({
          severity: 'warning',
          message: `Unused file: ${f}`,
          file: f,
          fix: { description: `Remove ${f}`, command: `rm ${f}` },
          reportedBy: ['knip'],
        })
      );

      // Per-file issues
      // Detect whether the project has a test runner — used to suppress false
      // positives for test-only devDeps that knip can't see when test files
      // are excluded from its entry points.
      let hasTestRunner = false;
      const pkgPath = join(projectPath, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        hasTestRunner = TEST_RUNNER_PACKAGES.some((p) => p in allDeps);
      }

      const deps = new Set<string>();
      const devDeps = new Set<string>();
      const unusedExports: string[] = [];

      for (const fileIssue of data.issues ?? []) {
        (fileIssue.dependencies ?? []).forEach((d) => deps.add(d.name));
        (fileIssue.devDependencies ?? []).forEach((d) => {
          // Filter test-only packages when a test runner is present — these are
          // false positives caused by test files being excluded from knip analysis.
          const isTestOnly = TEST_ONLY_PACKAGE_PREFIXES.some((prefix) =>
            d.name.startsWith(prefix)
          );
          if (!isTestOnly || !hasTestRunner) devDeps.add(d.name);
        });
        (fileIssue.exports ?? []).forEach((e) =>
          unusedExports.push(`${fileIssue.file}: ${e.name}`)
        );
      }

      deps.forEach((dep) =>
        issues.push({
          severity: 'warning',
          message: `Unused dependency: ${dep}`,
          fix: { description: `Remove ${dep}`, command: `npm uninstall ${dep}` },
          reportedBy: ['knip'],
        })
      );

      devDeps.forEach((dep) =>
        issues.push({
          severity: 'info',
          message: `Unused devDependency: ${dep}`,
          fix: { description: `Remove ${dep}`, command: `npm uninstall -D ${dep}` },
          reportedBy: ['knip'],
        })
      );

      unusedExports.slice(0, 5).forEach((exp) =>
        issues.push({
          severity: 'info',
          message: `Unused export: ${exp}`,
          reportedBy: ['knip'],
        })
      );
      if (unusedExports.length > 5) {
        issues.push({
          severity: 'info',
          message: `...and ${unusedExports.length - 5} more unused exports`,
          reportedBy: ['knip'],
        });
      }

      const totalIssues = issues.length;
      const score = Math.max(0, 100 - totalIssues * 5);

      return {
        id: 'knip',
        category: this.category,
        name: 'Unused Code',
        score,
        status: totalIssues === 0 ? 'pass' : totalIssues > 10 ? 'fail' : 'warning',
        issues,
        toolsUsed: ['knip'],
        duration: elapsed(),
        metadata: {
          unusedFiles: data.files?.length ?? 0,
          unusedDeps: deps.size,
          unusedDevDeps: devDeps.size,
          unusedExports: unusedExports.length,
        },
      };
    } catch (err) {
      return {
        id: 'knip',
        category: this.category,
        name: 'Unused Code',
        score: 0,
        status: 'fail',
        issues: [{ severity: 'critical', message: `knip failed: ${err}`, reportedBy: ['knip'] }],
        toolsUsed: ['knip'],
        duration: elapsed(),
      };
    }
  }
}
