import { timer } from '../utils/file-helpers.js';

import type {
  CheckResult,
  Framework,
  ProjectContext,
  Runtime,
  RunOptions,
  ToolRunner,
} from '../types.js';

export abstract class BaseRunner implements ToolRunner {
  abstract name: string;
  abstract category: CheckResult['category'];

  abstract run(projectPath: string, options?: RunOptions): Promise<CheckResult>;

  applicableFrameworks?: readonly Framework[];
  applicableRuntimes?: readonly Runtime[];

  isApplicableToContext(context: ProjectContext): boolean {
    if (this.applicableFrameworks) {
      const hasMatch = this.applicableFrameworks.some((f) => context.frameworks.includes(f));
      if (!hasMatch) return false;
    }
    if (this.applicableRuntimes) {
      if (!this.applicableRuntimes.includes(context.runtime)) return false;
    }
    return true;
  }

  async isApplicable(_projectPath: string, _context: ProjectContext): Promise<boolean> {
    return true;
  }

  protected elapsed = timer;

  protected skipped(reason: string): CheckResult {
    return {
      id: this.name,
      category: this.category,
      name: this.name,
      score: 100,
      status: 'skipped',
      issues: [],
      toolsUsed: [this.name],
      duration: 0,
      metadata: { reason },
    };
  }
}
