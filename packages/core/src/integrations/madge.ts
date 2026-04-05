import { existsSync } from 'fs';
import { join } from 'path';

import { execa } from 'execa';

import {
  timer,
  isCommandAvailable,
  fileExists,
  coreLocalDir,
  parseJsonOutput,
} from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue, RunOptions } from '../types.js';

interface MadgeThresholds {
  maxCircular?: number;
}

/**
 * MadgeRunner uses the madge tool to analyze the project's source code for circular dependencies.
 * It runs madge with a JSON reporter, parsing the output to build a dependency graph of the project.
 * The runner detects circular dependencies by performing a depth-first search on the graph, identifying cycles of imports between files.
 * It reports issues with actionable feedback on refactoring to break circular dependency cycles, helping to improve code maintainability and reduce potential bugs.
 * The runner calculates an overall score based on the number of circular dependencies found, providing insights into the project's code quality.
 */

type DependencyGraph = Record<string, string[]>;

function findCircularDeps(graph: DependencyGraph): string[][] {
  const circles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        circles.push(path.slice(cycleStart));
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);
    path.push(node);

    for (const dep of graph[node] ?? []) {
      dfs(dep, [...path]);
    }

    stack.delete(node);
  }

  for (const node of Object.keys(graph)) {
    dfs(node, []);
  }

  // Deduplicate cycles (same cycle can be found from different starting nodes)
  const seen = new Set<string>();
  return circles.filter((cycle) => {
    const sorted = [...cycle].sort().join('|');
    if (seen.has(sorted)) return false;
    seen.add(sorted);
    return true;
  });
}

export class MadgeRunner extends BaseRunner {
  name = 'madge';
  category = 'code-quality' as const;

  async run(projectPath: string, options?: RunOptions): Promise<CheckResult> {
    const elapsed = timer();
    const thresholds = options?.checkConfig?.thresholds as MadgeThresholds | undefined;
    const maxCircular = thresholds?.maxCircular ?? 5;
    const available = await isCommandAvailable('madge');

    if (!available) {
      return this.skipped('madge not installed — run: npm i -g madge');
    }

    try {
      // Vite projects use tsconfig.app.json for source files;
      // tsconfig.json often has "files": [] with project references only
      const tsConfig = fileExists(projectPath, 'tsconfig.app.json')
        ? 'tsconfig.app.json'
        : fileExists(projectPath, 'tsconfig.json')
          ? 'tsconfig.json'
          : null;

      const sourceDir =
        ['src', 'app', 'lib'].find((d) => existsSync(join(projectPath, d))) ?? 'src';

      const args = ['--json', '--extensions', 'ts,tsx,js,jsx'];
      if (tsConfig) args.push('--ts-config', tsConfig);
      args.push(sourceDir);

      const { stdout } = await execa('madge', args, {
        cwd: projectPath,
        reject: false,
        preferLocal: true,
        localDir: coreLocalDir,
      });

      let graph: DependencyGraph;
      try {
        graph = parseJsonOutput(stdout, '{}') as DependencyGraph;
      } catch {
        graph = {};
      }

      // Detect circular dependencies from the full graph
      const circles = findCircularDeps(graph);

      const issues: Issue[] = circles.map((cycle) => ({
        severity: 'warning' as const,
        message: `Circular dependency: ${cycle.join(' → ')}`,
        suppressMatch: cycle[0],
        fix: { description: 'Refactor to break the circular dependency cycle' },
        reportedBy: ['madge'],
      }));

      return {
        id: 'madge',
        category: this.category,
        name: 'Circular Dependencies',
        score: circles.length === 0 ? 100 : Math.max(0, 100 - circles.length * 10),
        status: circles.length === 0 ? 'pass' : circles.length > maxCircular ? 'fail' : 'warning',
        issues,
        toolsUsed: ['madge'],
        duration: elapsed(),
        metadata: { circularCount: circles.length, graph },
      };
    } catch (err) {
      return {
        id: 'madge',
        category: this.category,
        name: 'Circular Dependencies',
        score: 0,
        status: 'fail',
        issues: [{ severity: 'critical', message: `madge failed: ${err}`, reportedBy: ['madge'] }],
        toolsUsed: ['madge'],
        duration: elapsed(),
      };
    }
  }
}
