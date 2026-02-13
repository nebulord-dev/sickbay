import { execa } from 'execa';
import { BaseRunner } from './base.js';
import { timer, isCommandAvailable, fileExists, coreLocalDir, parseJsonOutput } from '../utils/file-helpers.js';
import type { CheckResult, Issue } from '../types.js';

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

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
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

      const args = ['--json', '--extensions', 'ts,tsx,js,jsx'];
      if (tsConfig) args.push('--ts-config', tsConfig);
      args.push('src');

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
        fix: { description: 'Refactor to break the circular dependency cycle' },
        reportedBy: ['madge'],
      }));

      return {
        id: 'madge',
        category: this.category,
        name: 'Circular Dependencies',
        score: circles.length === 0 ? 100 : Math.max(0, 100 - circles.length * 10),
        status: circles.length === 0 ? 'pass' : circles.length > 5 ? 'fail' : 'warning',
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
