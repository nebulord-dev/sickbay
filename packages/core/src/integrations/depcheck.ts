import { execa } from 'execa';
import { BaseRunner } from './base.js';
import { timer, isCommandAvailable, coreLocalDir, parseJsonOutput } from '../utils/file-helpers.js';
import type { CheckResult, Issue } from '../types.js';

interface DepcheckOutput {
  dependencies?: string[];
  devDependencies?: string[];
  missing?: Record<string, string[]>;
}

export class DepcheckRunner extends BaseRunner {
  name = 'depcheck';
  category = 'dependencies' as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const available = await isCommandAvailable('depcheck');

    if (!available) {
      return this.skipped('depcheck not installed — run: npm i -g depcheck');
    }

    try {
      const { stdout } = await execa('depcheck', ['--json'], {
        cwd: projectPath,
        reject: false,
        preferLocal: true,
        localDir: coreLocalDir,
      });

      const data = parseJsonOutput(stdout, '{}') as DepcheckOutput;
      const issues: Issue[] = [];

      // Skip reporting unused dependencies - Knip handles this more comprehensively
      // We focus on missing dependencies, which Knip doesn't detect

      for (const [dep, files] of Object.entries(data.missing ?? {})) {
        // Skip virtual modules (Vite, Rollup, etc.) and built-in Node modules
        if (dep.startsWith('virtual:') || dep.startsWith('node:')) {
          continue;
        }

        issues.push({
          severity: 'critical',
          message: `Missing dependency: ${dep} (used in ${files.length} file${files.length > 1 ? 's' : ''})`,
          fix: { description: `Install ${dep}`, command: `npm install ${dep}` },
          reportedBy: ['depcheck'],
        });
      }

      const score = Math.max(0, 100 - issues.length * 5);

      return {
        id: 'depcheck',
        category: this.category,
        name: 'Dependency Health',
        score,
        status: (data.missing && Object.keys(data.missing).length > 0) ? 'fail' : issues.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['depcheck'],
        duration: elapsed(),
        metadata: {
          unused: data.dependencies?.length ?? 0,
          missing: Object.keys(data.missing ?? {}).length,
        },
      };
    } catch (err) {
      return {
        id: 'depcheck',
        category: this.category,
        name: 'Dependency Health',
        score: 0,
        status: 'fail',
        issues: [{ severity: 'critical', message: `depcheck failed: ${err}`, reportedBy: ['depcheck'] }],
        toolsUsed: ['depcheck'],
        duration: elapsed(),
      };
    }
  }
}
