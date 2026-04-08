import { existsSync, readFileSync } from 'fs';
import { basename, join, relative } from 'path';

import { AngularBestPracticesAdvisor } from './advisors/angular-best-practices.js';
import { NextBestPracticesAdvisor } from './advisors/next-best-practices.js';
import { ReactBestPracticesAdvisor } from './advisors/react-best-practices.js';
import { UniversalBestPracticesAdvisor } from './advisors/universal-best-practices.js';
import {
  loadConfig,
  isCheckDisabled,
  getCheckConfig,
  getUnlistedChecks,
  mergeConfigs,
  resolveConfigMeta,
} from './config.js';
import { AngularBuildConfigRunner } from './integrations/angular-build-config.js';
import { AngularChangeDetectionRunner } from './integrations/angular-change-detection.js';
import { AngularLazyRoutesRunner } from './integrations/angular-lazy-routes.js';
import { AngularSecurityRunner } from './integrations/angular-security.js';
import { AngularStrictRunner } from './integrations/angular-strict.js';
import { AngularSubscriptionsRunner } from './integrations/angular-subscriptions.js';
import { AngularTemplatePerformanceRunner } from './integrations/angular-template-performance.js';
import { AssetSizeRunner } from './integrations/asset-size.js';
import { ComplexityRunner } from './integrations/complexity.js';
import { CoverageRunner } from './integrations/coverage.js';
import { DepcheckRunner } from './integrations/depcheck.js';
import { ESLintRunner } from './integrations/eslint.js';
import { GitRunner } from './integrations/git.js';
import { HeavyDepsRunner } from './integrations/heavy-deps.js';
import { JscpdRunner } from './integrations/jscpd.js';
import { KnipRunner } from './integrations/knip.js';
import { LicenseCheckerRunner } from './integrations/license-checker.js';
import { MadgeRunner } from './integrations/madge.js';
import { NextClientComponentsRunner } from './integrations/next-client-components.js';
import { NextFontsRunner } from './integrations/next-fonts.js';
import { NextImagesRunner } from './integrations/next-images.js';
import { NextLinkRunner } from './integrations/next-link.js';
import { NextMissingBoundariesRunner } from './integrations/next-missing-boundaries.js';
import { NextSecurityHeadersRunner } from './integrations/next-security-headers.js';
import { NodeAsyncErrorsRunner } from './integrations/node-async-errors.js';
import { NodeInputValidationRunner } from './integrations/node-input-validation.js';
import { NodeSecurityRunner } from './integrations/node-security.js';
import { NpmAuditRunner } from './integrations/npm-audit.js';
import { OutdatedRunner } from './integrations/outdated.js';
import { ReactPerfRunner } from './integrations/react-perf.js';
import { SecretsRunner } from './integrations/secrets.js';
import { SourceMapExplorerRunner } from './integrations/source-map-explorer.js';
import { TodoScannerRunner } from './integrations/todo-scanner.js';
import { TypeScriptRunner } from './integrations/typescript.js';
import { getQuote } from './quotes/index.js';
import {
  calculateOverallScore,
  buildSummary,
  normalizeWeights,
  CATEGORY_WEIGHTS,
} from './scoring.js';
import { detectMonorepo } from './utils/detect-monorepo.js';
import { detectProject, detectContext } from './utils/detect-project.js';
import { applySuppression, recalcScoreAfterSuppression } from './utils/suppress.js';

import type { BaseAdvisor } from './advisors/base.js';
import type { SickbayConfig } from './config.js';
import type {
  SickbayReport,
  CheckResult,
  Recommendation,
  ToolRunner,
  MonorepoReport,
  PackageReport,
  ProjectContext,
} from './types.js';

export interface RunnerOptions {
  projectPath?: string;
  checks?: string[];
  verbose?: boolean;
  quotes?: boolean;
  onRunnersReady?: (names: string[]) => void;
  onCheckStart?: (name: string) => void;
  onCheckComplete?: (result: CheckResult) => void;
  onPackageStart?: (name: string) => void;
  onPackageComplete?: (report: PackageReport) => void;
  /** Pre-loaded config — used internally by runSickbayMonorepo */
  _config?: SickbayConfig | null;
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
  new AngularBuildConfigRunner(),
  new AngularChangeDetectionRunner(),
  new AngularLazyRoutesRunner(),
  new AngularSecurityRunner(),
  new AngularStrictRunner(),
  new AngularSubscriptionsRunner(),
  new AngularTemplatePerformanceRunner(),
  new NextClientComponentsRunner(),
  new NextFontsRunner(),
  new NextImagesRunner(),
  new NextLinkRunner(),
  new NextMissingBoundariesRunner(),
  new NextSecurityHeadersRunner(),
];

const ALL_ADVISORS: BaseAdvisor[] = [
  new ReactBestPracticesAdvisor(),
  new AngularBestPracticesAdvisor(),
  new NextBestPracticesAdvisor(),
  new UniversalBestPracticesAdvisor(),
];

/**
 * Read the `name` field from a package.json without running the full
 * detectProject pipeline. Used by runSickbayMonorepo to fire onPackageStart
 * before the (relatively slow) per-package scan begins. Falls back to the
 * directory basename if package.json is missing or unreadable.
 */
function readPackageName(pkgPath: string): string {
  const pkgJsonPath = join(pkgPath, 'package.json');
  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')) as { name?: string };
      if (pkg.name) return pkg.name;
    } catch {
      // fall through to basename
    }
  }
  return basename(pkgPath);
}

export function getAvailableChecks(context?: ProjectContext): { name: string; category: string }[] {
  const runners = context
    ? ALL_RUNNERS.filter((r) => r.isApplicableToContext(context))
    : ALL_RUNNERS;
  return runners.map((r) => ({ name: r.name, category: r.category }));
}

export async function runSickbay(options: RunnerOptions = {}): Promise<SickbayReport> {
  const projectPath = options.projectPath ?? process.cwd();
  const projectInfo = await detectProject(projectPath);
  const context = await detectContext(projectPath);

  const config = options._config !== undefined ? options._config : await loadConfig(projectPath);
  const configMeta = resolveConfigMeta(config);

  const candidateRunners = options.checks
    ? ALL_RUNNERS.filter((r) => options.checks!.includes(r.name))
    : ALL_RUNNERS;

  // Filter by context first (synchronous, cheap), then by config, then by isApplicable (async, may do I/O)
  const runners = candidateRunners
    .filter((r) => r.isApplicableToContext(context))
    .filter((r) => !isCheckDisabled(config, r.name));
  options.onRunnersReady?.(runners.map((r) => r.name));

  // Scan-time notification: warn about checks running but not listed in config.
  // Only emit for top-level calls (not internal per-package calls in monorepo mode).
  if (options._config === undefined && config?.checks) {
    const unlisted = getUnlistedChecks(
      config,
      runners.map((r) => r.name),
    );
    if (unlisted.length > 0) {
      process.stderr.write(
        `Note: ${unlisted.length} check(s) running but not listed in your config: ${unlisted.join(', ')}. ` +
          `Run \`sickbay init --sync\` to add them.\n`,
      );
    }
  }

  const checks: CheckResult[] = [];

  // Run all checks concurrently
  const results = await Promise.allSettled(
    runners.map(async (runner) => {
      const applicable = await runner.isApplicable(projectPath, context);
      if (!applicable) return null;

      options.onCheckStart?.(runner.name);
      const checkCfg = getCheckConfig(config, runner.name);
      const globalExclude = config?.exclude ?? [];
      const checkExclude = checkCfg?.exclude ?? [];
      const mergedExclude = [...globalExclude, ...checkExclude];
      const result = await runner.run(projectPath, {
        verbose: options.verbose,
        checkConfig:
          checkCfg || mergedExclude.length > 0
            ? {
                thresholds: checkCfg?.thresholds,
                exclude: mergedExclude.length > 0 ? mergedExclude : undefined,
                suppress: checkCfg?.suppress,
              }
            : undefined,
      });

      // Apply suppression rules post-run and recalculate score
      if (checkCfg?.suppress?.length) {
        const originalIssues = result.issues;
        const { issues, suppressedCount } = applySuppression(result.issues, checkCfg.suppress);
        result.issues = issues;
        if (suppressedCount > 0) {
          recalcScoreAfterSuppression(result, originalIssues);
          result.metadata = { ...result.metadata, suppressedCount };
        }
      }
      options.onCheckComplete?.(result);
      return result;
    }),
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      checks.push(result.value);
    }
  }

  // Run advisors in parallel (non-scored recommendations)
  const applicableAdvisors = ALL_ADVISORS.filter((a) => a.isApplicableToContext(context));
  const advisorResults = await Promise.allSettled(
    applicableAdvisors.map(async (advisor) => {
      try {
        return await advisor.run(projectPath, context);
      } catch {
        return [] as Recommendation[];
      }
    }),
  );
  const recommendations: Recommendation[] = [];
  for (const result of advisorResults) {
    if (result.status === 'fulfilled') {
      recommendations.push(...result.value);
    }
  }

  const normalizedWeights = config?.weights
    ? normalizeWeights(config.weights, CATEGORY_WEIGHTS)
    : undefined;
  const overallScore = calculateOverallScore(checks, normalizedWeights);
  const summary = buildSummary(checks);

  return {
    timestamp: new Date().toISOString(),
    projectPath,
    projectInfo,
    checks,
    overallScore,
    summary,
    config: configMeta.hasCustomConfig ? configMeta : undefined,
    recommendations: recommendations.length > 0 ? recommendations : undefined,
    quote: options.quotes !== false ? getQuote(overallScore) : undefined,
  };
}

export async function runSickbayMonorepo(options: RunnerOptions = {}): Promise<MonorepoReport> {
  const rootPath = options.projectPath ?? process.cwd();
  const monorepoInfo = await detectMonorepo(rootPath);

  if (!monorepoInfo.isMonorepo) {
    throw new Error(`Not a monorepo root: ${rootPath}`);
  }

  const rootConfig = await loadConfig(rootPath);
  const configMeta = resolveConfigMeta(rootConfig);

  const packageReports = await Promise.all(
    monorepoInfo.packagePaths.map(async (pkgPath): Promise<PackageReport> => {
      const pkgConfig = await loadConfig(pkgPath);
      const mergedConfig = mergeConfigs(rootConfig, pkgConfig);

      // Notify "starting X" BEFORE running the scan, not after — the previous
      // ordering meant the CLI's "scanning <package>" indicator updated only
      // after that package's scan was already done.
      // We resolve the package name from package.json directly so we can fire
      // the callback before runSickbay (which is what otherwise produces the
      // ProjectInfo we'd read it from). readPackageName is total — it falls
      // back to basename(pkgPath) when package.json is missing or unreadable.
      options.onPackageStart?.(readPackageName(pkgPath));

      const report = await runSickbay({ ...options, projectPath: pkgPath, _config: mergedConfig });
      const context = await detectContext(pkgPath);

      const packageReport: PackageReport = {
        name: report.projectInfo.name,
        path: pkgPath,
        relativePath: relative(rootPath, pkgPath),
        framework: report.projectInfo.framework,
        runtime: context.runtime,
        checks: report.checks,
        score: report.overallScore,
        summary: report.summary,
        dependencies: report.projectInfo.dependencies,
        devDependencies: report.projectInfo.devDependencies,
        recommendations: report.recommendations,
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
    config: configMeta.hasCustomConfig ? configMeta : undefined,
    quote: options.quotes !== false ? getQuote(overallScore) : undefined,
  };
}
