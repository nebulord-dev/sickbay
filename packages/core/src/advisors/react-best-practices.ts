import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';

import { BaseAdvisor } from './base.js';

import type { ProjectContext, Recommendation } from '../types.js';

const COMPONENT_EXTENSIONS = new Set(['.tsx', '.jsx']);

const ENTRY_FILES = [
  'main.tsx',
  'main.jsx',
  'index.tsx',
  'index.jsx',
  'src/main.tsx',
  'src/main.jsx',
  'src/index.tsx',
  'src/index.jsx',
];

export class ReactBestPracticesAdvisor extends BaseAdvisor {
  name = 'react-best-practices';
  frameworks = ['react', 'next', 'remix'] as const;

  async run(projectPath: string, context: ProjectContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const isNext = context.frameworks.includes('next');

    try {
      const pkg = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf-8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      this.checkErrorBoundaries(projectPath, allDeps, recommendations);
      this.checkSuspenseUsage(projectPath, recommendations);
      this.checkReactCompiler(allDeps, recommendations);
      if (!isNext) this.checkStrictMode(projectPath, recommendations);
      if (!isNext) this.checkLegacyRender(projectPath, recommendations);
    } catch {
      // Can't read package.json — return empty
    }

    return recommendations;
  }

  private checkErrorBoundaries(
    projectPath: string,
    allDeps: Record<string, string>,
    recommendations: Recommendation[],
  ): void {
    try {
      if ('react-error-boundary' in allDeps) return;

      const files = scanComponentFiles(join(projectPath, 'src'));
      const hasErrorBoundary = files.some((f) => {
        try {
          const content = readFileSync(f, 'utf-8');
          return content.includes('ErrorBoundary') || content.includes('componentDidCatch');
        } catch {
          return false;
        }
      });

      if (!hasErrorBoundary) {
        recommendations.push({
          id: 'react-error-boundary',
          framework: 'react',
          title: 'Add Error Boundaries',
          message:
            'No error boundaries detected. Unhandled errors in components will crash the entire app. Consider adding react-error-boundary or a custom ErrorBoundary component.',
          severity: 'recommend',
          learnMoreUrl:
            'https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary',
          fix: {
            command: 'npm install react-error-boundary',
            description: 'Install the react-error-boundary package and wrap your app or key routes',
          },
        });
      }
    } catch {
      // skip on error
    }
  }

  private checkSuspenseUsage(projectPath: string, recommendations: Recommendation[]): void {
    try {
      const files = scanComponentFiles(join(projectPath, 'src'));
      const hasSuspense = files.some((f) => {
        try {
          return readFileSync(f, 'utf-8').includes('<Suspense');
        } catch {
          return false;
        }
      });

      if (!hasSuspense) {
        recommendations.push({
          id: 'react-suspense',
          framework: 'react',
          title: 'Use Suspense for Loading States',
          message:
            'No <Suspense> boundaries found. Suspense provides declarative loading states for lazy-loaded components, data fetching, and code splitting.',
          severity: 'suggest',
          learnMoreUrl: 'https://react.dev/reference/react/Suspense',
        });
      }
    } catch {
      // skip on error
    }
  }

  private checkReactCompiler(
    allDeps: Record<string, string>,
    recommendations: Recommendation[],
  ): void {
    try {
      const hasCompiler =
        'babel-plugin-react-compiler' in allDeps || '@react-compiler/babel' in allDeps;

      if (!hasCompiler) {
        recommendations.push({
          id: 'react-compiler',
          framework: 'react',
          title: 'Adopt React Compiler',
          message:
            'React Compiler automatically memoizes components and hooks, eliminating the need for manual useMemo/useCallback. It can significantly reduce re-renders.',
          severity: 'suggest',
          learnMoreUrl: 'https://react.dev/learn/react-compiler',
        });
      }
    } catch {
      // skip on error
    }
  }

  private checkStrictMode(projectPath: string, recommendations: Recommendation[]): void {
    try {
      const hasStrictMode = ENTRY_FILES.some((f) => {
        try {
          return readFileSync(join(projectPath, f), 'utf-8').includes('<StrictMode');
        } catch {
          return false;
        }
      });

      if (!hasStrictMode) {
        recommendations.push({
          id: 'react-strict-mode',
          framework: 'react',
          title: 'Enable StrictMode',
          message:
            'No <StrictMode> wrapper found in entry files. Strict Mode helps find bugs by double-invoking renders and effects in development.',
          severity: 'recommend',
          learnMoreUrl: 'https://react.dev/reference/react/StrictMode',
        });
      }
    } catch {
      // skip on error
    }
  }

  private checkLegacyRender(projectPath: string, recommendations: Recommendation[]): void {
    try {
      const hasLegacyRender = ENTRY_FILES.some((f) => {
        try {
          return readFileSync(join(projectPath, f), 'utf-8').includes('ReactDOM.render(');
        } catch {
          return false;
        }
      });

      if (hasLegacyRender) {
        recommendations.push({
          id: 'react-legacy-render',
          framework: 'react',
          title: 'Migrate to createRoot',
          message:
            'Using legacy ReactDOM.render() API. Migrate to createRoot() to enable concurrent features like Suspense, transitions, and automatic batching.',
          severity: 'recommend',
          learnMoreUrl:
            'https://react.dev/blog/2022/03/08/react-18-upgrade-guide#updates-to-client-rendering-apis',
          fix: {
            description:
              'Replace ReactDOM.render(<App />, container) with createRoot(container).render(<App />)',
          },
        });
      }
    } catch {
      // skip on error
    }
  }
}

function scanComponentFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    if (!existsSync(dir)) return files;
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...scanComponentFiles(fullPath));
      } else if (COMPONENT_EXTENSIONS.has(extname(entry))) {
        files.push(fullPath);
      }
    }
  } catch {
    // directory doesn't exist or unreadable
  }
  return files;
}
