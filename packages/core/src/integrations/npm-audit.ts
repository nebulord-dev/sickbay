import { execa } from 'execa';
import { BaseRunner } from './base.js';
import { timer, parseJsonOutput } from '../utils/file-helpers.js';
import type { CheckResult, Issue } from '../types.js';

/**
 * NpmAuditRunner uses the npm audit command to analyze the project's dependencies for known security vulnerabilities.
 * It runs npm audit with a JSON reporter, parsing the output to identify vulnerabilities in the project's dependencies.
 * The runner reports issues with actionable feedback, including commands to fix or mitigate vulnerabilities, helping to improve the project's security posture.
 * It calculates an overall score based on the severity and number of vulnerabilities found, providing insights into the project's security health.
 */

interface AuditVulnerability {
  name: string;
  severity: string;
  via: Array<{ title?: string; url?: string } | string>;
  fixAvailable?: { name: string; version: string } | boolean;
}

interface AuditOutput {
  vulnerabilities?: Record<string, AuditVulnerability>;
  metadata?: {
    vulnerabilities: {
      info: number;
      low: number;
      moderate: number;
      high: number;
      critical: number;
    };
  };
}

export class NpmAuditRunner extends BaseRunner {
  name = 'npm-audit';
  category = 'security' as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const { stdout } = await execa('npm', ['audit', '--json'], {
        cwd: projectPath,
        reject: false,
      });

      const data = parseJsonOutput(stdout, '{}') as AuditOutput;
      const issues: Issue[] = [];
      const meta = data.metadata?.vulnerabilities;

      for (const [, vuln] of Object.entries(data.vulnerabilities ?? {})) {
        const via = Array.isArray(vuln.via) ? vuln.via[0] : null;
        const title = typeof via === 'object' && via?.title ? via.title : `Vulnerability in ${vuln.name}`;
        const url = typeof via === 'object' && via?.url ? via.url : undefined;

        issues.push({
          severity: vuln.severity === 'critical' || vuln.severity === 'high' ? 'critical' : 'warning',
          message: title,
          fix:
            typeof vuln.fixAvailable === 'object'
              ? { description: `Upgrade to ${vuln.fixAvailable.name}@${vuln.fixAvailable.version}` }
              : { description: 'No automatic fix available' },
          reportedBy: ['npm-audit'],
          ...(url && { file: url }),
        });
      }

      const critical = (meta?.critical ?? 0) + (meta?.high ?? 0);
      const score = critical > 0 ? Math.max(0, 60 - critical * 15) : Math.max(0, 100 - (meta?.moderate ?? 0) * 10 - (meta?.low ?? 0) * 2);

      return {
        id: 'npm-audit',
        category: this.category,
        name: 'Security Vulnerabilities',
        score,
        status: critical > 0 ? 'fail' : issues.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['npm-audit'],
        duration: elapsed(),
        metadata: { ...meta },
      };
    } catch (err) {
      return {
        id: 'npm-audit',
        category: this.category,
        name: 'Security Vulnerabilities',
        score: 0,
        status: 'fail',
        issues: [{ severity: 'critical', message: `npm audit failed: ${err}`, reportedBy: ['npm-audit'] }],
        toolsUsed: ['npm-audit'],
        duration: elapsed(),
      };
    }
  }
}
