import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AngularLazyRoutesRunner } from './angular-lazy-routes.js';

vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
}));

import { readdirSync, statSync, readFileSync } from 'fs';

const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('AngularLazyRoutesRunner', () => {
  let runner: AngularLazyRoutesRunner;

  beforeEach(() => {
    runner = new AngularLazyRoutesRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for angular only', () => {
    expect(runner.applicableFrameworks).toEqual(['angular']);
    expect(runner.category).toBe('performance');
    expect(runner.name).toBe('angular-lazy-routes');
  });

  it('returns pass with score 100 when no route files exist', async () => {
    mockReaddirSync.mockReturnValue([] as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.metadata?.routeFiles).toBe(0);
    expect(result.id).toBe('angular-lazy-routes');
  });

  it('returns pass when route file exists but contains no route entries', async () => {
    const content = `
      // Empty routes file
      export const routes: Routes = [];
    `;
    mockReaddirSync.mockReturnValue(['app.routes.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.metadata?.routeFiles).toBe(1);
    expect(result.metadata?.totalRoutes).toBe(0);
  });

  it('returns pass when all routes are lazy (loadComponent:)', async () => {
    const content = `
      export const routes: Routes = [
        { path: 'home', loadComponent: () => import('./home.component').then(m => m.HomeComponent) },
        { path: 'about', loadComponent: () => import('./about.component').then(m => m.AboutComponent) },
      ];
    `;
    mockReaddirSync.mockReturnValue(['app.routes.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.metadata?.lazyRoutes).toBe(2);
    expect(result.metadata?.staticRoutes).toBe(0);
  });

  it('returns warning when routes are static (component:)', async () => {
    const content = `
      export const routes: Routes = [
        { path: '', component: AppComponent },
        { path: 'users', component: UserListComponent },
      ];
    `;
    mockReaddirSync.mockReturnValue(['app.routes.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('static route');
    expect(result.issues[0].fix?.description).toContain('loadComponent');
  });

  it('scores using ratio: 2 lazy / 4 total → 50', async () => {
    const content = `
      export const routes: Routes = [
        { path: 'a', loadComponent: () => import('./a').then(m => m.A) },
        { path: 'b', loadComponent: () => import('./b').then(m => m.B) },
        { path: 'c', component: CComponent },
        { path: 'd', component: DComponent },
      ];
    `;
    mockReaddirSync.mockReturnValue(['app.routes.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(50);
  });

  it('scores 0 static routes → 20 (floor via max)', async () => {
    const content = [
      '{ path: "a", component: A }',
      '{ path: "b", component: B }',
      '{ path: "c", component: C }',
      '{ path: "d", component: D }',
      '{ path: "e", component: E }',
      '{ path: "f", component: F }',
    ].join('\n');
    mockReaddirSync.mockReturnValue(['app.routes.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(20);
  });

  it('only recognises *.routes.ts and app.config.ts as route files', async () => {
    mockReaddirSync.mockReturnValue(['app.component.ts', 'app.service.ts', 'main.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(100);
    expect(result.metadata?.routeFiles).toBe(0);
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('also picks up app.config.ts as a route file', async () => {
    const content = `
      export const appConfig: ApplicationConfig = {
        providers: [provideRouter([
          { path: 'home', component: HomeComponent },
        ])],
      };
    `;
    mockReaddirSync.mockReturnValue(['app.config.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.metadata?.routeFiles).toBe(1);
    expect(result.issues).toHaveLength(1);
  });

  it('returns fail status when an unexpected error is thrown', async () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error('disk error');
    });
    const result = await runner.run('/project');
    expect(result.status).toBe('fail');
  });
});
