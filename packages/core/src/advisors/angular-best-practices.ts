import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';

import { BaseAdvisor } from './base.js';

import type { ProjectContext, Recommendation } from '../types.js';

const TS_EXTENSIONS = new Set(['.ts']);

export class AngularBestPracticesAdvisor extends BaseAdvisor {
  name = 'angular-best-practices';
  frameworks = ['angular'] as const;

  async run(projectPath: string, _context: ProjectContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    try {
      const pkg = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf-8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const files = scanTsFiles(join(projectPath, 'src'));

      this.checkStandaloneComponents(files, recommendations);
      this.checkSignalInputs(files, recommendations);
      this.checkLegacyControlFlow(files, recommendations);
      this.checkSsrHydration(allDeps, files, recommendations);
      this.checkLegacyHttpModule(files, recommendations);
    } catch {
      // Can't read package.json or src — return empty
    }

    return recommendations;
  }

  private checkStandaloneComponents(files: string[], recommendations: Recommendation[]): void {
    try {
      const hasNgModule = files.some((f) => {
        try {
          const content = readFileSync(f, 'utf-8');
          return content.includes('@NgModule') && content.includes('declarations');
        } catch {
          return false;
        }
      });

      if (hasNgModule) {
        recommendations.push({
          id: 'angular-standalone-components',
          framework: 'angular',
          title: 'Migrate to Standalone Components',
          message:
            'NgModule with declarations detected. Standalone components reduce boilerplate and improve tree-shaking. Angular recommends standalone as the default for new components.',
          severity: 'suggest',
          learnMoreUrl: 'https://angular.dev/guide/components/importing',
        });
      }
    } catch {
      // skip
    }
  }

  private checkSignalInputs(files: string[], recommendations: Recommendation[]): void {
    try {
      const hasLegacyInput = files.some((f) => {
        try {
          return readFileSync(f, 'utf-8').includes('@Input(');
        } catch {
          return false;
        }
      });

      if (hasLegacyInput) {
        recommendations.push({
          id: 'angular-signal-inputs',
          framework: 'angular',
          title: 'Adopt Signal-Based Inputs',
          message:
            'Using @Input() decorator. Signal-based inputs (input() / input.required()) provide better type safety, automatic change tracking, and work seamlessly with Angular signals.',
          severity: 'suggest',
          learnMoreUrl: 'https://angular.dev/guide/signals/inputs',
        });
      }
    } catch {
      // skip
    }
  }

  private checkLegacyControlFlow(files: string[], recommendations: Recommendation[]): void {
    try {
      const hasLegacyDirectives = files.some((f) => {
        try {
          const content = readFileSync(f, 'utf-8');
          return (
            content.includes('*ngIf') || content.includes('*ngFor') || content.includes('*ngSwitch')
          );
        } catch {
          return false;
        }
      });

      if (hasLegacyDirectives) {
        recommendations.push({
          id: 'angular-control-flow',
          framework: 'angular',
          title: 'Migrate to Built-in Control Flow',
          message:
            'Using *ngIf/*ngFor directives. Angular 17+ built-in control flow (@if, @for, @switch) is faster, requires no imports, and supports type narrowing.',
          severity: 'suggest',
          learnMoreUrl: 'https://angular.dev/guide/templates/control-flow',
        });
      }
    } catch {
      // skip
    }
  }

  private checkSsrHydration(
    allDeps: Record<string, string>,
    files: string[],
    recommendations: Recommendation[],
  ): void {
    try {
      const hasSsr = '@angular/ssr' in allDeps;
      const hasHydration = files.some((f) => {
        try {
          return readFileSync(f, 'utf-8').includes('provideClientHydration');
        } catch {
          return false;
        }
      });

      if (!hasSsr && !hasHydration) {
        recommendations.push({
          id: 'angular-ssr',
          framework: 'angular',
          title: 'Consider Server-Side Rendering',
          message:
            'No SSR setup detected. Angular SSR with hydration improves initial load performance and SEO. Add @angular/ssr to enable server-side rendering.',
          severity: 'suggest',
          learnMoreUrl: 'https://angular.dev/guide/ssr',
        });
      }
    } catch {
      // skip
    }
  }

  private checkLegacyHttpModule(files: string[], recommendations: Recommendation[]): void {
    try {
      const hasLegacyHttp = files.some((f) => {
        try {
          return readFileSync(f, 'utf-8').includes('HttpClientModule');
        } catch {
          return false;
        }
      });

      if (hasLegacyHttp) {
        recommendations.push({
          id: 'angular-http-client',
          framework: 'angular',
          title: 'Migrate to provideHttpClient()',
          message:
            'Using HttpClientModule import. The functional provideHttpClient() API (Angular 15+) is tree-shakeable and supports features like interceptors as functions.',
          severity: 'suggest',
          learnMoreUrl: 'https://angular.dev/guide/http/setup',
        });
      }
    } catch {
      // skip
    }
  }
}

function scanTsFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    if (!existsSync(dir)) return files;
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...scanTsFiles(fullPath));
      } else if (TS_EXTENSIONS.has(extname(entry))) {
        files.push(fullPath);
      }
    }
  } catch {
    // directory unreadable
  }
  return files;
}
