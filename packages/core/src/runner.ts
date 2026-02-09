import type { VitalsReport, CheckResult, ToolRunner } from './types.js';
import { detectProject } from './utils/detect-project.js';
import { calculateOverallScore, buildSummary } from './scoring.js';
import { KnipRunner } from './integrations/knip.js';
import { OutdatedRunner } from './integrations/outdated.js';
import { NpmAuditRunner } from './integrations/npm-audit.js';
import { DepcheckRunner } from './integrations/depcheck.js';
import { MadgeRunner } from './integrations/madge.js';
import { SourceMapExplorerRunner } from './integrations/source-map-explorer.js';
import { CoverageRunner } from './integrations/coverage.js';
import { LicenseCheckerRunner } from './integrations/license-checker.js';
import { JscpdRunner } from './integrations/jscpd.js';
import { GitRunner } from './integrations/git.js';
import { ESLintRunner } from './integrations/eslint.js';
import { TypeScriptRunner } from './integrations/typescript.js';
import { TodoScannerRunner } from './integrations/todo-scanner.js';
import { ComplexityRunner } from './integrations/complexity.js';
import { SecretsRunner } from './integrations/secrets.js';
import { HeavyDepsRunner } from './integrations/heavy-deps.js';
import { ReactPerfRunner } from './integrations/react-perf.js';
import { AssetSizeRunner } from './integrations/asset-size.js';

export interface RunnerOptions {
  projectPath?: string;
  checks?: string[];
  verbose?: boolean;
  onCheckStart?: (name: string) => void;
  onCheckComplete?: (result: CheckResult) => void;
}

const ALL_RUNNERS: ToolRunner[] = [
  new KnipRunner(),
  new DepcheckRunner(),
  new OutdatedRunner(),
  new NpmAuditRunner(),
  new MadgeRunner(),
  new SourceMapExplorerRunner(),
  new CoverageRunner(),
  new LicenseCheckerRunner(),
  new JscpdRunner(),
  new GitRunner(),
  new ESLintRunner(),
  new TypeScriptRunner(),
  new TodoScannerRunner(),
  new ComplexityRunner(),
  new SecretsRunner(),
  new HeavyDepsRunner(),
  new ReactPerfRunner(),
  new AssetSizeRunner(),
];

export async function runVitals(options: RunnerOptions = {}): Promise<VitalsReport> {
  const projectPath = options.projectPath ?? process.cwd();
  const projectInfo = await detectProject(projectPath);

  const runners = options.checks
    ? ALL_RUNNERS.filter((r) => options.checks!.includes(r.name))
    : ALL_RUNNERS;

  const checks: CheckResult[] = [];

  // Run all checks concurrently
  const results = await Promise.allSettled(
    runners.map(async (runner) => {
      const applicable = await runner.isApplicable(projectPath, projectInfo);
      if (!applicable) return null;

      options.onCheckStart?.(runner.name);
      const result = await runner.run(projectPath, { verbose: options.verbose });
      options.onCheckComplete?.(result);
      return result;
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      checks.push(result.value);
    }
  }

  const overallScore = calculateOverallScore(checks);
  const summary = buildSummary(checks);

  return {
    timestamp: new Date().toISOString(),
    projectPath,
    projectInfo,
    checks,
    overallScore,
    summary,
  };
}
