export interface VitalsReport {
  timestamp: string;
  projectPath: string;
  projectInfo: ProjectInfo;
  checks: CheckResult[];
  overallScore: number;
  summary: {
    critical: number;
    warnings: number;
    info: number;
  };
}

export interface ProjectInfo {
  name: string;
  version: string;
  hasTypeScript: boolean;
  hasESLint: boolean;
  hasPrettier: boolean;
  framework: 'react' | 'next' | 'vite' | 'cra' | 'express' | 'fastify' | 'koa' | 'hapi' | 'node' | 'hono' | 'unknown';
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  totalDependencies: number;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface CheckResult {
  id: string;
  category: 'dependencies' | 'performance' | 'code-quality' | 'security' | 'git' | 'unknown-category';
  name: string;
  score: number;
  status: 'pass' | 'warning' | 'fail' | 'skipped';
  issues: Issue[];
  toolsUsed: string[];
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface Issue {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  file?: string;
  fix?: FixSuggestion;
  reportedBy: string[];
}

export interface FixSuggestion {
  command?: string;
  description: string;
  codeChange?: {
    before: string;
    after: string;
  };
}

export type Framework = 'react' | 'next' | 'angular' | 'vue' | 'svelte' | 'remix';
export type Runtime = 'browser' | 'node' | 'edge' | 'unknown';
export type BuildTool = 'vite' | 'webpack' | 'esbuild' | 'rollup' | 'tsc' | 'unknown';
export type TestFramework = 'vitest' | 'jest' | 'mocha' | null;

export interface ProjectContext {
  runtime: Runtime;
  frameworks: Framework[];
  buildTool: BuildTool;
  testFramework: TestFramework;
}

export interface ToolRunner {
  name: string;
  category: CheckResult['category'];
  run(projectPath: string, options?: RunOptions): Promise<CheckResult>;
  isApplicable(projectPath: string, context: ProjectContext): Promise<boolean>;
  isApplicableToContext(context: ProjectContext): boolean;
}

export interface RunOptions {
  verbose?: boolean;
  timeout?: number;
}

export interface ToolResult {
  tool: string;
  status: 'success' | 'error' | 'skipped';
  data: unknown;
  duration: number;
  error?: string;
}
