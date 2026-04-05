import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';

import { createExcludeFilter } from '../utils/exclude.js';
import { timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue, RunOptions } from '../types.js';

/**
 * SecretsRunner analyzes the project's source code and configuration files to detect hardcoded secrets such as API keys, tokens, and passwords.
 * It uses a set of regex patterns to identify potential secrets in various file types, including .env files, JavaScript/TypeScript source files, and common configuration formats.
 * The runner provides actionable feedback on how to fix each issue, such as moving secrets to environment variables or using secret management tools.
 * It calculates an overall score based on the number and severity of findings, giving insights into the project's security posture regarding secret management.
 */

const SCAN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mts',
  '.cts',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
]);
const SKIP_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  '.env.example',
  '.env.sample',
  '.env.template',
]);

interface SecretPattern {
  name: string;
  regex: RegExp;
}

const PATTERNS: SecretPattern[] = [
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub Token', regex: /gh[pousr]_[A-Za-z0-9_]{36,}/ },
  { name: 'Slack Token', regex: /xox[baprs]-[0-9A-Za-z-]{10,}/ },
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z\-_]{35}/ },
  { name: 'Stripe Key', regex: /[rs]k_live_[0-9a-zA-Z]{24}/ },
  {
    name: 'Private Key',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: 'Hardcoded password',
    regex: /(?:^|[^a-z])(?:password|passwd|pwd)\s*[=:]\s*["'][^"']{8,}["']/i,
  },
  {
    name: 'Hardcoded API key',
    regex: /(?:^|[^a-z])(?:api_?key|apikey)\s*[=:]\s*["'][A-Za-z0-9+/=_-]{16,}["']/i,
  },
  {
    name: 'Hardcoded secret',
    regex: /(?:^|[^a-z])(?:secret)\s*[=:]\s*["'][A-Za-z0-9+/=_-]{16,}["']/i,
  },
];

interface Finding {
  file: string;
  line: number;
  pattern: string;
  codeSnippet?: string;
}

export class SecretsRunner extends BaseRunner {
  name = 'secrets';
  category = 'security' as const;

  async run(projectPath: string, options?: RunOptions): Promise<CheckResult> {
    const elapsed = timer();
    const isExcluded = createExcludeFilter(options?.checkConfig?.exclude ?? []);

    try {
      const findings: Finding[] = [];

      // Check if .env files are committed (not in .gitignore)
      const envFiles = ['.env', '.env.local', '.env.production'];
      for (const envFile of envFiles) {
        if (existsSync(join(projectPath, envFile))) {
          const gitignorePath = join(projectPath, '.gitignore');
          let ignored = false;
          try {
            const gitignore = readFileSync(gitignorePath, 'utf-8');
            ignored = gitignore.includes(envFile) || gitignore.includes('.env');
          } catch {
            /* no gitignore */
          }

          if (!ignored) {
            findings.push({
              file: envFile,
              line: 0,
              pattern: '.env file not in .gitignore',
            });
          }
        }
      }

      // Scan source files
      if (existsSync(join(projectPath, 'src'))) {
        findings.push(...scanDirectory(join(projectPath, 'src'), projectPath, isExcluded));
      }

      const issues: Issue[] = findings.map((f) => ({
        severity: 'critical' as const,
        message:
          f.line > 0 ? `${f.file}:${f.line} — ${f.pattern} detected` : `${f.file} — ${f.pattern}`,
        suppressMatch: f.pattern,
        file: f.file,
        fix: {
          description: 'Move secrets to environment variables',
          codeChange: f.codeSnippet
            ? {
                before: f.codeSnippet,
                after: 'Use process.env.YOUR_SECRET_NAME instead',
              }
            : undefined,
        },
        reportedBy: ['secrets'],
      }));

      const count = findings.length;
      const score = Math.max(0, 100 - count * 25);

      return {
        id: 'secrets',
        category: this.category,
        name: 'Secrets Detection',
        score,
        status: count === 0 ? 'pass' : 'fail',
        issues,
        toolsUsed: ['secrets'],
        duration: elapsed(),
        metadata: { findings: count },
      };
    } catch (err) {
      return {
        id: 'secrets',
        category: this.category,
        name: 'Secrets Detection',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Secrets scan failed: ${err}`,
            reportedBy: ['secrets'],
          },
        ],
        toolsUsed: ['secrets'],
        duration: elapsed(),
      };
    }
  }
}

function scanDirectory(
  dir: string,
  projectRoot: string,
  isExcluded: (p: string) => boolean,
): Finding[] {
  const findings: Finding[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (
        entry.startsWith('.') ||
        entry === 'node_modules' ||
        entry === '__tests__' ||
        entry === 'test' ||
        entry === 'tests'
      )
        continue;
      const fullPath = join(dir, entry);
      const relPath = fullPath.replace(projectRoot + '/', '');
      if (isExcluded(relPath)) continue;
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        findings.push(...scanDirectory(fullPath, projectRoot, isExcluded));
      } else if (
        SCAN_EXTENSIONS.has(extname(entry)) &&
        !SKIP_FILES.has(basename(entry)) &&
        !isTestFile(entry)
      ) {
        findings.push(...scanFile(fullPath, projectRoot));
      }
    }
  } catch {
    // directory doesn't exist
  }
  return findings;
}

function isTestFile(filename: string): boolean {
  return /\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$/.test(filename);
}

function scanFile(filePath: string, projectRoot: string): Finding[] {
  const findings: Finding[] = [];
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relPath = filePath.replace(projectRoot + '/', '');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip lines that clearly reference env vars (not hardcoded)
      if (line.includes('process.env') || line.includes('import.meta.env')) continue;
      // Skip comments
      if (
        line.trim().startsWith('//') ||
        line.trim().startsWith('#') ||
        line.trim().startsWith('*')
      )
        continue;

      for (const pattern of PATTERNS) {
        if (pattern.regex.test(line)) {
          findings.push({
            file: relPath,
            line: i + 1,
            pattern: pattern.name,
            codeSnippet: line.trim(),
          });
          break; // one finding per line
        }
      }
    }
  } catch {
    // can't read file
  }
  return findings;
}
