# Angular Fixture & Health Checks — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a modern Angular v17+ test fixture with intentional issues and four Angular-specific health check runners that only run on Angular projects.

**Architecture:** Fixture lives in `fixtures/packages/angular-app/` as a standalone pnpm workspace member. Four runners in `packages/core/src/integrations/` each declare `applicableFrameworks = ['angular'] as const` — the existing `BaseRunner.isApplicableToContext()` handles scoping automatically. About page descriptions are a one-line addition to a static map.

**Tech Stack:** TypeScript, Vitest (vi.mock pattern for fs mocking), Angular v17+ (standalone components, `@angular/core`), RxJS

**Spec:** `.claude/plans/angular-fixture-design.md`

---

## Chunk 1: Angular Fixture

### Task 1: Create the Angular fixture package

**Files:**
- Create: `fixtures/packages/angular-app/package.json`
- Create: `fixtures/packages/angular-app/tsconfig.json`
- Create: `fixtures/packages/angular-app/src/main.ts`
- Create: `fixtures/packages/angular-app/src/app.config.ts`
- Create: `fixtures/packages/angular-app/src/app.routes.ts`
- Create: `fixtures/packages/angular-app/src/app.component.ts`
- Create: `fixtures/packages/angular-app/src/components/header.component.ts`
- Create: `fixtures/packages/angular-app/src/components/user-list.component.ts`
- Create: `fixtures/packages/angular-app/src/components/product-card.component.ts`
- Create: `fixtures/packages/angular-app/src/services/data.service.ts`
- Modify: `fixtures/README.md`

- [ ] **Step 1: Create package.json**

```json
// fixtures/packages/angular-app/package.json
{
  "name": "angular-app",
  "version": "0.0.1",
  "description": "Angular test fixture for Sickbay — intentionally unhealthy",
  "private": true,
  "type": "module",
  "dependencies": {
    "@angular/common": "^17.3.0",
    "@angular/core": "^17.3.0",
    "@angular/platform-browser": "^17.3.0",
    "@angular/router": "^17.3.0",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "typescript": "~5.4.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json — intentionally missing strict settings**

```json
// fixtures/packages/angular-app/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": false,
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "lib": ["ES2022", "dom"],
    "outDir": "./dist/out-tsc",
    "sourceMap": true,
    "declaration": false,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  }
}
```

Note: intentionally no `angularCompilerOptions` block — triggers `angular-strict` check.

- [ ] **Step 3: Create src/main.ts**

```typescript
// fixtures/packages/angular-app/src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { appConfig } from './app.config';

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
```

- [ ] **Step 4: Create src/app.config.ts**

```typescript
// fixtures/packages/angular-app/src/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes)],
};
```

- [ ] **Step 5: Create src/app.routes.ts — intentionally all static (no lazy loading)**

```typescript
// fixtures/packages/angular-app/src/app.routes.ts
import { Routes } from '@angular/router';
import { HeaderComponent } from './components/header.component';
import { UserListComponent } from './components/user-list.component';
import { ProductCardComponent } from './components/product-card.component';

// Intentional: all routes use static component: imports instead of loadComponent()
// This triggers the angular-lazy-routes check.
export const routes: Routes = [
  { path: '', component: HeaderComponent },
  { path: 'header', component: HeaderComponent },
  { path: 'users', component: UserListComponent },
  { path: 'products', component: ProductCardComponent },
];
```

- [ ] **Step 6: Create src/app.component.ts — intentionally missing OnPush**

```typescript
// fixtures/packages/angular-app/src/app.component.ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// Intentional: no changeDetection: ChangeDetectionStrategy.OnPush
// This triggers the angular-change-detection check.
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {
  title = 'angular-app';
}
```

- [ ] **Step 7: Create src/components/header.component.ts — missing OnPush**

```typescript
// fixtures/packages/angular-app/src/components/header.component.ts
import { Component } from '@angular/core';

// Intentional: missing ChangeDetectionStrategy.OnPush
@Component({
  selector: 'app-header',
  standalone: true,
  template: `<header><h1>Angular App</h1></header>`,
})
export class HeaderComponent {
  links = ['Home', 'Users', 'Products'];
}
```

- [ ] **Step 8: Create src/components/user-list.component.ts — missing OnPush + unguarded subscription**

```typescript
// fixtures/packages/angular-app/src/components/user-list.component.ts
import { Component, OnInit } from '@angular/core';
import { NgFor } from '@angular/common';
import { DataService } from '../services/data.service';

// Intentional: missing ChangeDetectionStrategy.OnPush (triggers angular-change-detection)
// Intentional: .subscribe() with no takeUntilDestroyed / ngOnDestroy (triggers angular-subscriptions)
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [NgFor],
  template: `
    <ul>
      <li *ngFor="let user of users">{{ user.name }}</li>
    </ul>
  `,
})
export class UserListComponent implements OnInit {
  users: Array<{ id: number; name: string }> = [];

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getUsers().subscribe((users) => {
      this.users = users;
    });
  }
}
```

- [ ] **Step 9: Create src/components/product-card.component.ts — missing OnPush + unguarded subscription**

```typescript
// fixtures/packages/angular-app/src/components/product-card.component.ts
import { Component, OnInit } from '@angular/core';
import { NgFor, CurrencyPipe } from '@angular/common';
import { DataService } from '../services/data.service';

// Intentional: missing ChangeDetectionStrategy.OnPush (triggers angular-change-detection)
// Intentional: .subscribe() with no cleanup (triggers angular-subscriptions)
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [NgFor, CurrencyPipe],
  template: `
    <div *ngFor="let product of products">
      <h3>{{ product.name }}</h3>
      <p>{{ product.price | currency }}</p>
    </div>
  `,
})
export class ProductCardComponent implements OnInit {
  products: Array<{ id: number; name: string; price: number }> = [];

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getProducts().subscribe((products) => {
      this.products = products;
    });
  }
}
```

- [ ] **Step 10: Create src/services/data.service.ts**

```typescript
// fixtures/packages/angular-app/src/services/data.service.ts
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DataService {
  getUsers(): Observable<Array<{ id: number; name: string }>> {
    return of([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
  }

  getProducts(): Observable<Array<{ id: number; name: string; price: number }>> {
    return of([
      { id: 1, name: 'Widget', price: 9.99 },
      { id: 2, name: 'Gadget', price: 24.99 },
    ]);
  }
}
```

- [ ] **Step 11: Install Angular dependencies in the fixtures workspace**

```bash
cd fixtures && pnpm install
```

Expected: pnpm installs `@angular/core`, `@angular/router`, `rxjs`, etc. into `fixtures/node_modules`. No errors.

- [ ] **Step 12: Document angular-app in fixtures/README.md**

Add after the `node-api` section (before the "Adding a New Fixture" section):

```markdown
### `angular-app` — Angular v17+ Standalone

A modern Angular app using standalone components. Has intentional issues to verify Angular-specific checks fire correctly.

**Expect:** warnings on missing OnPush, static routes, disabled strict mode, and unguarded subscriptions; passes on generic code quality checks.

| Check | What's broken |
| --- | --- |
| `angular-change-detection` | All 4 components omit `ChangeDetectionStrategy.OnPush` |
| `angular-lazy-routes` | All routes use `component:` (static), none use `loadComponent:` |
| `angular-strict` | `strict: false` in tsconfig; no `angularCompilerOptions` block |
| `angular-subscriptions` | `user-list` and `product-card` subscribe without cleanup |
```

- [ ] **Step 13: Commit the fixture**

```bash
git add fixtures/packages/angular-app/ fixtures/pnpm-lock.yaml fixtures/README.md
git commit -m "feat: add angular-app test fixture with intentional issues"
```

---

## Chunk 2: Angular Runners

### Task 2: angular-change-detection runner

**Files:**
- Create: `packages/core/src/integrations/angular-change-detection.ts`
- Create: `packages/core/src/integrations/angular-change-detection.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/src/integrations/angular-change-detection.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AngularChangeDetectionRunner } from './angular-change-detection.js';

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

describe('AngularChangeDetectionRunner', () => {
  let runner: AngularChangeDetectionRunner;

  beforeEach(() => {
    runner = new AngularChangeDetectionRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for angular only', () => {
    expect(runner.applicableFrameworks).toEqual(['angular']);
    expect(runner.category).toBe('performance');
    expect(runner.name).toBe('angular-change-detection');
  });

  it('returns pass with score 100 when no component files exist', async () => {
    mockReaddirSync.mockReturnValue([] as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.id).toBe('angular-change-detection');
  });

  it('returns pass when all components have OnPush', async () => {
    const content = `
      @Component({
        selector: 'app-root',
        changeDetection: ChangeDetectionStrategy.OnPush,
        template: '',
      })
      export class AppComponent {}
    `;
    mockReaddirSync.mockReturnValue(['app.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns warning when a component is missing OnPush', async () => {
    const content = `
      @Component({ selector: 'app-root', template: '' })
      export class AppComponent {}
    `;
    mockReaddirSync.mockReturnValue(['app.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('OnPush');
    expect(result.issues[0].fix?.description).toContain('ChangeDetectionStrategy.OnPush');
  });

  it('scores: 1 missing → 85, 4 missing → 40, 7 missing → 20 (floor)', async () => {
    const missing = `@Component({ selector: 'x', template: '' }) export class C {}`;

    for (const [count, expected] of [[1, 85], [4, 40], [7, 20]] as [number, number][]) {
      vi.clearAllMocks();
      const files = Array.from({ length: count }, (_, i) => `comp${i}.component.ts`);
      mockReaddirSync.mockReturnValue(files as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
      mockReadFileSync.mockReturnValue(missing as never);
      const result = await runner.run('/project');
      expect(result.score).toBe(expected);
    }
  });

  it('does not scan non-.component.ts files', async () => {
    mockReaddirSync.mockReturnValue(['app.service.ts', 'app.routes.ts', 'app.module.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(100);
    expect(result.metadata?.filesScanned).toBe(0);
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('recurses into subdirectories', async () => {
    const content = `@Component({ selector: 'x', template: '' }) export class C {}`;
    mockReaddirSync
      .mockReturnValueOnce(['components'] as never)
      .mockReturnValueOnce(['header.component.ts'] as never);
    mockStatSync
      .mockReturnValueOnce({ isDirectory: () => true } as never)
      .mockReturnValueOnce({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.metadata?.filesScanned).toBe(1);
    expect(result.issues).toHaveLength(1);
  });

  it('includes file path in issue message', async () => {
    const content = `@Component({ selector: 'x', template: '' }) export class C {}`;
    mockReaddirSync.mockReturnValue(['app.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.issues[0].message).toContain('app.component.ts');
  });

  it('returns fail status when an unexpected error is thrown', async () => {
    mockReaddirSync.mockImplementation(() => { throw new Error('disk error'); });
    const result = await runner.run('/project');
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm --filter @nebulord/sickbay-core test -- --reporter=verbose angular-change-detection
```

Expected: multiple "Cannot find module" or "is not a constructor" errors — the runner file doesn't exist yet.

- [ ] **Step 3: Implement the runner**

```typescript
// packages/core/src/integrations/angular-change-detection.ts
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

import { timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

export class AngularChangeDetectionRunner extends BaseRunner {
  name = 'angular-change-detection';
  category = 'performance' as const;
  applicableFrameworks = ['angular'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const files = findComponentFiles(join(projectPath, 'src'), projectPath);
      const missing: string[] = [];

      for (const { relPath, fullPath } of files) {
        const content = readFileSync(fullPath, 'utf-8');
        if (
          content.includes('@Component(') &&
          !content.includes('ChangeDetectionStrategy.OnPush')
        ) {
          missing.push(relPath);
        }
      }

      const issues: Issue[] = missing.map((file) => ({
        severity: 'warning' as const,
        message: `${file} — component missing OnPush change detection`,
        file,
        fix: {
          description:
            'Add `changeDetection: ChangeDetectionStrategy.OnPush` to the @Component decorator to prevent unnecessary re-renders.',
        },
        reportedBy: ['angular-change-detection'],
      }));

      const score = Math.max(20, 100 - missing.length * 15);

      return {
        id: 'angular-change-detection',
        category: this.category,
        name: 'Angular Change Detection',
        score,
        status: missing.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['angular-change-detection'],
        duration: elapsed(),
        metadata: { filesScanned: files.length, missingOnPush: missing.length },
      };
    } catch (err) {
      return {
        id: 'angular-change-detection',
        category: this.category,
        name: 'Angular Change Detection',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['angular-change-detection'],
          },
        ],
        toolsUsed: ['angular-change-detection'],
        duration: elapsed(),
      };
    }
  }
}

interface FileEntry {
  relPath: string;
  fullPath: string;
}

function findComponentFiles(dir: string, projectRoot: string): FileEntry[] {
  const files: FileEntry[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...findComponentFiles(fullPath, projectRoot));
      } else if (entry.endsWith('.component.ts')) {
        files.push({ relPath: fullPath.replace(projectRoot + '/', ''), fullPath });
      }
    }
  } catch {
    /* directory doesn't exist */
  }
  return files;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm --filter @nebulord/sickbay-core test -- --reporter=verbose angular-change-detection
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/integrations/angular-change-detection.ts packages/core/src/integrations/angular-change-detection.test.ts
git commit -m "feat(core): add angular-change-detection runner"
```

---

### Task 3: angular-lazy-routes runner

**Files:**
- Create: `packages/core/src/integrations/angular-lazy-routes.ts`
- Create: `packages/core/src/integrations/angular-lazy-routes.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/src/integrations/angular-lazy-routes.test.ts
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
    mockReaddirSync.mockImplementation(() => { throw new Error('disk error'); });
    const result = await runner.run('/project');
    expect(result.status).toBe('fail');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm --filter @nebulord/sickbay-core test -- --reporter=verbose angular-lazy-routes
```

Expected: "Cannot find module" errors.

- [ ] **Step 3: Implement the runner**

```typescript
// packages/core/src/integrations/angular-lazy-routes.ts
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

import { timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

export class AngularLazyRoutesRunner extends BaseRunner {
  name = 'angular-lazy-routes';
  category = 'performance' as const;
  applicableFrameworks = ['angular'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const routeFiles = findRouteFiles(join(projectPath, 'src'), projectPath);

      if (routeFiles.length === 0) {
        return {
          id: 'angular-lazy-routes',
          category: this.category,
          name: 'Angular Lazy Routes',
          score: 100,
          status: 'pass',
          issues: [],
          toolsUsed: ['angular-lazy-routes'],
          duration: elapsed(),
          metadata: { routeFiles: 0, staticRoutes: 0, lazyRoutes: 0, totalRoutes: 0 },
        };
      }

      let lazyRoutes = 0;
      let staticRoutes = 0;
      const issues: Issue[] = [];

      for (const { relPath, fullPath } of routeFiles) {
        const content = readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('//') || line.startsWith('*')) continue;

          if (/\bloadComponent\s*:/.test(line)) {
            lazyRoutes++;
          } else if (/\bcomponent\s*:/.test(line)) {
            staticRoutes++;
            issues.push({
              severity: 'warning',
              message: `${relPath}:${i + 1} — static route component import; consider lazy loading`,
              file: relPath,
              fix: {
                description:
                  "Replace `component: MyComponent` with `loadComponent: () => import('./my.component').then(m => m.MyComponent)` to enable route-level code splitting.",
              },
              reportedBy: ['angular-lazy-routes'],
            });
          }
        }
      }

      const totalRoutes = lazyRoutes + staticRoutes;
      const score =
        totalRoutes === 0 ? 100 : Math.max(20, Math.round((lazyRoutes / totalRoutes) * 100));

      return {
        id: 'angular-lazy-routes',
        category: this.category,
        name: 'Angular Lazy Routes',
        score,
        status: staticRoutes > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['angular-lazy-routes'],
        duration: elapsed(),
        metadata: { routeFiles: routeFiles.length, staticRoutes, lazyRoutes, totalRoutes },
      };
    } catch (err) {
      return {
        id: 'angular-lazy-routes',
        category: this.category,
        name: 'Angular Lazy Routes',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['angular-lazy-routes'],
          },
        ],
        toolsUsed: ['angular-lazy-routes'],
        duration: elapsed(),
      };
    }
  }
}

interface FileEntry {
  relPath: string;
  fullPath: string;
}

function findRouteFiles(dir: string, projectRoot: string): FileEntry[] {
  const files: FileEntry[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...findRouteFiles(fullPath, projectRoot));
      } else if (entry.endsWith('.routes.ts') || entry === 'app.config.ts') {
        files.push({ relPath: fullPath.replace(projectRoot + '/', ''), fullPath });
      }
    }
  } catch {
    /* directory doesn't exist */
  }
  return files;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm --filter @nebulord/sickbay-core test -- --reporter=verbose angular-lazy-routes
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/integrations/angular-lazy-routes.ts packages/core/src/integrations/angular-lazy-routes.test.ts
git commit -m "feat(core): add angular-lazy-routes runner"
```

---

### Task 4: angular-strict runner

**Files:**
- Create: `packages/core/src/integrations/angular-strict.ts`
- Create: `packages/core/src/integrations/angular-strict.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/src/integrations/angular-strict.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AngularStrictRunner } from './angular-strict.js';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
}));

import { readFileSync, existsSync } from 'fs';

const mockReadFileSync = vi.mocked(readFileSync);
const mockExistsSync = vi.mocked(existsSync);

describe('AngularStrictRunner', () => {
  let runner: AngularStrictRunner;

  beforeEach(() => {
    runner = new AngularStrictRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for angular only', () => {
    expect(runner.applicableFrameworks).toEqual(['angular']);
    expect(runner.category).toBe('code-quality');
    expect(runner.name).toBe('angular-strict');
  });

  it('returns pass with score 100 when no tsconfig.json exists', async () => {
    mockExistsSync.mockReturnValue(false as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns pass when all three strict settings are enabled', async () => {
    mockExistsSync.mockReturnValue(true as never);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      compilerOptions: { strict: true },
      angularCompilerOptions: {
        strictTemplates: true,
        strictInjectionParameters: true,
      },
    }) as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.metadata?.strict).toBe(true);
    expect(result.metadata?.strictTemplates).toBe(true);
    expect(result.metadata?.strictInjectionParameters).toBe(true);
  });

  it('emits a warning for each missing strict setting', async () => {
    mockExistsSync.mockReturnValue(true as never);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      compilerOptions: { strict: false },
    }) as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(3);
    expect(result.issues.every((i) => i.severity === 'warning')).toBe(true);
    // Each issue should mention its setting
    expect(result.issues.find((i) => i.message.includes('strict mode'))).toBeDefined();
    expect(result.issues.find((i) => i.message.includes('strictTemplates'))).toBeDefined();
    expect(result.issues.find((i) => i.message.includes('strictInjectionParameters'))).toBeDefined();
  });

  it('scores: 0 missing → 100, 1 missing → 73, 2 missing → 46, 3 missing → 20', async () => {
    mockExistsSync.mockReturnValue(true as never);

    // 1 missing (no strict)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      compilerOptions: {},
      angularCompilerOptions: { strictTemplates: true, strictInjectionParameters: true },
    }) as never);
    let result = await runner.run('/project');
    expect(result.score).toBe(73);

    // 2 missing
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true as never);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      compilerOptions: {},
      angularCompilerOptions: { strictTemplates: true },
    }) as never);
    result = await runner.run('/project');
    expect(result.score).toBe(46);

    // 3 missing → floor 20
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true as never);
    mockReadFileSync.mockReturnValue(JSON.stringify({ compilerOptions: {} }) as never);
    result = await runner.run('/project');
    expect(result.score).toBe(20);
  });

  it('issue messages mention extends limitation for strict setting', async () => {
    mockExistsSync.mockReturnValue(true as never);
    mockReadFileSync.mockReturnValue(JSON.stringify({ compilerOptions: {} }) as never);
    const result = await runner.run('/project');
    expect(result.issues[0].message).toContain('extends');
  });

  it('returns fail status when tsconfig is malformed JSON', async () => {
    mockExistsSync.mockReturnValue(true as never);
    mockReadFileSync.mockReturnValue('not valid json' as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm --filter @nebulord/sickbay-core test -- --reporter=verbose angular-strict
```

Expected: "Cannot find module" errors.

- [ ] **Step 3: Implement the runner**

```typescript
// packages/core/src/integrations/angular-strict.ts
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

export class AngularStrictRunner extends BaseRunner {
  name = 'angular-strict';
  category = 'code-quality' as const;
  applicableFrameworks = ['angular'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const tsconfigPath = join(projectPath, 'tsconfig.json');

      if (!existsSync(tsconfigPath)) {
        return {
          id: 'angular-strict',
          category: this.category,
          name: 'Angular Strict Mode',
          score: 100,
          status: 'pass',
          issues: [],
          toolsUsed: ['angular-strict'],
          duration: elapsed(),
          metadata: { reason: 'no tsconfig.json found' },
        };
      }

      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
      const compilerOptions: Record<string, unknown> = tsconfig.compilerOptions ?? {};
      const angularOptions: Record<string, unknown> = tsconfig.angularCompilerOptions ?? {};

      const issues: Issue[] = [];

      if (!compilerOptions['strict']) {
        issues.push({
          severity: 'warning',
          message:
            'TypeScript strict mode is disabled — could not confirm strict mode is enabled (check parent configs if using extends)',
          fix: {
            description: 'Enable `strict: true` in `compilerOptions` for full TypeScript strict mode.',
          },
          reportedBy: ['angular-strict'],
        });
      }

      if (!angularOptions['strictTemplates']) {
        issues.push({
          severity: 'warning',
          message:
            'Angular strictTemplates is disabled — could not confirm strictTemplates is enabled (check parent configs if using extends)',
          fix: {
            description:
              'Enable `strictTemplates: true` in `angularCompilerOptions` to catch template type errors at build time.',
          },
          reportedBy: ['angular-strict'],
        });
      }

      if (!angularOptions['strictInjectionParameters']) {
        issues.push({
          severity: 'warning',
          message:
            'Angular strictInjectionParameters is disabled — could not confirm strictInjectionParameters is enabled (check parent configs if using extends)',
          fix: {
            description:
              'Enable `strictInjectionParameters: true` in `angularCompilerOptions` to catch missing injection token errors.',
          },
          reportedBy: ['angular-strict'],
        });
      }

      const score = Math.max(20, 100 - issues.length * 27);

      return {
        id: 'angular-strict',
        category: this.category,
        name: 'Angular Strict Mode',
        score,
        status: issues.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['angular-strict'],
        duration: elapsed(),
        metadata: {
          strict: !!compilerOptions['strict'],
          strictTemplates: !!angularOptions['strictTemplates'],
          strictInjectionParameters: !!angularOptions['strictInjectionParameters'],
        },
      };
    } catch (err) {
      return {
        id: 'angular-strict',
        category: this.category,
        name: 'Angular Strict Mode',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['angular-strict'],
          },
        ],
        toolsUsed: ['angular-strict'],
        duration: elapsed(),
      };
    }
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm --filter @nebulord/sickbay-core test -- --reporter=verbose angular-strict
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/integrations/angular-strict.ts packages/core/src/integrations/angular-strict.test.ts
git commit -m "feat(core): add angular-strict runner"
```

---

### Task 5: angular-subscriptions runner

**Files:**
- Create: `packages/core/src/integrations/angular-subscriptions.ts`
- Create: `packages/core/src/integrations/angular-subscriptions.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/src/integrations/angular-subscriptions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AngularSubscriptionsRunner } from './angular-subscriptions.js';

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

describe('AngularSubscriptionsRunner', () => {
  let runner: AngularSubscriptionsRunner;

  beforeEach(() => {
    runner = new AngularSubscriptionsRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for angular only', () => {
    expect(runner.applicableFrameworks).toEqual(['angular']);
    expect(runner.category).toBe('code-quality');
    expect(runner.name).toBe('angular-subscriptions');
  });

  it('returns pass with score 100 when no component files exist', async () => {
    mockReaddirSync.mockReturnValue([] as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.metadata?.filesScanned).toBe(0);
  });

  it('returns pass when components have no subscriptions', async () => {
    const content = `
      @Component({ selector: 'app', template: '' })
      export class AppComponent {}
    `;
    mockReaddirSync.mockReturnValue(['app.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
  });

  it('returns pass when subscription uses takeUntilDestroyed', async () => {
    const content = `
      export class MyComponent {
        constructor() {
          this.service.data$.pipe(takeUntilDestroyed()).subscribe(d => this.data = d);
        }
      }
    `;
    mockReaddirSync.mockReturnValue(['my.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
  });

  it('returns pass when subscription uses takeUntil', async () => {
    const content = `
      export class MyComponent {
        ngOnInit() { this.svc.data$.pipe(takeUntil(this.destroy$)).subscribe(d => {}); }
      }
    `;
    mockReaddirSync.mockReturnValue(['my.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
  });

  it('returns pass when component implements ngOnDestroy', async () => {
    const content = `
      export class MyComponent implements OnDestroy {
        sub = this.svc.data$.subscribe(d => this.data = d);
        ngOnDestroy() { this.sub.unsubscribe(); }
      }
    `;
    mockReaddirSync.mockReturnValue(['my.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
  });

  it('returns warning when subscription has no cleanup', async () => {
    const content = `
      export class UserListComponent implements OnInit {
        ngOnInit() {
          this.dataService.getUsers().subscribe(users => { this.users = users; });
        }
      }
    `;
    mockReaddirSync.mockReturnValue(['user-list.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('possible unguarded subscription');
    expect(result.issues[0].fix?.description).toContain('takeUntilDestroyed');
  });

  it('scores: 2 leaky → 60, 5 leaky → 20 (floor)', async () => {
    const leaky = `export class C { ngOnInit() { this.svc.data$.subscribe(d => {}); } }`;

    mockReaddirSync.mockReturnValue(['a.component.ts', 'b.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(leaky as never);
    let result = await runner.run('/project');
    expect(result.score).toBe(60);

    vi.clearAllMocks();
    mockReaddirSync.mockReturnValue([
      'a.component.ts', 'b.component.ts', 'c.component.ts', 'd.component.ts', 'e.component.ts',
    ] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(leaky as never);
    result = await runner.run('/project');
    expect(result.score).toBe(20);
  });

  it('does not flag .service.ts or .routes.ts files', async () => {
    mockReaddirSync.mockReturnValue(['data.service.ts', 'app.routes.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(100);
    expect(result.metadata?.filesScanned).toBe(0);
  });

  it('returns fail status when an unexpected error is thrown', async () => {
    mockReaddirSync.mockImplementation(() => { throw new Error('disk error'); });
    const result = await runner.run('/project');
    expect(result.status).toBe('fail');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm --filter @nebulord/sickbay-core test -- --reporter=verbose angular-subscriptions
```

Expected: "Cannot find module" errors.

- [ ] **Step 3: Implement the runner**

```typescript
// packages/core/src/integrations/angular-subscriptions.ts
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

import { timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';

import type { CheckResult, Issue } from '../types.js';

const CLEANUP_PATTERNS = [
  'takeUntilDestroyed(',
  'takeUntil(',
  'DestroyRef',
  'ngOnDestroy',
  '.unsubscribe(',
];

export class AngularSubscriptionsRunner extends BaseRunner {
  name = 'angular-subscriptions';
  category = 'code-quality' as const;
  applicableFrameworks = ['angular'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();

    try {
      const files = findComponentFiles(join(projectPath, 'src'), projectPath);
      const leaky: string[] = [];

      for (const { relPath, fullPath } of files) {
        const content = readFileSync(fullPath, 'utf-8');
        if (content.includes('.subscribe(')) {
          const hasCleanup = CLEANUP_PATTERNS.some((p) => content.includes(p));
          if (!hasCleanup) {
            leaky.push(relPath);
          }
        }
      }

      const issues: Issue[] = leaky.map((file) => ({
        severity: 'warning' as const,
        message: `${file} — possible unguarded subscription (no takeUntilDestroyed, takeUntil, or ngOnDestroy found)`,
        file,
        fix: {
          description:
            "Use `takeUntilDestroyed()` from `@angular/core/rxjs-interop` or call `.unsubscribe()` in `ngOnDestroy` to prevent memory leaks.",
        },
        reportedBy: ['angular-subscriptions'],
      }));

      const score = Math.max(20, 100 - leaky.length * 20);

      return {
        id: 'angular-subscriptions',
        category: this.category,
        name: 'Angular Subscriptions',
        score,
        status: leaky.length > 0 ? 'warning' : 'pass',
        issues,
        toolsUsed: ['angular-subscriptions'],
        duration: elapsed(),
        metadata: { filesScanned: files.length, leakyComponents: leaky.length },
      };
    } catch (err) {
      return {
        id: 'angular-subscriptions',
        category: this.category,
        name: 'Angular Subscriptions',
        score: 0,
        status: 'fail',
        issues: [
          {
            severity: 'critical',
            message: `Check failed: ${err}`,
            reportedBy: ['angular-subscriptions'],
          },
        ],
        toolsUsed: ['angular-subscriptions'],
        duration: elapsed(),
      };
    }
  }
}

interface FileEntry {
  relPath: string;
  fullPath: string;
}

function findComponentFiles(dir: string, projectRoot: string): FileEntry[] {
  const files: FileEntry[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...findComponentFiles(fullPath, projectRoot));
      } else if (entry.endsWith('.component.ts')) {
        files.push({ relPath: fullPath.replace(projectRoot + '/', ''), fullPath });
      }
    }
  } catch {
    /* directory doesn't exist */
  }
  return files;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm --filter @nebulord/sickbay-core test -- --reporter=verbose angular-subscriptions
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/integrations/angular-subscriptions.ts packages/core/src/integrations/angular-subscriptions.test.ts
git commit -m "feat(core): add angular-subscriptions runner"
```

---

## Chunk 3: Integration

### Task 6: Register runners and update About page

**Files:**
- Modify: `packages/core/src/runner.ts`
- Modify: `apps/web/src/components/About.tsx`

- [ ] **Step 1: Register the four new runners in runner.ts**

In `packages/core/src/runner.ts`, add 4 imports after the existing runner imports:

```typescript
import { AngularChangeDetectionRunner } from './integrations/angular-change-detection.js';
import { AngularLazyRoutesRunner } from './integrations/angular-lazy-routes.js';
import { AngularStrictRunner } from './integrations/angular-strict.js';
import { AngularSubscriptionsRunner } from './integrations/angular-subscriptions.js';
```

Then add them to `ALL_RUNNERS` array (add after `ReactPerfRunner`):

```typescript
new AngularChangeDetectionRunner(),
new AngularLazyRoutesRunner(),
new AngularStrictRunner(),
new AngularSubscriptionsRunner(),
```

- [ ] **Step 2: Verify the runners are scoped correctly — quick smoke test**

```bash
pnpm --filter @nebulord/sickbay-core build
node -e "
const { runSickbay } = require('./packages/core/dist/index.js');
runSickbay({ projectPath: './fixtures/packages/react-app' }).then(r => {
  const angularChecks = r.checks.filter(c => c.id.startsWith('angular-'));
  const skipped = angularChecks.filter(c => c.status === 'skipped');
  console.log('Angular checks on react-app:', angularChecks.length, '— skipped:', skipped.length);
  if (angularChecks.length !== skipped.length) process.exit(1);
  console.log('OK — all angular checks skipped on non-angular project');
});
"
```

Expected: "OK — all angular checks skipped on non-angular project"

Note: if direct node invocation doesn't work due to ESM, use `pnpm --filter @nebulord/sickbay dev` and test manually instead.

- [ ] **Step 3: Add CHECK_DESCRIPTIONS entries in About.tsx**

In `apps/web/src/components/About.tsx`, add four entries to the `CHECK_DESCRIPTIONS` object after the `'asset-size'` entry:

```typescript
'angular-change-detection':
  'Scans Angular components for missing OnPush change detection strategy.',
'angular-lazy-routes': 'Checks Angular routes for lazy loading via loadComponent().',
'angular-strict': 'Verifies strict TypeScript and Angular compiler settings in tsconfig.json.',
'angular-subscriptions':
  'Detects RxJS subscriptions in components that are never unsubscribed.',
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/runner.ts apps/web/src/components/About.tsx
git commit -m "feat: register Angular runners and add About page descriptions"
```

---

### Task 7: Snapshot tests for angular-app fixture

**Files:**
- Modify: `tests/snapshots/fixture-regression.test.ts`

- [ ] **Step 1: Add the angular-app describe block**

In `tests/snapshots/fixture-regression.test.ts`, add after the `node-api` describe block:

```typescript
// --- angular-app fixture ---

describe('angular-app', () => {
  let report: SickbayReport;

  beforeAll(async () => {
    report = await runSickbay({
      projectPath: resolve(FIXTURES_DIR, 'angular-app'),
    });
  }, 120_000);

  it('projectInfo', () => {
    expect(normalizeProjectInfo(report.projectInfo)).toMatchSnapshot();
  });

  // Angular-specific checks — structural assertions (scores vary with ecosystem)
  const ANGULAR_CHECKS = [
    { id: 'angular-change-detection', category: 'performance' },
    { id: 'angular-lazy-routes', category: 'performance' },
    { id: 'angular-strict', category: 'code-quality' },
    { id: 'angular-subscriptions', category: 'code-quality' },
  ];

  for (const { id, category } of ANGULAR_CHECKS) {
    it(`${id} runs and is not skipped`, () => {
      const check = report.checks.find((c) => c.id === id);
      expect(check).toBeDefined();
      expect(check?.status).not.toBe('skipped');
      expect(check?.category).toBe(category);
      expect(check?.score).toBeGreaterThanOrEqual(0);
      expect(check?.score).toBeLessThanOrEqual(100);
    });
  }

  // Angular checks should produce warnings on our intentionally broken fixture
  it('angular-change-detection reports missing OnPush', () => {
    const check = report.checks.find((c) => c.id === 'angular-change-detection');
    expect(check?.status).toBe('warning');
    expect(check?.issues.length).toBeGreaterThan(0);
  });

  it('angular-lazy-routes reports static routes', () => {
    const check = report.checks.find((c) => c.id === 'angular-lazy-routes');
    expect(check?.status).toBe('warning');
    expect(check?.issues.length).toBeGreaterThan(0);
  });

  it('angular-strict reports missing strict settings', () => {
    const check = report.checks.find((c) => c.id === 'angular-strict');
    expect(check?.status).toBe('warning');
    expect(check?.issues.length).toBeGreaterThan(0);
  });

  it('angular-subscriptions reports unguarded subscriptions', () => {
    const check = report.checks.find((c) => c.id === 'angular-subscriptions');
    expect(check?.status).toBe('warning');
    expect(check?.issues.length).toBeGreaterThan(0);
  });

  // React/Node-specific checks should not run on Angular
  it('react-perf is absent or skipped', () => {
    const check = report.checks.find((c) => c.id === 'react-perf');
    if (check) expect(check.status).toBe('skipped');
  });

  it('node-security is absent or skipped', () => {
    const check = report.checks.find((c) => c.id === 'node-security');
    if (check) expect(check.status).toBe('skipped');
  });

  it('node-async-errors is absent or skipped', () => {
    const check = report.checks.find((c) => c.id === 'node-async-errors');
    if (check) expect(check.status).toBe('skipped');
  });

  it('node-input-validation is absent or skipped', () => {
    const check = report.checks.find((c) => c.id === 'node-input-validation');
    if (check) expect(check.status).toBe('skipped');
  });

  // Environment-sensitive checks
  for (const { id, category } of ENVIRONMENT_SENSITIVE_CHECKS) {
    it(`${id} has valid structure`, () => assertUnstableCheck(report, id, category));
  }

  it('npm-audit has valid structure', () => assertUnstableCheck(report, 'npm-audit', 'security'));
  it('outdated has valid structure', () => assertUnstableCheck(report, 'outdated', 'dependencies'));

  it('overall score is in expected range', () => {
    expect(report.overallScore).toBeGreaterThanOrEqual(20);
    expect(report.overallScore).toBeLessThanOrEqual(85);
  });

  it('summary shape', () => {
    expect(report.summary).toMatchObject({
      critical: expect.any(Number),
      warnings: expect.any(Number),
      info: expect.any(Number),
    });
  });
});
```

- [ ] **Step 2: Run the snapshot tests to generate initial snapshots**

```bash
pnpm --filter @nebulord/sickbay-snapshots test -- --reporter=verbose
```

Expected: `projectInfo` snapshot is written for `angular-app`. All structural assertions pass. May take 60–120 seconds (runs all checks against the fixture). If any angular check comes back `skipped`, verify `@angular/core` is listed in `fixtures/packages/angular-app/package.json` and `pnpm install` was run in the fixtures directory.

- [ ] **Step 3: Commit**

```bash
git add tests/snapshots/fixture-regression.test.ts tests/snapshots/__snapshots__/
git commit -m "test: add angular-app fixture regression tests"
```

---

### Task 8: Full build and test

- [ ] **Step 1: Build all packages**

```bash
pnpm build
```

Expected: no errors. All packages build in order (core → cli → web).

- [ ] **Step 2: Run all unit tests**

```bash
pnpm --filter @nebulord/sickbay-core test
```

Expected: all tests pass including the four new runner test files.

- [ ] **Step 3: Verify manually against the angular-app fixture**

```bash
node apps/cli/dist/index.js --path fixtures/packages/angular-app
```

Expected output:
- Header shows project name `angular-app`
- Angular-specific checks appear in results (angular-change-detection, angular-lazy-routes, angular-strict, angular-subscriptions) — all `warning`
- `react-perf` does NOT appear
- `node-security`, `node-async-errors`, `node-input-validation` do NOT appear

- [ ] **Step 4: Verify About page in web dashboard**

```bash
node apps/cli/dist/index.js --path fixtures/packages/angular-app --web
```

Expected: open web dashboard, go to About tab — four Angular check entries appear under their categories (performance and code-quality) with descriptions.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: KAN-130 — Angular fixture and health checks complete"
```
