import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { BaseAdvisor } from './base.js';

import type { Framework, ProjectContext, Recommendation } from '../types.js';

const LOCK_FILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'];

export class UniversalBestPracticesAdvisor extends BaseAdvisor {
  name = 'universal-best-practices';
  frameworks = [] as unknown as readonly Framework[];

  async run(projectPath: string, _context: ProjectContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    try {
      const pkg = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf-8')) as {
        engines?: Record<string, string>;
        packageManager?: string;
      };

      this.checkNodeVersionPinning(projectPath, pkg, recommendations);
      this.checkEditorConfig(projectPath, recommendations);
      this.checkEnginesField(pkg, recommendations);
      this.checkPackageManagerField(pkg, recommendations);
      this.checkLicenseFile(projectPath, recommendations);
      this.checkConflictingLockFiles(projectPath, recommendations);
    } catch {
      // Can't read package.json — return empty
    }

    return recommendations;
  }

  private checkNodeVersionPinning(
    projectPath: string,
    pkg: { engines?: Record<string, string> },
    recommendations: Recommendation[],
  ): void {
    try {
      const hasNvmrc = existsSync(join(projectPath, '.nvmrc'));
      const hasNodeVersion = existsSync(join(projectPath, '.node-version'));
      const hasEnginesNode = !!pkg.engines?.node;

      if (!hasNvmrc && !hasNodeVersion && !hasEnginesNode) {
        recommendations.push({
          id: 'universal-node-version',
          framework: 'universal',
          title: 'Pin Node.js Version',
          message:
            'No .nvmrc, .node-version, or engines.node found. Pinning the Node version prevents "works on my machine" issues and ensures consistent CI behavior.',
          severity: 'recommend',
          fix: {
            description: 'Create a .nvmrc file with your target Node version (e.g. 22)',
          },
        });
      }
    } catch {
      // skip
    }
  }

  private checkEditorConfig(projectPath: string, recommendations: Recommendation[]): void {
    try {
      if (!existsSync(join(projectPath, '.editorconfig'))) {
        recommendations.push({
          id: 'universal-editorconfig',
          framework: 'universal',
          title: 'Add .editorconfig',
          message:
            'No .editorconfig found. EditorConfig ensures consistent indentation, line endings, and charset across different editors and IDEs.',
          severity: 'suggest',
          learnMoreUrl: 'https://editorconfig.org/',
        });
      }
    } catch {
      // skip
    }
  }

  private checkEnginesField(
    pkg: { engines?: Record<string, string> },
    recommendations: Recommendation[],
  ): void {
    try {
      if (!pkg.engines) {
        recommendations.push({
          id: 'universal-engines',
          framework: 'universal',
          title: 'Add engines Field',
          message:
            'package.json has no engines field. Declaring Node and npm version constraints prevents installs on incompatible runtimes.',
          severity: 'suggest',
        });
      }
    } catch {
      // skip
    }
  }

  private checkPackageManagerField(
    pkg: { packageManager?: string },
    recommendations: Recommendation[],
  ): void {
    try {
      if (!pkg.packageManager) {
        recommendations.push({
          id: 'universal-package-manager',
          framework: 'universal',
          title: 'Add packageManager Field',
          message:
            'package.json has no packageManager field. This field enables Corepack to auto-install the correct package manager version, preventing lockfile churn from version mismatches.',
          severity: 'suggest',
          learnMoreUrl: 'https://nodejs.org/api/corepack.html',
        });
      }
    } catch {
      // skip
    }
  }

  private checkLicenseFile(projectPath: string, recommendations: Recommendation[]): void {
    try {
      const hasLicense =
        existsSync(join(projectPath, 'LICENSE')) ||
        existsSync(join(projectPath, 'LICENSE.md')) ||
        existsSync(join(projectPath, 'LICENSE.txt')) ||
        existsSync(join(projectPath, 'LICENCE')) ||
        existsSync(join(projectPath, 'LICENCE.md'));

      if (!hasLicense) {
        recommendations.push({
          id: 'universal-license',
          framework: 'universal',
          title: 'Add a LICENSE File',
          message:
            'No LICENSE file found. Without an explicit license, the project is "all rights reserved" by default, which may prevent others from using or contributing to it.',
          severity: 'recommend',
        });
      }
    } catch {
      // skip
    }
  }

  private checkConflictingLockFiles(projectPath: string, recommendations: Recommendation[]): void {
    try {
      const presentLockFiles = LOCK_FILES.filter((f) => existsSync(join(projectPath, f)));

      if (presentLockFiles.length > 1) {
        recommendations.push({
          id: 'universal-conflicting-lockfiles',
          framework: 'universal',
          title: 'Remove Conflicting Lock Files',
          message: `Multiple lock files found (${presentLockFiles.join(', ')}). This causes nondeterministic installs and CI failures. Keep only the lock file for your project's package manager.`,
          severity: 'recommend',
        });
      }
    } catch {
      // skip
    }
  }
}
