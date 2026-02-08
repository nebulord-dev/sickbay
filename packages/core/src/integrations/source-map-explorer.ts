import { execa } from 'execa';
import { BaseRunner } from './base.js';
import { timer, isCommandAvailable, fileExists, coreLocalDir } from '../utils/file-helpers.js';
import type { CheckResult, Issue } from '../types.js';

interface SmeOutput {
  files: Record<string, { size: number }>;
  totalBytes?: number;
}

const SIZE_THRESHOLD_WARN = 500 * 1024; // 500KB
const SIZE_THRESHOLD_FAIL = 1024 * 1024; // 1MB

export class SourceMapExplorerRunner extends BaseRunner {
  name = 'source-map-explorer';
  category = 'performance' as const;

  async isApplicable(projectPath: string): Promise<boolean> {
    return fileExists(projectPath, 'dist') || fileExists(projectPath, 'build');
  }

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const available = await isCommandAvailable('source-map-explorer');

    if (!available) {
      return this.skipped('source-map-explorer not installed — run: npm i -g source-map-explorer');
    }

    const buildDir = fileExists(projectPath, 'dist') ? 'dist' : 'build';

    try {
      const { stdout } = await execa(
        'source-map-explorer',
        [`${buildDir}/**/*.js`, '--json'],
        { cwd: projectPath, reject: false, preferLocal: true, localDir: coreLocalDir }
      );

      const data: SmeOutput = JSON.parse(stdout || '{"files":{}}');
      const totalBytes = data.totalBytes ?? Object.values(data.files).reduce((sum, f) => sum + f.size, 0);
      const totalKB = Math.round(totalBytes / 1024);

      const issues: Issue[] = [];
      if (totalBytes > SIZE_THRESHOLD_FAIL) {
        issues.push({
          severity: 'critical',
          message: `Bundle size is ${totalKB}KB — exceeds 1MB threshold`,
          fix: { description: 'Use code splitting and lazy imports to reduce bundle size' },
          reportedBy: ['source-map-explorer'],
        });
      } else if (totalBytes > SIZE_THRESHOLD_WARN) {
        issues.push({
          severity: 'warning',
          message: `Bundle size is ${totalKB}KB — consider optimizing`,
          fix: { description: 'Review large dependencies and consider tree-shaking' },
          reportedBy: ['source-map-explorer'],
        });
      }

      const score = totalBytes > SIZE_THRESHOLD_FAIL ? 40 : totalBytes > SIZE_THRESHOLD_WARN ? 70 : 100;

      return {
        id: 'source-map-explorer',
        category: this.category,
        name: 'Bundle Size',
        score,
        status: issues.length === 0 ? 'pass' : issues[0].severity === 'critical' ? 'fail' : 'warning',
        issues,
        toolsUsed: ['source-map-explorer'],
        duration: elapsed(),
        metadata: { totalBytes, totalKB, files: data.files },
      };
    } catch (err) {
      return {
        id: 'source-map-explorer',
        category: this.category,
        name: 'Bundle Size',
        score: 0,
        status: 'fail',
        issues: [{ severity: 'critical', message: `source-map-explorer failed: ${err}`, reportedBy: ['source-map-explorer'] }],
        toolsUsed: ['source-map-explorer'],
        duration: elapsed(),
      };
    }
  }
}
