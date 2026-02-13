import { execa } from 'execa';
import { BaseRunner } from './base.js';
import { timer, isCommandAvailable, coreLocalDir, parseJsonOutput } from '../utils/file-helpers.js';
import type { CheckResult, Issue } from '../types.js';

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
      const deps = new Set<string>();
      const devDeps = new Set<string>();
      const unusedExports: string[] = [];

      for (const fileIssue of data.issues ?? []) {
        (fileIssue.dependencies ?? []).forEach((d) => deps.add(d.name));
        (fileIssue.devDependencies ?? []).forEach((d) => devDeps.add(d.name));
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
