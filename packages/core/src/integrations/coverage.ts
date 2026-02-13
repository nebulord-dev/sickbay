import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execa } from 'execa';
import { BaseRunner } from './base.js';
import { timer, readPackageJson, parseJsonOutput } from '../utils/file-helpers.js';
import type { CheckResult, Issue } from '../types.js';

interface CoverageSummary {
  total: {
    lines: { pct: number };
    statements: { pct: number };
    functions: { pct: number };
    branches: { pct: number };
  };
}

interface VitestJsonResult {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numSkippedTests?: number;
  success?: boolean;
}

const COVERAGE_PATHS = [
  'coverage/coverage-summary.json',
  'coverage/coverage-final.json',
];

export class CoverageRunner extends BaseRunner {
  name = 'coverage';
  category = 'code-quality' as const;

  async isApplicable(projectPath: string): Promise<boolean> {
    return (
      COVERAGE_PATHS.some((p) => existsSync(join(projectPath, p))) ||
      this.detectTestRunner(projectPath) !== null
    );
  }

  private detectTestRunner(projectPath: string): 'vitest' | 'jest' | null {
    try {
      const pkg = readPackageJson(projectPath) as Record<string, Record<string, string>>;
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      if ('vitest' in deps) return 'vitest';
      if ('jest' in deps || '@jest/core' in deps) return 'jest';
    } catch {
      // ignore
    }
    return null;
  }

  private hasCoverageProvider(projectPath: string, runner: 'vitest' | 'jest'): boolean {
    if (runner === 'vitest') {
      return (
        existsSync(join(projectPath, 'node_modules', '@vitest', 'coverage-v8')) ||
        existsSync(join(projectPath, 'node_modules', '@vitest', 'coverage-istanbul'))
      );
    }
    // jest has built-in coverage via babel or v8
    return true;
  }

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const runner = this.detectTestRunner(projectPath);

    // No test runner — fall back to reading existing coverage report
    if (!runner) {
      return this.readExistingCoverage(projectPath, elapsed);
    }

    try {
      const hasCoverage = this.hasCoverageProvider(projectPath, runner);
      const args = runner === 'vitest'
        ? ['run', '--reporter=json', ...(hasCoverage ? ['--coverage', '--coverage.reporter=json-summary'] : [])]
        : ['--json', ...(hasCoverage ? ['--coverage'] : [])];

      const { stdout } = await execa(runner, args, {
        cwd: projectPath,
        reject: false,
        preferLocal: true,
        timeout: 120_000,
      });

      // Parse test results from JSON stdout
      let testCounts = { total: 0, passed: 0, failed: 0, skipped: 0 };
      try {
        const parsed = parseJsonOutput(stdout, '{}') as VitestJsonResult;
        testCounts = {
          total: parsed.numTotalTests ?? 0,
          passed: parsed.numPassedTests ?? 0,
          failed: parsed.numFailedTests ?? 0,
          skipped: parsed.numSkippedTests ?? 0,
        };
      } catch {
        // JSON parse failed — tests might have errored badly
      }

      // Read coverage report if generated
      const coveragePath = COVERAGE_PATHS.map((p) => join(projectPath, p)).find(existsSync);
      let coverageData: CoverageSummary['total'] | null = null;
      if (coveragePath) {
        try {
          const raw = JSON.parse(readFileSync(coveragePath, 'utf-8'));
          coverageData = raw.total ?? raw;
        } catch {
          // ignore parse error
        }
      }

      return this.buildResult(elapsed, testCounts, coverageData, runner, hasCoverage);
    } catch (err) {
      return {
        id: 'coverage',
        category: this.category,
        name: 'Tests & Coverage',
        score: 0,
        status: 'fail',
        issues: [{ severity: 'critical', message: `Test run failed: ${err}`, reportedBy: ['coverage'] }],
        toolsUsed: [runner],
        duration: elapsed(),
      };
    }
  }

  private buildResult(
    elapsed: () => number,
    counts: { total: number; passed: number; failed: number; skipped: number },
    coverage: CoverageSummary['total'] | null,
    runner: string,
    hasCoverage: boolean,
  ): CheckResult {
    const issues: Issue[] = [];

    if (counts.failed > 0) {
      issues.push({
        severity: 'critical',
        message: `${counts.failed} test${counts.failed > 1 ? 's' : ''} failing (${counts.passed}/${counts.total} passing)`,
        fix: { description: 'Fix failing tests', command: `${runner} run` },
        reportedBy: ['coverage'],
      });
    }

    if (coverage) {
      if (coverage.lines.pct < 80) {
        issues.push({
          severity: coverage.lines.pct < 50 ? 'critical' : 'warning',
          message: `Line coverage: ${coverage.lines.pct.toFixed(1)}% (target: 80%)`,
          fix: { description: 'Add tests to improve coverage', command: `${runner} run --coverage` },
          reportedBy: ['coverage'],
        });
      }
      if (coverage.functions.pct < 80) {
        issues.push({
          severity: 'warning',
          message: `Function coverage: ${coverage.functions.pct.toFixed(1)}% (target: 80%)`,
          fix: { description: 'Add tests for uncovered functions' },
          reportedBy: ['coverage'],
        });
      }
    } else if (!hasCoverage && counts.total > 0) {
      issues.push({
        severity: 'info',
        message: 'Coverage data unavailable — install @vitest/coverage-v8 for coverage reporting',
        fix: { description: 'Add coverage provider', command: 'npm install -D @vitest/coverage-v8' },
        reportedBy: ['coverage'],
      });
    }

    // Score: weight test failures heavily, coverage secondary
    let score = 100;
    if (counts.total > 0 && counts.failed > 0) {
      score = Math.round(100 * (counts.passed / counts.total));
    }
    if (coverage) {
      const covAvg = (coverage.lines.pct + coverage.statements.pct + coverage.functions.pct + coverage.branches.pct) / 4;
      score = Math.round(score * 0.6 + covAvg * 0.4);
    }

    const status = counts.failed > 0 ? 'fail'
      : (coverage && coverage.lines.pct < 50) ? 'fail'
      : (coverage && coverage.lines.pct < 80) ? 'warning'
      : issues.length > 0 ? 'warning'
      : 'pass';

    return {
      id: 'coverage',
      category: this.category,
      name: 'Tests & Coverage',
      score,
      status,
      issues,
      toolsUsed: [runner],
      duration: elapsed(),
      metadata: {
        testRunner: runner,
        totalTests: counts.total,
        passed: counts.passed,
        failed: counts.failed,
        skipped: counts.skipped,
        ...(coverage ? {
          lines: coverage.lines.pct,
          statements: coverage.statements.pct,
          functions: coverage.functions.pct,
          branches: coverage.branches.pct,
        } : {}),
      },
    };
  }

  private readExistingCoverage(projectPath: string, elapsed: () => number): CheckResult {
    const coveragePath = COVERAGE_PATHS.map((p) => join(projectPath, p)).find(existsSync);
    if (!coveragePath) {
      return this.skipped('No test runner or coverage report found');
    }
    try {
      const raw = JSON.parse(readFileSync(coveragePath, 'utf-8'));
      const { lines, statements, functions, branches } = raw.total ?? raw;
      const avg = (lines.pct + statements.pct + functions.pct + branches.pct) / 4;
      const issues: Issue[] = [];
      if (lines.pct < 80) {
        issues.push({
          severity: lines.pct < 50 ? 'critical' : 'warning',
          message: `Line coverage: ${lines.pct.toFixed(1)}% (target: 80%)`,
          reportedBy: ['coverage'],
        });
      }
      return {
        id: 'coverage',
        category: this.category,
        name: 'Tests & Coverage',
        score: Math.round(avg),
        status: avg >= 80 ? 'pass' : avg >= 50 ? 'warning' : 'fail',
        issues,
        toolsUsed: ['coverage'],
        duration: elapsed(),
        metadata: { lines: lines.pct, statements: statements.pct, functions: functions.pct, branches: branches.pct },
      };
    } catch (err) {
      return {
        id: 'coverage',
        category: this.category,
        name: 'Tests & Coverage',
        score: 0,
        status: 'fail',
        issues: [{ severity: 'critical', message: `Failed to parse coverage: ${err}`, reportedBy: ['coverage'] }],
        toolsUsed: ['coverage'],
        duration: elapsed(),
      };
    }
  }
}
