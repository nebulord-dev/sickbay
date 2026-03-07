import { relative } from 'path';
import type { VitalsReport, CheckResult, ToolRunner, MonorepoReport, PackageReport } from './types.js';
import { detectProject, detectContext } from './utils/detect-project.js';
import { detectMonorepo } from './utils/detect-monorepo.js';
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
import { NodeSecurityRunner } from './integrations/node-security.js';
import { NodeInputValidationRunner } from './integrations/node-input-validation.js';
import { NodeAsyncErrorsRunner } from './integrations/node-async-errors.js';

export interface RunnerOptions {
  projectPath?: string;
  checks?: string[];
  verbose?: boolean;
  onRunnersReady?: (names: string[]) => void;
  onCheckStart?: (name: string) => void;
  onCheckComplete?: (result: CheckResult) => void;
  onPackageStart?: (name: string) => void;
  onPackageComplete?: (report: PackageReport) => void;
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
  new NodeSecurityRunner(),
  new NodeInputValidationRunner(),
  new NodeAsyncErrorsRunner(),
];

export async function runVitals(options: RunnerOptions = {}): Promise<VitalsReport> {
  const projectPath = options.projectPath ?? process.cwd();
  const projectInfo = await detectProject(projectPath);
  const context = await detectContext(projectPath);

  const candidateRunners = options.checks
    ? ALL_RUNNERS.filter((r) => options.checks!.includes(r.name))
    : ALL_RUNNERS;

  // Filter by context first (synchronous, cheap) then by isApplicable (async, may do I/O)
  const runners = candidateRunners.filter((r) => r.isApplicableToContext(context));
  options.onRunnersReady?.(runners.map((r) => r.name));

  const checks: CheckResult[] = [];

  // Run all checks concurrently
  const results = await Promise.allSettled(
    runners.map(async (runner) => {
      const applicable = await runner.isApplicable(projectPath, context);
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

export async function runVitalsMonorepo(options: RunnerOptions = {}): Promise<MonorepoReport> {
  const rootPath = options.projectPath ?? process.cwd();
  const monorepoInfo = await detectMonorepo(rootPath);

  if (!monorepoInfo.isMonorepo) {
    throw new Error(`Not a monorepo root: ${rootPath}`);
  }

  const packageReports = await Promise.all(
    monorepoInfo.packagePaths.map(async (pkgPath): Promise<PackageReport> => {
      const report = await runVitals({ ...options, projectPath: pkgPath });
      const context = await detectContext(pkgPath);

      options.onPackageStart?.(report.projectInfo.name);

      const packageReport: PackageReport = {
        name: report.projectInfo.name,
        path: pkgPath,
        relativePath: relative(rootPath, pkgPath),
        framework: report.projectInfo.framework,
        runtime: context.runtime,
        checks: report.checks,
        score: report.overallScore,
        summary: report.summary,
      };

      options.onPackageComplete?.(packageReport);
      return packageReport;
    }),
  );

  const overallScore =
    packageReports.length > 0
      ? Math.round(packageReports.reduce((sum, p) => sum + p.score, 0) / packageReports.length)
      : 0;

  const summary = packageReports.reduce(
    (acc, p) => ({
      critical: acc.critical + p.summary.critical,
      warnings: acc.warnings + p.summary.warnings,
      info: acc.info + p.summary.info,
    }),
    { critical: 0, warnings: 0, info: 0 },
  );

  return {
    isMonorepo: true,
    timestamp: new Date().toISOString(),
    rootPath,
    monorepoType: monorepoInfo.type,
    packageManager: monorepoInfo.packageManager,
    packages: packageReports,
    overallScore,
    summary,
  };
}
