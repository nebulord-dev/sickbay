import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AngularBestPracticesAdvisor } from './angular-best-practices.js';

import type { ProjectContext } from '../types.js';

vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

import { readdirSync, statSync, readFileSync, existsSync } from 'fs';

const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockExistsSync = vi.mocked(existsSync);

const angularContext: ProjectContext = {
  runtime: 'browser',
  frameworks: ['angular'],
  buildTool: 'webpack',
  testFramework: 'jest',
};

const reactContext: ProjectContext = {
  runtime: 'browser',
  frameworks: ['react'],
  buildTool: 'vite',
  testFramework: 'vitest',
};

describe('AngularBestPracticesAdvisor', () => {
  let advisor: AngularBestPracticesAdvisor;

  beforeEach(() => {
    advisor = new AngularBestPracticesAdvisor();
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockReturnValue([] as never);
  });

  describe('applicability', () => {
    it('applies to angular projects', () => {
      expect(advisor.isApplicableToContext(angularContext)).toBe(true);
    });

    it('does not apply to react projects', () => {
      expect(advisor.isApplicableToContext(reactContext)).toBe(false);
    });
  });

  describe('standalone components', () => {
    it('suggests standalone when NgModule with declarations found', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['app.module.ts'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { '@angular/core': '^17.0.0' } });
        return '@NgModule({ declarations: [AppComponent] })';
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', angularContext);
      expect(recs.find((r) => r.id === 'angular-standalone-components')).toBeDefined();
    });

    it('skips when no NgModule declarations', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['app.component.ts'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { '@angular/core': '^17.0.0' } });
        return '@Component({ standalone: true })';
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', angularContext);
      expect(recs.find((r) => r.id === 'angular-standalone-components')).toBeUndefined();
    });
  });

  describe('signal inputs', () => {
    it('suggests signal inputs when @Input() found', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['comp.ts'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { '@angular/core': '^17.0.0' } });
        return '@Input() name: string;';
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', angularContext);
      expect(recs.find((r) => r.id === 'angular-signal-inputs')).toBeDefined();
    });
  });

  describe('legacy control flow', () => {
    it('suggests modern control flow when *ngFor found', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['list.ts'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { '@angular/core': '^17.0.0' } });
        return '<li *ngFor="let item of items">{{ item }}</li>';
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', angularContext);
      expect(recs.find((r) => r.id === 'angular-control-flow')).toBeDefined();
    });

    it('suggests modern control flow when *ngIf found', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['comp.ts'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { '@angular/core': '^17.0.0' } });
        return '<div *ngIf="show">content</div>';
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', angularContext);
      expect(recs.find((r) => r.id === 'angular-control-flow')).toBeDefined();
    });
  });

  describe('SSR/hydration', () => {
    it('suggests SSR when no @angular/ssr or hydration', async () => {
      mockExistsSync.mockReturnValue(false);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { '@angular/core': '^17.0.0' } });
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', angularContext);
      expect(recs.find((r) => r.id === 'angular-ssr')).toBeDefined();
    });

    it('skips when @angular/ssr in deps', async () => {
      mockExistsSync.mockReturnValue(false);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({
            dependencies: { '@angular/core': '^17.0.0', '@angular/ssr': '^17.0.0' },
          });
        throw new Error('not found');
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', angularContext);
      expect(recs.find((r) => r.id === 'angular-ssr')).toBeUndefined();
    });
  });

  describe('legacy HttpModule', () => {
    it('suggests provideHttpClient when HttpClientModule found', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['app.module.ts'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
      mockReadFileSync.mockImplementation(((path: string) => {
        if (path.endsWith('package.json'))
          return JSON.stringify({ dependencies: { '@angular/core': '^17.0.0' } });
        return "import { HttpClientModule } from '@angular/common/http';";
      }) as typeof readFileSync);

      const recs = await advisor.run('/project', angularContext);
      expect(recs.find((r) => r.id === 'angular-http-client')).toBeDefined();
    });
  });

  describe('error resilience', () => {
    it('returns empty array when package.json is unreadable', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const recs = await advisor.run('/project', angularContext);
      expect(recs).toEqual([]);
    });
  });
});
