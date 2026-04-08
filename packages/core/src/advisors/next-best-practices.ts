import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

import { BaseAdvisor } from './base.js';

import type { ProjectContext, Recommendation } from '../types.js';

const NEXT_CONFIG_FILES = ['next.config.js', 'next.config.mjs', 'next.config.ts'];

export class NextBestPracticesAdvisor extends BaseAdvisor {
  name = 'next-best-practices';
  frameworks = ['next'] as const;

  async run(projectPath: string, _context: ProjectContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    try {
      const pkg = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf-8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        scripts?: Record<string, string>;
      };
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      this.checkPagesRouter(projectPath, recommendations);
      this.checkTurbopack(pkg.scripts ?? {}, recommendations);
      this.checkMetadataApi(projectPath, recommendations);
      this.checkThirdParties(projectPath, allDeps, recommendations);
      this.checkStrictMode(projectPath, recommendations);
    } catch {
      // Can't read package.json — return empty
    }

    return recommendations;
  }

  private checkPagesRouter(projectPath: string, recommendations: Recommendation[]): void {
    try {
      const hasPagesDir = existsSync(join(projectPath, 'pages'));
      if (hasPagesDir) {
        recommendations.push({
          id: 'next-app-router',
          framework: 'next',
          title: 'Migrate to App Router',
          message:
            'pages/ directory detected. The App Router (app/) is the recommended architecture for new Next.js features including Server Components, streaming, and nested layouts.',
          severity: 'suggest',
          learnMoreUrl:
            'https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration',
        });
      }
    } catch {
      // skip
    }
  }

  private checkTurbopack(scripts: Record<string, string>, recommendations: Recommendation[]): void {
    try {
      const devScript = scripts.dev ?? '';
      if (!devScript.includes('--turbopack')) {
        recommendations.push({
          id: 'next-turbopack',
          framework: 'next',
          title: 'Enable Turbopack',
          message:
            'Dev server not using Turbopack. Add --turbopack to your dev script for significantly faster hot module replacement and development builds.',
          severity: 'suggest',
          learnMoreUrl: 'https://nextjs.org/docs/architecture/turbopack',
        });
      }
    } catch {
      // skip
    }
  }

  private checkMetadataApi(projectPath: string, recommendations: Recommendation[]): void {
    try {
      const appDir = join(projectPath, 'app');
      if (!existsSync(appDir)) return;

      // Check page files for metadata exports
      const pageFiles = findPageFiles(appDir);
      if (pageFiles.length === 0) return;

      const hasMetadata = pageFiles.some((f) => {
        try {
          const content = readFileSync(f, 'utf-8');
          return content.includes('export const metadata') || content.includes('generateMetadata');
        } catch {
          return false;
        }
      });

      if (!hasMetadata) {
        recommendations.push({
          id: 'next-metadata-api',
          framework: 'next',
          title: 'Use the Metadata API',
          message:
            'No metadata exports found in App Router pages. The Metadata API (export const metadata / generateMetadata) provides automatic <head> management with built-in deduplication and streaming support.',
          severity: 'recommend',
          learnMoreUrl: 'https://nextjs.org/docs/app/building-your-application/optimizing/metadata',
        });
      }
    } catch {
      // skip
    }
  }

  private checkThirdParties(
    projectPath: string,
    allDeps: Record<string, string>,
    recommendations: Recommendation[],
  ): void {
    try {
      if ('@next/third-parties' in allDeps) return;

      // Look for raw Google Analytics/GTM script patterns in layout/page files
      const appDir = join(projectPath, 'app');
      if (!existsSync(appDir)) return;

      const layoutFiles = findLayoutFiles(appDir);
      const hasRawAnalytics = layoutFiles.some((f) => {
        try {
          const content = readFileSync(f, 'utf-8');
          return (
            content.includes('googletagmanager.com') ||
            content.includes('google-analytics.com') ||
            content.includes('gtag(')
          );
        } catch {
          return false;
        }
      });

      if (hasRawAnalytics) {
        recommendations.push({
          id: 'next-third-parties',
          framework: 'next',
          title: 'Use @next/third-parties',
          message:
            'Google Analytics/GTM loaded via raw script tags. @next/third-parties provides optimized, lazy-loaded wrappers that reduce impact on Core Web Vitals.',
          severity: 'suggest',
          learnMoreUrl:
            'https://nextjs.org/docs/app/building-your-application/optimizing/third-party-libraries',
        });
      }
    } catch {
      // skip
    }
  }

  private checkStrictMode(projectPath: string, recommendations: Recommendation[]): void {
    try {
      const hasStrictMode = NEXT_CONFIG_FILES.some((f) => {
        try {
          const content = readFileSync(join(projectPath, f), 'utf-8');
          // Match `reactStrictMode: true` (with optional whitespace) rather than
          // checking for the substrings independently — the latter false-positives
          // on `reactStrictMode: false` whenever the word "true" appears anywhere
          // else in the file (comments, other config keys, etc.).
          return /reactStrictMode\s*:\s*true/.test(content);
        } catch {
          return false;
        }
      });

      if (!hasStrictMode) {
        recommendations.push({
          id: 'next-strict-mode',
          framework: 'next',
          title: 'Enable React Strict Mode',
          message:
            'reactStrictMode is not enabled in your Next.js config. Strict Mode helps find bugs by double-invoking renders and effects in development.',
          severity: 'recommend',
          learnMoreUrl: 'https://nextjs.org/docs/api-reference/next.config.js/react-strict-mode',
          fix: {
            description: 'Add reactStrictMode: true to your next.config.js',
          },
        });
      }
    } catch {
      // skip
    }
  }
}

function findPageFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findPageFiles(fullPath));
      } else if (entry.name.startsWith('page.')) {
        files.push(fullPath);
      }
    }
  } catch {
    // unreadable
  }
  return files;
}

function findLayoutFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findLayoutFiles(fullPath));
      } else if (entry.name.startsWith('layout.') || entry.name.startsWith('page.')) {
        files.push(fullPath);
      }
    }
  } catch {
    // unreadable
  }
  return files;
}
