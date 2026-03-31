import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

export class NextFontsRunner extends BaseRunner {
  name = 'next-fonts';
  category = 'performance' as const;
  applicableFrameworks = ['next'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const layoutPaths = [
        'app/layout.tsx',
        'app/layout.jsx',
        'src/app/layout.tsx',
        'src/app/layout.jsx',
        'pages/_document.tsx',
        'pages/_document.jsx',
        'pages/_document.js',
        'src/pages/_document.tsx',
        'src/pages/_document.jsx',
      ];

      const found: string[] = [];

      for (const layoutPath of layoutPaths) {
        const fullPath = join(projectPath, layoutPath);
        if (existsSync(fullPath)) {
          const content = readFileSync(fullPath, 'utf-8');
          if (
            content.includes('fonts.googleapis.com') ||
            content.includes('fonts.gstatic.com')
          ) {
            found.push(layoutPath);
          }
        }
      }

      const issues: Issue[] = found.map((layoutPath) => ({
        severity: 'warning' as const,
        message: `${layoutPath} — Google Fonts loaded via external stylesheet; use next/font/google`,
        file: layoutPath,
        fix: {
          description:
            'Use next/font/google instead of a <link> stylesheet to self-host fonts and improve Core Web Vitals (eliminates render-blocking request).',
        },
        reportedBy: ['next-fonts'],
      }));

      const score = Math.max(40, 100 - found.length * 30);

      return {
        id: 'next-fonts',
        category: this.category,
        name: 'Next.js Fonts',
        score,
        status: found.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['next-fonts'],
        duration: elapsed(),
        metadata: { layoutFilesChecked: layoutPaths.length, violations: found.length },
      };
    } catch (err) {
      return {
        id: 'next-fonts',
        category: this.category,
        name: 'Next.js Fonts',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['next-fonts'],
          },
        ],
        toolsUsed: ['next-fonts'],
        duration: elapsed(),
      };
    }
  }
}
