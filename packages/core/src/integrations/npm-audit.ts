import { existsSync } from 'fs';
import { dirname, join } from 'path';

import { execa } from 'execa';

import { detectPackageManager } from '../utils/detect-project.js';
import { timer, parseJsonOutput, relativeFromRoot } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

/**
 * NpmAuditRunner uses the project's package manager audit command to analyze
 * dependencies for known security vulnerabilities. It detects whether the
 * project uses npm, pnpm, or yarn and runs the appropriate audit command,
 * parsing each format's JSON output to identify vulnerabilities.
 */

// --- npm audit JSON shape ---
interface NpmAuditVulnerability {
  name: string;
  severity: string;
  via: Array<{ title?: string; url?: string } | string>;
  fixAvailable?: { name: string; version: string } | boolean;
}

interface NpmAuditOutput {
  vulnerabilities?: Record<string, NpmAuditVulnerability>;
  metadata?: AuditMetadata;
}

// --- pnpm audit JSON shape ---
interface PnpmAdvisory {
  id: number;
  module_name: string;
  severity: string;
  title: string;
  url: string;
  recommendation: string;
  findings: Array<{ version: string; paths: string[] }>;
}

interface PnpmAuditOutput {
  advisories?: Record<string, PnpmAdvisory>;
  metadata?: AuditMetadata;
}

// Shared between npm and pnpm
interface AuditMetadata {
  vulnerabilities: {
    info: number;
    low: number;
    moderate: number;
    high: number;
    critical: number;
  };
}

export class NpmAuditRunner extends BaseRunner {
  name = 'npm-audit';
  category = 'security' as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const pm = detectPackageManager(projectPath);

    // yarn outputs NDJSON, bun doesn't support audit — skip with a hint
    if (pm === 'yarn' || pm === 'bun') {
      return this.skipped(`${pm} audit not supported — run: ${pm} audit`);
    }

    try {
      const { stdout } = await execa(pm, ['audit', '--json'], {
        cwd: projectPath,
        reject: false,
        timeout: 60_000,
      });

      const raw = parseJsonOutput(stdout, '{}');
      const { issues, vulnerablePackages, meta } =
        pm === 'pnpm'
          ? parsePnpmAudit(raw as PnpmAuditOutput, projectPath)
          : parseNpmAudit(raw as NpmAuditOutput);

      const critical = (meta?.critical ?? 0) + (meta?.high ?? 0);
      const moderate = meta?.moderate ?? 0;
      const low = meta?.low ?? 0;

      // When filtering by workspace package, recompute severity counts from
      // the filtered issues instead of trusting the workspace-wide metadata.
      const filteredCritical = issues.filter((i) => i.severity === 'critical').length;
      const filteredWarning = issues.filter((i) => i.severity === 'warning').length;
      const hasScopeFiltering =
        pm === 'pnpm' && filteredCritical + filteredWarning < critical + moderate + low;

      const effectiveCritical = hasScopeFiltering ? filteredCritical : critical;
      const effectiveModerate = hasScopeFiltering ? filteredWarning : moderate;

      const score =
        effectiveCritical > 0
          ? Math.max(0, 60 - effectiveCritical * 15)
          : Math.max(0, 100 - effectiveModerate * 10 - (hasScopeFiltering ? 0 : low) * 2);

      return {
        id: 'npm-audit',
        category: this.category,
        name: 'Security Vulnerabilities',
        score,
        status: effectiveCritical > 0 ? 'fail' : issues.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: [`${pm}-audit`],
        duration: elapsed(),
        metadata: { ...meta, vulnerablePackages },
      };
    } catch (err) {
      return {
        id: 'npm-audit',
        category: this.category,
        name: 'Security Vulnerabilities',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `${pm} audit failed: ${err}`,
            reportedBy: ['npm-audit'],
          },
        ],
        toolsUsed: [`${pm}-audit`],
        duration: elapsed(),
      };
    }
  }
}

interface ParsedAudit {
  issues: Issue[];
  vulnerablePackages: Record<string, number>;
  meta: AuditMetadata['vulnerabilities'] | undefined;
}

function parseNpmAudit(data: NpmAuditOutput): ParsedAudit {
  const issues: Issue[] = [];
  const meta = data.metadata?.vulnerabilities;

  // Build package → advisory count map for graph annotation.
  // Each vulnerability entry has a `via` array where objects with `title`
  // represent distinct advisories. Strings in `via` are transitive references
  // and should not be counted.
  const vulnerablePackages: Record<string, number> = {};
  for (const [pkgName, vuln] of Object.entries(data.vulnerabilities ?? {})) {
    const advisoryCount = Array.isArray(vuln.via)
      ? vuln.via.filter((v: unknown) => typeof v === 'object' && v !== null && 'title' in v).length
      : 0;
    vulnerablePackages[pkgName] = Math.max(advisoryCount, 1);
  }

  for (const [, vuln] of Object.entries(data.vulnerabilities ?? {})) {
    const via = Array.isArray(vuln.via) ? vuln.via[0] : null;
    const title =
      typeof via === 'object' && via?.title ? via.title : `Vulnerability in ${vuln.name}`;
    const url = typeof via === 'object' && via?.url ? via.url : undefined;

    issues.push({
      severity: vuln.severity === 'critical' || vuln.severity === 'high' ? 'critical' : 'warning',
      message: formatAuditMessage(vuln.name, title, url),
      suppressMatch: vuln.name,
      fix:
        typeof vuln.fixAvailable === 'object'
          ? { description: `Upgrade to ${vuln.fixAvailable.name}@${vuln.fixAvailable.version}` }
          : { description: 'No automatic fix available' },
      reportedBy: ['npm-audit'],
      ...(url && { file: url }),
    });
  }

  return { issues, vulnerablePackages, meta };
}

function parsePnpmAudit(data: PnpmAuditOutput, projectPath: string): ParsedAudit {
  const issues: Issue[] = [];
  const meta = data.metadata?.vulnerabilities;
  const vulnerablePackages: Record<string, number> = {};

  const advisories = filterPnpmAdvisories(data.advisories ?? {}, projectPath);

  for (const [, advisory] of Object.entries(advisories)) {
    const pkgName = advisory.module_name;
    vulnerablePackages[pkgName] = (vulnerablePackages[pkgName] ?? 0) + 1;

    issues.push({
      severity:
        advisory.severity === 'critical' || advisory.severity === 'high' ? 'critical' : 'warning',
      message: formatAuditMessage(
        pkgName,
        advisory.title || `Vulnerability in ${pkgName}`,
        advisory.url,
      ),
      suppressMatch: pkgName,
      fix: advisory.recommendation
        ? { description: advisory.recommendation }
        : { description: 'No automatic fix available' },
      reportedBy: ['npm-audit'],
      ...(advisory.url && { file: advisory.url }),
    });
  }

  return { issues, vulnerablePackages, meta };
}

/**
 * In a pnpm workspace, `pnpm audit` returns advisories for ALL packages.
 * Each advisory's findings contain paths like `packages__react-app>dep>transitive`.
 * The prefix is the package's relative path from the workspace root with `/` → `__`.
 * Filter to only advisories that affect the target package.
 */
function filterPnpmAdvisories(
  advisories: Record<string, PnpmAdvisory>,
  projectPath: string,
): Record<string, PnpmAdvisory> {
  const workspaceRoot = findPnpmWorkspaceRoot(projectPath);

  // Not in a workspace, or project IS the workspace root — all advisories apply
  if (!workspaceRoot || workspaceRoot === projectPath) {
    return advisories;
  }

  const importerPrefix = relativeFromRoot(workspaceRoot, projectPath).replace(/\//g, '__');

  const filtered: Record<string, PnpmAdvisory> = {};
  for (const [id, advisory] of Object.entries(advisories)) {
    const isRelevant = advisory.findings.some((f) =>
      f.paths.some((p) => p === importerPrefix || p.startsWith(importerPrefix + '>')),
    );
    if (isRelevant) {
      filtered[id] = advisory;
    }
  }

  return filtered;
}

function findPnpmWorkspaceRoot(startPath: string): string | null {
  let dir = startPath;
  while (true) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Format audit message as: [module] title (GHSA-xxxx)
 * Makes suppression easier — users can match on module name, title keywords, or GHSA ID.
 */
function formatAuditMessage(moduleName: string, title: string, url?: string): string {
  const ghsaId = url?.match(/GHSA-[\w-]+/)?.[0];
  const suffix = ghsaId ? ` (${ghsaId})` : '';
  return `[${moduleName}] ${title}${suffix}`;
}
