import type { CheckResult, ProjectInfo, RunOptions, ToolRunner } from '../types.js';
import { timer } from '../utils/file-helpers.js';

export abstract class BaseRunner implements ToolRunner {
  abstract name: string;
  abstract category: CheckResult['category'];

  abstract run(projectPath: string, options?: RunOptions): Promise<CheckResult>;

  async isApplicable(_projectPath: string, _info: ProjectInfo): Promise<boolean> {
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
