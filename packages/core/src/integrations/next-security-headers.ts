import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

export class NextSecurityHeadersRunner extends BaseRunner {
  name = 'next-security-headers';
  category = 'security' as const;
  applicableFrameworks = ['next'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      // Check for next.config file
      const configFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts'];
      let configFile: string | null = null;
      for (const file of configFiles) {
        if (existsSync(join(projectPath, file))) {
          configFile = file;
          break;
        }
      }

      if (!configFile) {
        return {
          id: 'next-security-headers',
          category: this.category,
          name: 'Next.js Security Headers',
          score: 0,
          status: 'fail',
          issues: [
            {
              severity: 'critical',
              message: 'No Next.js config file found — cannot verify security headers',
              reportedBy: ['next-security-headers'],
            },
          ],
          toolsUsed: ['next-security-headers'],
          duration: elapsed(),
          metadata: { configFile: null, hasHeaders: false, missingHeaders: [] },
        };
      }

      // Read the config file
      const content = readFileSync(join(projectPath, configFile), 'utf-8');

      // Check for async headers() using regex
      const headersFunctionRegex = /async\s+headers\s*\(\s*\)/;
      const hasHeadersFunction = headersFunctionRegex.test(content);

      if (!hasHeadersFunction) {
        return {
          id: 'next-security-headers',
          category: this.category,
          name: 'Next.js Security Headers',
          score: 30,
          status: 'warning',
          issues: [
            {
              severity: 'warning',
              message:
                'next.config.js missing async headers() — security response headers (CSP, X-Frame-Options, etc.) are not configured',
              fix: {
                description:
                  'Add an async headers() function to next.config.js to set security headers like Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy.',
              },
              reportedBy: ['next-security-headers'],
            },
          ],
          toolsUsed: ['next-security-headers'],
          duration: elapsed(),
          metadata: { configFile, hasHeaders: false, missingHeaders: [] },
        };
      }

      // Check for the 4 required headers
      const requiredHeaders = [
        'Content-Security-Policy',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy',
      ];

      const missingHeaders: string[] = [];
      const issues: Issue[] = [];

      for (const header of requiredHeaders) {
        if (!content.includes(header)) {
          missingHeaders.push(header);
          issues.push({
            severity: 'info',
            message: `next.config.js headers() is missing the ${header} header`,
            fix: {
              description: `Add the ${header} header to the headers() function to improve security. ${
                header === 'Content-Security-Policy'
                  ? 'CSP restricts resources that can be loaded, mitigating XSS attacks.'
                  : header === 'X-Frame-Options'
                    ? 'X-Frame-Options prevents clickjacking by controlling whether the page can be framed.'
                    : header === 'X-Content-Type-Options'
                      ? 'X-Content-Type-Options prevents MIME type sniffing attacks.'
                      : 'Referrer-Policy controls how much referrer information is shared with other sites.'
              }`,
            },
            reportedBy: ['next-security-headers'],
          });
        }
      }

      const score = Math.max(40, 100 - missingHeaders.length * 15);

      return {
        id: 'next-security-headers',
        category: this.category,
        name: 'Next.js Security Headers',
        score,
        status: missingHeaders.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['next-security-headers'],
        duration: elapsed(),
        metadata: { configFile, hasHeaders: true, missingHeaders },
      };
    } catch (err) {
      return {
        id: 'next-security-headers',
        category: this.category,
        name: 'Next.js Security Headers',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['next-security-headers'],
          },
        ],
        toolsUsed: ['next-security-headers'],
        duration: elapsed(),
      };
    }
  }
}
