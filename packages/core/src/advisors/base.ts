import type { Framework, ProjectContext, Recommendation } from '../types.js';

export abstract class BaseAdvisor {
  abstract name: string;
  abstract frameworks: readonly Framework[];

  abstract run(projectPath: string, context: ProjectContext): Promise<Recommendation[]>;

  isApplicableToContext(context: ProjectContext): boolean {
    return this.frameworks.some((f) => context.frameworks.includes(f));
  }
}
