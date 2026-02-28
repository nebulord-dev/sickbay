# Framework-Scoped Checks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement `ProjectContext` infrastructure and use it to fix React/browser-only runners, then add three new Node-specific check runners (security middleware, input validation, async error handling).

**Architecture:** Add a `ProjectContext` type computed once per scan that describes runtime/frameworks/tooling. `BaseRunner` gains `applicableFrameworks`/`applicableRuntimes` fields and an `isApplicableToContext()` method. The orchestrator filters runners through these before dispatch. Three new runners declare `applicableRuntimes = ['node']` and run only on Node projects.

**Tech Stack:** TypeScript, Vitest, `packages/core` only — no CLI or web changes needed.

**Design doc:** `docs/plans/2026-02-27-framework-scoped-checks-design.md`

---

### Task 1: Add ProjectContext types to types.ts

**Files:**
- Modify: `packages/core/src/types.ts`

**Step 1: Add the new types**

Add these exports immediately before the `ToolRunner` interface in `packages/core/src/types.ts`:

```typescript
export type Framework     = 'react' | 'next' | 'angular' | 'vue' | 'svelte' | 'remix';
export type Runtime       = 'browser' | 'node' | 'edge' | 'unknown';
export type BuildTool     = 'vite' | 'webpack' | 'esbuild' | 'rollup' | 'tsc' | 'unknown';
export type TestFramework = 'vitest' | 'jest' | 'mocha' | null;

export interface ProjectContext {
  runtime:       Runtime;
  frameworks:    Framework[];
  buildTool:     BuildTool;
  testFramework: TestFramework;
}
```

Also update the `ToolRunner` interface — change the `isApplicable` signature and add `isApplicableToContext`:

```typescript
export interface ToolRunner {
  name: string;
  category: CheckResult['category'];
  run(projectPath: string, options?: RunOptions): Promise<CheckResult>;
  isApplicable(projectPath: string, context: ProjectContext): Promise<boolean>;
  isApplicableToContext(context: ProjectContext): boolean;
}
```

**Step 2: Build to confirm no type errors**

```bash
cd /path/to/vitals && pnpm --filter @vitals/core build
```

Expected: builds successfully.

**Step 3: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "feat(core): add ProjectContext types and update ToolRunner interface"
```

---

### Task 2: Implement detectContext() in detect-project.ts

**Files:**
- Modify: `packages/core/src/utils/detect-project.ts`
- Modify: `packages/core/src/utils/detect-project.test.ts`

**Step 1: Write failing tests**

Add a new `describe('detectContext', ...)` block at the bottom of `packages/core/src/utils/detect-project.test.ts`. The existing mock setup at the top of the file already covers `existsSync` and `readFileSync`, so just add the import and tests:

```typescript
import { detectProject, detectPackageManager, detectContext } from './detect-project.js';
```

Then add at the bottom of the file:

```typescript
describe('detectContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockImplementation((p) => String(p).endsWith('package.json'));
    mockReadFileSync.mockReturnValue(makePkg() as never);
  });

  it('returns node runtime when no frontend framework is detected', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ dependencies: { express: '^4.0.0' } }) as never);
    const ctx = await detectContext('/project');
    expect(ctx.runtime).toBe('node');
    expect(ctx.frameworks).toEqual([]);
  });

  it('returns browser runtime for a React project', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ dependencies: { react: '^18.0.0' } }) as never);
    const ctx = await detectContext('/project');
    expect(ctx.runtime).toBe('browser');
    expect(ctx.frameworks).toContain('react');
  });

  it('includes both react and next for a Next.js project', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ dependencies: { next: '^14.0.0', react: '^18.0.0' } }) as never);
    const ctx = await detectContext('/project');
    expect(ctx.frameworks).toContain('react');
    expect(ctx.frameworks).toContain('next');
  });

  it('detects vite as build tool', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ devDependencies: { vite: '^5.0.0', react: '^18.0.0' } }) as never,
    );
    const ctx = await detectContext('/project');
    expect(ctx.buildTool).toBe('vite');
  });

  it('detects vitest as test framework', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ devDependencies: { vitest: '^1.0.0' } }) as never,
    );
    const ctx = await detectContext('/project');
    expect(ctx.testFramework).toBe('vitest');
  });

  it('returns null testFramework when no test framework detected', async () => {
    const ctx = await detectContext('/project');
    expect(ctx.testFramework).toBeNull();
  });

  it('returns unknown runtime when package.json is missing', async () => {
    mockExistsSync.mockReturnValue(false);
    const ctx = await detectContext('/project');
    expect(ctx.runtime).toBe('unknown');
    expect(ctx.frameworks).toEqual([]);
  });

  it('detects angular framework', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ dependencies: { '@angular/core': '^17.0.0' } }) as never,
    );
    const ctx = await detectContext('/project');
    expect(ctx.frameworks).toContain('angular');
    expect(ctx.runtime).toBe('browser');
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @vitals/core test -- detect-project --reporter=verbose
```

Expected: `detectContext is not a function` or similar import error.

**Step 3: Implement detectContext()**

Add to `packages/core/src/utils/detect-project.ts` — add the import for the new types at the top, then add the function after `detectPackageManager`:

```typescript
import type { ProjectInfo, ProjectContext, Framework, Runtime, BuildTool, TestFramework } from '../types.js';
```

Then add the function:

```typescript
export async function detectContext(projectPath: string): Promise<ProjectContext> {
  const pkgPath = join(projectPath, 'package.json');
  if (!existsSync(pkgPath)) {
    return { runtime: 'unknown', frameworks: [], buildTool: 'unknown', testFramework: null };
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const deps: Record<string, string> = pkg.dependencies ?? {};
  const devDeps: Record<string, string> = pkg.devDependencies ?? {};
  const allDeps = { ...deps, ...devDeps };

  const frameworks: Framework[] = [];
  if ('@angular/core' in allDeps) frameworks.push('angular');
  if ('next' in allDeps) {
    frameworks.push('react', 'next');
  } else if ('@remix-run/react' in allDeps) {
    frameworks.push('react', 'remix');
  } else if ('react' in allDeps) {
    frameworks.push('react');
  }
  if ('vue' in allDeps) frameworks.push('vue');
  if ('svelte' in allDeps) frameworks.push('svelte');

  const runtime: Runtime = frameworks.length === 0 ? 'node' : 'browser';

  let buildTool: BuildTool = 'unknown';
  if ('vite' in allDeps || '@vitejs/plugin-react' in allDeps) buildTool = 'vite';
  else if ('webpack' in allDeps) buildTool = 'webpack';
  else if ('esbuild' in allDeps) buildTool = 'esbuild';
  else if ('rollup' in allDeps) buildTool = 'rollup';
  else if ('typescript' in allDeps) buildTool = 'tsc';

  let testFramework: TestFramework = null;
  if ('vitest' in allDeps) testFramework = 'vitest';
  else if ('jest' in allDeps) testFramework = 'jest';
  else if ('mocha' in allDeps) testFramework = 'mocha';

  return { runtime, frameworks, buildTool, testFramework };
}
```

**Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @vitals/core test -- detect-project --reporter=verbose
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add packages/core/src/utils/detect-project.ts packages/core/src/utils/detect-project.test.ts
git commit -m "feat(core): implement detectContext() for per-project framework/runtime detection"
```

---

### Task 3: Update BaseRunner with applicableFrameworks/Runtimes and isApplicableToContext()

**Files:**
- Modify: `packages/core/src/integrations/base.ts`
- Modify: `packages/core/src/integrations/base.test.ts`

**Step 1: Write failing tests**

Open `packages/core/src/integrations/base.test.ts`. Add a mock for types and a test suite for `isApplicableToContext`. Add these after the existing imports and mocks — check what mocks exist already and add only what's missing.

Add to the test file:

```typescript
import type { ProjectContext } from '../types.js';

function makeContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    runtime: 'browser',
    frameworks: ['react'],
    buildTool: 'vite',
    testFramework: 'vitest',
    ...overrides,
  };
}
```

Then add a new describe block for `isApplicableToContext`:

```typescript
describe('isApplicableToContext', () => {
  it('returns true when no applicableFrameworks or applicableRuntimes are set', () => {
    const runner = new TestRunner();
    expect(runner.isApplicableToContext(makeContext())).toBe(true);
  });

  it('returns true when frameworks include a match', () => {
    const runner = new TestRunner();
    (runner as any).applicableFrameworks = ['react'];
    expect(runner.isApplicableToContext(makeContext({ frameworks: ['react'] }))).toBe(true);
  });

  it('returns false when no framework match', () => {
    const runner = new TestRunner();
    (runner as any).applicableFrameworks = ['angular'];
    expect(runner.isApplicableToContext(makeContext({ frameworks: ['react'] }))).toBe(false);
  });

  it('returns true when applicableRuntimes includes the project runtime', () => {
    const runner = new TestRunner();
    (runner as any).applicableRuntimes = ['node'];
    expect(runner.isApplicableToContext(makeContext({ runtime: 'node', frameworks: [] }))).toBe(true);
  });

  it('returns false when runtime does not match applicableRuntimes', () => {
    const runner = new TestRunner();
    (runner as any).applicableRuntimes = ['browser'];
    expect(runner.isApplicableToContext(makeContext({ runtime: 'node', frameworks: [] }))).toBe(false);
  });

  it('returns false when frameworks match but runtime does not', () => {
    const runner = new TestRunner();
    (runner as any).applicableFrameworks = ['react'];
    (runner as any).applicableRuntimes = ['browser'];
    expect(runner.isApplicableToContext(makeContext({ frameworks: ['react'], runtime: 'node' }))).toBe(false);
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @vitals/core test -- base --reporter=verbose
```

Expected: `runner.isApplicableToContext is not a function`.

**Step 3: Implement the changes to base.ts**

Replace the entire content of `packages/core/src/integrations/base.ts` with:

```typescript
import type { CheckResult, Framework, ProjectContext, Runtime, RunOptions, ToolRunner } from '../types.js';
import { timer } from '../utils/file-helpers.js';

export abstract class BaseRunner implements ToolRunner {
  abstract name: string;
  abstract category: CheckResult['category'];

  abstract run(projectPath: string, options?: RunOptions): Promise<CheckResult>;

  applicableFrameworks?: Framework[];
  applicableRuntimes?: Runtime[];

  isApplicableToContext(context: ProjectContext): boolean {
    if (this.applicableFrameworks) {
      const hasMatch = this.applicableFrameworks.some((f) => context.frameworks.includes(f));
      if (!hasMatch) return false;
    }
    if (this.applicableRuntimes) {
      if (!this.applicableRuntimes.includes(context.runtime)) return false;
    }
    return true;
  }

  async isApplicable(_projectPath: string, _context: ProjectContext): Promise<boolean> {
    return true;
  }

  protected elapsed = timer;

  protected skipped(reason: string): CheckResult {
    return {
      id: this.name,
      category: this.category,
      name: this.name,
      score: 100,
      status: 'skipped',
      issues: [],
      toolsUsed: [this.name],
      duration: 0,
      metadata: { reason },
    };
  }
}
```

**Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @vitals/core test -- base --reporter=verbose
```

Expected: all tests pass.

**Step 5: Run full core test suite to confirm nothing is broken**

```bash
pnpm --filter @vitals/core test
```

Expected: all existing tests still pass.

**Step 6: Commit**

```bash
git add packages/core/src/integrations/base.ts packages/core/src/integrations/base.test.ts
git commit -m "feat(core): add applicableFrameworks/Runtimes and isApplicableToContext to BaseRunner"
```

---

### Task 4: Update runner.ts to use detectContext() and isApplicableToContext()

**Files:**
- Modify: `packages/core/src/runner.ts`

**Step 1: Update runner.ts**

The change is in `runVitals()`. Import `detectContext` and call it once, then filter runners through `isApplicableToContext` before the existing `isApplicable` call.

At the top of `runner.ts`, add `detectContext` to the import:

```typescript
import { detectProject, detectContext } from './utils/detect-project.js';
```

In `runVitals()`, the current logic is:

```typescript
const projectInfo = await detectProject(projectPath);

const runners = options.checks
  ? ALL_RUNNERS.filter((r) => options.checks!.includes(r.name))
  : ALL_RUNNERS;

const checks: CheckResult[] = [];

const results = await Promise.allSettled(
  runners.map(async (runner) => {
    const applicable = await runner.isApplicable(projectPath, projectInfo);
    if (!applicable) return null;
    ...
  })
);
```

Replace the body of `runVitals()` with:

```typescript
const projectPath = options.projectPath ?? process.cwd();
const projectInfo = await detectProject(projectPath);
const context = await detectContext(projectPath);

const candidateRunners = options.checks
  ? ALL_RUNNERS.filter((r) => options.checks!.includes(r.name))
  : ALL_RUNNERS;

// Filter by context first (synchronous, cheap) then by isApplicable (async, may do I/O)
const runners = candidateRunners.filter((r) => r.isApplicableToContext(context));

const checks: CheckResult[] = [];

const results = await Promise.allSettled(
  runners.map(async (runner) => {
    const applicable = await runner.isApplicable(projectPath, context);
    if (!applicable) return null;

    options.onCheckStart?.(runner.name);
    const result = await runner.run(projectPath, { verbose: options.verbose });
    options.onCheckComplete?.(result);
    return result;
  })
);

for (const result of results) {
  if (result.status === 'fulfilled' && result.value) {
    checks.push(result.value);
  }
}

const overallScore = calculateOverallScore(checks);
const summary = buildSummary(checks);

return {
  timestamp: new Date().toISOString(),
  projectPath,
  projectInfo,
  checks,
  overallScore,
  summary,
};
```

**Step 2: Build and run core tests**

```bash
pnpm --filter @vitals/core build && pnpm --filter @vitals/core test
```

Expected: builds and all tests pass.

**Step 3: Commit**

```bash
git add packages/core/src/runner.ts
git commit -m "feat(core): orchestrator uses detectContext() and filters via isApplicableToContext()"
```

---

### Task 5: Fix react-perf.ts — replace broken isApplicable with applicableFrameworks

**Files:**
- Modify: `packages/core/src/integrations/react-perf.ts`
- Modify: `packages/core/src/integrations/react-perf.test.ts`

**Context:** `react-perf.isApplicable()` currently checks `fileExists(projectPath, "src")` — this is wrong. It runs on any Node project with a `src/` directory. The fix is to declare `applicableFrameworks` so the orchestrator skips it for non-React projects.

**Step 1: Update the test**

Open `packages/core/src/integrations/react-perf.test.ts`. Find any tests for `isApplicable` and remove them (since we're removing that override). If there are no `isApplicable` tests, skip this step.

Instead add a test confirming `applicableFrameworks` is set correctly:

```typescript
it('only applies to react/next/remix frameworks', () => {
  const runner = new ReactPerfRunner();
  expect(runner.applicableFrameworks).toContain('react');
  expect(runner.applicableFrameworks).toContain('next');
});
```

**Step 2: Update react-perf.ts**

In `packages/core/src/integrations/react-perf.ts`:

1. Add `applicableFrameworks = ['react', 'next', 'remix'] as const;` as a class property (after `category = "performance" as const;`).
2. Delete the entire `isApplicable()` method.

The class declaration should now look like:

```typescript
export class ReactPerfRunner extends BaseRunner {
  name = "react-perf";
  category = "performance" as const;
  applicableFrameworks = ['react', 'next', 'remix'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    // ... unchanged
  }
}
```

**Step 3: Run tests**

```bash
pnpm --filter @vitals/core test -- react-perf --reporter=verbose
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add packages/core/src/integrations/react-perf.ts packages/core/src/integrations/react-perf.test.ts
git commit -m "fix(core): scope react-perf to React/Next/Remix projects via applicableFrameworks"
```

---

### Task 6: Fix source-map-explorer.ts and asset-size.ts — scope to browser runtime

**Files:**
- Modify: `packages/core/src/integrations/source-map-explorer.ts`
- Modify: `packages/core/src/integrations/asset-size.ts`
- Modify: `packages/core/src/integrations/source-map-explorer.test.ts`
- Modify: `packages/core/src/integrations/asset-size.test.ts`

**Context:** Both runners check for `dist/` or asset directories which also exist in compiled Node projects. Scoping to `runtime: 'browser'` is the correct fix.

**Step 1: Update source-map-explorer.ts**

1. Add `applicableRuntimes = ['browser'] as const;` as a class property.
2. Delete the `isApplicable()` method.

**Step 2: Update asset-size.ts**

1. Add `applicableRuntimes = ['browser'] as const;` as a class property.
2. Delete the `isApplicable()` method.

**Step 3: Update tests for both runners**

In each runner's test file, remove any tests that test `isApplicable()` directly (since the method is deleted). Add a property test:

```typescript
it('only applies to browser runtime', () => {
  const runner = new SourceMapExplorerRunner(); // or AssetSizeRunner
  expect(runner.applicableRuntimes).toContain('browser');
});
```

**Step 4: Run tests**

```bash
pnpm --filter @vitals/core test -- source-map-explorer asset-size --reporter=verbose
```

Expected: all tests pass.

**Step 5: Run full suite**

```bash
pnpm --filter @vitals/core test
```

Expected: all tests pass.

**Step 6: Commit**

```bash
git add packages/core/src/integrations/source-map-explorer.ts packages/core/src/integrations/source-map-explorer.test.ts packages/core/src/integrations/asset-size.ts packages/core/src/integrations/asset-size.test.ts
git commit -m "fix(core): scope source-map-explorer and asset-size to browser runtime"
```

---

### Task 7: Build NodeSecurityRunner

**Files:**
- Create: `packages/core/src/integrations/node-security.ts`
- Create: `packages/core/src/integrations/node-security.test.ts`

**Step 1: Write failing tests first**

Create `packages/core/src/integrations/node-security.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeSecurityRunner } from './node-security.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
}));

import { existsSync, readFileSync } from 'fs';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

function makePkg(deps: Record<string, string> = {}, devDeps: Record<string, string> = {}): string {
  return JSON.stringify({ dependencies: deps, devDependencies: devDeps });
}

describe('NodeSecurityRunner', () => {
  let runner: NodeSecurityRunner;

  beforeEach(() => {
    runner = new NodeSecurityRunner();
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  it('only applies to node runtime', () => {
    expect(runner.applicableRuntimes).toContain('node');
  });

  it('is in the security category', () => {
    expect(runner.category).toBe('security');
  });

  it('scores 100 when all three security packages are present', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ helmet: '^7.0.0', cors: '^2.0.0', 'express-rate-limit': '^7.0.0' }) as never,
    );
    const result = await runner.run('/project');
    expect(result.score).toBe(100);
    expect(result.status).toBe('pass');
    expect(result.issues).toHaveLength(0);
  });

  it('scores 0 when no security packages are present', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ express: '^4.0.0' }) as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(0);
    expect(result.status).toBe('fail');
    expect(result.issues).toHaveLength(3);
  });

  it('deducts 35 points for missing helmet, marks it critical', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ cors: '^2.0.0', 'express-rate-limit': '^7.0.0' }) as never,
    );
    const result = await runner.run('/project');
    expect(result.score).toBe(65);
    const helmetIssue = result.issues.find((i) => i.message.includes('helmet'));
    expect(helmetIssue?.severity).toBe('critical');
  });

  it('deducts 30 points for missing cors, marks it warning', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ helmet: '^7.0.0', 'express-rate-limit': '^7.0.0' }) as never,
    );
    const result = await runner.run('/project');
    expect(result.score).toBe(70);
    const corsIssue = result.issues.find((i) => i.message.includes('CORS'));
    expect(corsIssue?.severity).toBe('warning');
  });

  it('deducts 35 points for missing rate limiting, marks it warning', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ helmet: '^7.0.0', cors: '^2.0.0' }) as never,
    );
    const result = await runner.run('/project');
    expect(result.score).toBe(65);
    const rateIssue = result.issues.find((i) => i.message.includes('rate limit'));
    expect(rateIssue?.severity).toBe('warning');
  });

  it('accepts alternative helmet package (koa-helmet)', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ 'koa-helmet': '^7.0.0', cors: '^2.0.0', 'express-rate-limit': '^7.0.0' }) as never,
    );
    const result = await runner.run('/project');
    expect(result.score).toBe(100);
  });

  it('returns skipped when package.json is missing', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await runner.run('/project');
    expect(result.status).toBe('skipped');
  });
});
```

**Step 2: Run to confirm tests fail**

```bash
pnpm --filter @vitals/core test -- node-security --reporter=verbose
```

Expected: `Cannot find module './node-security.js'`.

**Step 3: Implement node-security.ts**

Create `packages/core/src/integrations/node-security.ts`:

```typescript
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { CheckResult, Issue } from '../types.js';
import { BaseRunner } from './base.js';
import { timer } from '../utils/file-helpers.js';

const HELMET_PACKAGES  = ['helmet', 'koa-helmet', 'fastify-helmet'];
const CORS_PACKAGES    = ['cors', '@koa/cors', '@fastify/cors', 'koa2-cors'];
const RATE_LIMIT_PACKAGES = [
  'express-rate-limit',
  'rate-limiter-flexible',
  '@fastify/rate-limit',
  'koa-ratelimit',
];

export class NodeSecurityRunner extends BaseRunner {
  name     = 'node-security';
  category = 'security' as const;
  applicableRuntimes = ['node'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const pkgPath = join(projectPath, 'package.json');

    if (!existsSync(pkgPath)) {
      return this.skipped('No package.json found');
    }

    const pkg     = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

    const hasHelmet    = HELMET_PACKAGES.some((p) => p in allDeps);
    const hasCors      = CORS_PACKAGES.some((p) => p in allDeps);
    const hasRateLimit = RATE_LIMIT_PACKAGES.some((p) => p in allDeps);

    const issues: Issue[] = [];
    let score = 0;

    if (hasHelmet) {
      score += 35;
    } else {
      issues.push({
        severity: 'critical',
        message: 'Missing security headers middleware (helmet). HTTP security headers protect against XSS, clickjacking, MIME sniffing, and other common attacks.',
        fix: {
          description: 'Install helmet and add app.use(helmet()) before your routes',
          command: 'npm install helmet',
        },
        reportedBy: ['node-security'],
      });
    }

    if (hasCors) {
      score += 30;
    } else {
      issues.push({
        severity: 'warning',
        message: 'Missing CORS middleware. Without explicit CORS configuration your API may be inaccessible from browser clients or accept requests from any origin.',
        fix: {
          description: 'Install cors and configure allowed origins explicitly',
          command: 'npm install cors',
        },
        reportedBy: ['node-security'],
      });
    }

    if (hasRateLimit) {
      score += 35;
    } else {
      issues.push({
        severity: 'warning',
        message: 'Missing rate limiting middleware. Without rate limiting your API is vulnerable to DoS attacks and credential brute-forcing.',
        fix: {
          description: 'Install express-rate-limit and configure limits per route or globally',
          command: 'npm install express-rate-limit',
        },
        reportedBy: ['node-security'],
      });
    }

    const status = score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail';

    return {
      id: 'node-security',
      category: this.category,
      name: 'Node Security Middleware',
      score,
      status,
      issues,
      toolsUsed: ['node-security'],
      duration: elapsed(),
    };
  }
}
```

**Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @vitals/core test -- node-security --reporter=verbose
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add packages/core/src/integrations/node-security.ts packages/core/src/integrations/node-security.test.ts
git commit -m "feat(core): add NodeSecurityRunner for helmet/cors/rate-limit detection"
```

---

### Task 8: Build NodeInputValidationRunner

**Files:**
- Create: `packages/core/src/integrations/node-input-validation.ts`
- Create: `packages/core/src/integrations/node-input-validation.test.ts`

**Step 1: Write failing tests**

Create `packages/core/src/integrations/node-input-validation.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeInputValidationRunner } from './node-input-validation.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
}));

import { existsSync, readFileSync } from 'fs';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

function makePkg(deps: Record<string, string> = {}, devDeps: Record<string, string> = {}): string {
  return JSON.stringify({ dependencies: deps, devDependencies: devDeps });
}

describe('NodeInputValidationRunner', () => {
  let runner: NodeInputValidationRunner;

  beforeEach(() => {
    runner = new NodeInputValidationRunner();
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  it('only applies to node runtime', () => {
    expect(runner.applicableRuntimes).toContain('node');
  });

  it('is in the code-quality category', () => {
    expect(runner.category).toBe('code-quality');
  });

  it('scores 85 and passes when zod is present', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ zod: '^3.0.0' }) as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(85);
    expect(result.status).toBe('pass');
  });

  it('scores 85 when joi is present', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ joi: '^17.0.0' }) as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(85);
  });

  it('scores 85 when express-validator is present', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ 'express-validator': '^7.0.0' }) as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(85);
  });

  it('scores 20 with a warning when no validation library is found', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ express: '^4.0.0' }) as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(20);
    expect(result.status).toBe('warning');
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].fix?.command).toContain('npm install zod');
  });

  it('reports which library was found as an info issue', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ zod: '^3.0.0' }) as never);
    const result = await runner.run('/project');
    expect(result.issues[0].severity).toBe('info');
    expect(result.issues[0].message).toContain('zod');
  });

  it('returns skipped when package.json is missing', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await runner.run('/project');
    expect(result.status).toBe('skipped');
  });
});
```

**Step 2: Run to confirm tests fail**

```bash
pnpm --filter @vitals/core test -- node-input-validation --reporter=verbose
```

Expected: module not found error.

**Step 3: Implement node-input-validation.ts**

Create `packages/core/src/integrations/node-input-validation.ts`:

```typescript
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { CheckResult, Issue } from '../types.js';
import { BaseRunner } from './base.js';
import { timer } from '../utils/file-helpers.js';

const VALIDATION_PACKAGES = [
  'zod',
  'joi',
  'express-validator',
  'yup',
  'ajv',
  '@sinclair/typebox',
  'valibot',
];

export class NodeInputValidationRunner extends BaseRunner {
  name     = 'node-input-validation';
  category = 'code-quality' as const;
  applicableRuntimes = ['node'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const pkgPath = join(projectPath, 'package.json');

    if (!existsSync(pkgPath)) {
      return this.skipped('No package.json found');
    }

    const pkg     = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

    const found = VALIDATION_PACKAGES.find((p) => p in allDeps);

    if (found) {
      const issues: Issue[] = [
        {
          severity: 'info',
          message: `Input validation library detected: ${found}`,
          reportedBy: ['node-input-validation'],
        },
      ];
      return {
        id: 'node-input-validation',
        category: this.category,
        name: 'Input Validation',
        score: 85,
        status: 'pass',
        issues,
        toolsUsed: ['node-input-validation'],
        duration: elapsed(),
      };
    }

    const issues: Issue[] = [
      {
        severity: 'warning',
        message:
          'No input validation library found. Without validation, your API may accept malformed data leading to runtime errors or security vulnerabilities.',
        fix: {
          description: 'Add an input validation library and validate all incoming request data',
          command: 'npm install zod',
        },
        reportedBy: ['node-input-validation'],
      },
    ];

    return {
      id: 'node-input-validation',
      category: this.category,
      name: 'Input Validation',
      score: 20,
      status: 'warning',
      issues,
      toolsUsed: ['node-input-validation'],
      duration: elapsed(),
    };
  }
}
```

**Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @vitals/core test -- node-input-validation --reporter=verbose
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add packages/core/src/integrations/node-input-validation.ts packages/core/src/integrations/node-input-validation.test.ts
git commit -m "feat(core): add NodeInputValidationRunner for validation library detection"
```

---

### Task 9: Build NodeAsyncErrorsRunner

**Files:**
- Create: `packages/core/src/integrations/node-async-errors.ts`
- Create: `packages/core/src/integrations/node-async-errors.test.ts`

**Context:** This runner scans source files for async route handlers missing try/catch protection. It uses `express-async-errors` dep presence as a fast-pass signal (that package monkey-patches Express to wrap all handlers automatically).

**Step 1: Write failing tests**

Create `packages/core/src/integrations/node-async-errors.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeAsyncErrorsRunner } from './node-async-errors.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
}));

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);

function makePkg(deps: Record<string, string> = {}): string {
  return JSON.stringify({ dependencies: deps });
}

describe('NodeAsyncErrorsRunner', () => {
  let runner: NodeAsyncErrorsRunner;

  beforeEach(() => {
    runner = new NodeAsyncErrorsRunner();
    vi.clearAllMocks();
    // Default: package.json exists, src/ dir exists, no source files
    mockExistsSync.mockImplementation((p) => {
      const s = String(p);
      return s.endsWith('package.json') || s.endsWith('src');
    });
    mockReadFileSync.mockReturnValue(makePkg() as never);
    mockReaddirSync.mockReturnValue([] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
  });

  it('only applies to node runtime', () => {
    expect(runner.applicableRuntimes).toContain('node');
  });

  it('is in the code-quality category', () => {
    expect(runner.category).toBe('code-quality');
  });

  it('scores 100 when express-async-errors is in deps', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ 'express-async-errors': '^3.0.0' }) as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(100);
    expect(result.status).toBe('pass');
  });

  it('scores 90 when no async route handlers are found', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ express: '^4.0.0' }) as never);
    // No source files — mockReaddirSync returns [] by default
    const result = await runner.run('/project');
    expect(result.score).toBe(90);
    expect(result.status).toBe('pass');
  });

  it('scores low when async route handlers exist without try/catch', async () => {
    mockReadFileSync.mockImplementation((p: unknown) => {
      if (String(p).endsWith('package.json')) return makePkg({ express: '^4.0.0' }) as never;
      // Source file with async route, no try/catch
      return `
        const router = require('express').Router();
        router.get('/users', async (req, res) => {
          const users = await db.find();
          res.json(users);
        });
      ` as never;
    });
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['routes.js'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);

    const result = await runner.run('/project');
    expect(result.score).toBeLessThan(50);
    expect(result.issues.some((i) => i.severity === 'critical')).toBe(true);
  });

  it('scores high when async route handlers all have try/catch', async () => {
    mockReadFileSync.mockImplementation((p: unknown) => {
      if (String(p).endsWith('package.json')) return makePkg({ express: '^4.0.0' }) as never;
      return `
        router.get('/users', async (req, res) => {
          try {
            const users = await db.find();
            res.json(users);
          } catch (err) {
            next(err);
          }
        });
      ` as never;
    });
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['routes.js'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);

    const result = await runner.run('/project');
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('returns skipped when package.json is missing', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await runner.run('/project');
    expect(result.status).toBe('skipped');
  });
});
```

**Step 2: Run to confirm tests fail**

```bash
pnpm --filter @vitals/core test -- node-async-errors --reporter=verbose
```

Expected: module not found error.

**Step 3: Implement node-async-errors.ts**

Create `packages/core/src/integrations/node-async-errors.ts`:

```typescript
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import type { CheckResult, Issue } from '../types.js';
import { BaseRunner } from './base.js';
import { timer } from '../utils/file-helpers.js';

const SOURCE_EXTENSIONS = new Set(['.js', '.ts', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'test', 'tests', '__tests__']);

// Detects async route handler declarations
const ASYNC_ROUTE_RE = /(?:app|router)\s*\.\s*(?:get|post|put|patch|delete|all)\s*\([^;]*\basync\b/s;
// Detects try/catch usage
const TRY_CATCH_RE = /\btry\s*\{/;
// Detects express-async-errors import/require
const ASYNC_ERRORS_RE = /require\s*\(\s*['"]express-async-errors['"]\s*\)|from\s+['"]express-async-errors['"]/;
// Detects 4-param error middleware
const ERROR_MIDDLEWARE_RE = /\(\s*(?:err|error)\s*,\s*\w+\s*,\s*\w+\s*,\s*\w+\s*\)\s*(?:=>|\{)/;

function collectSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        files.push(...collectSourceFiles(full));
      } else if (SOURCE_EXTENSIONS.has(extname(entry))) {
        files.push(full);
      }
    } catch {
      // skip unreadable entries
    }
  }
  return files;
}

export class NodeAsyncErrorsRunner extends BaseRunner {
  name     = 'node-async-errors';
  category = 'code-quality' as const;
  applicableRuntimes = ['node'] as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const pkgPath = join(projectPath, 'package.json');

    if (!existsSync(pkgPath)) {
      return this.skipped('No package.json found');
    }

    const pkg     = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

    // express-async-errors patches Express globally — all handlers are protected
    if ('express-async-errors' in allDeps) {
      return {
        id: 'node-async-errors',
        category: this.category,
        name: 'Async Error Handling',
        score: 100,
        status: 'pass',
        issues: [
          {
            severity: 'info',
            message: 'express-async-errors detected — all async route handlers are automatically protected.',
            reportedBy: ['node-async-errors'],
          },
        ],
        toolsUsed: ['node-async-errors'],
        duration: elapsed(),
      };
    }

    const srcDir = join(projectPath, 'src');
    const files  = collectSourceFiles(existsSync(srcDir) ? srcDir : projectPath);

    let routeFiles   = 0;
    let protectedFiles = 0;
    let hasErrorMiddleware = false;

    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8');
        if (ASYNC_ERRORS_RE.test(content)) {
          hasErrorMiddleware = true; // local import counts as protected
          continue;
        }
        if (ERROR_MIDDLEWARE_RE.test(content)) hasErrorMiddleware = true;
        if (!ASYNC_ROUTE_RE.test(content)) continue;

        routeFiles++;
        if (TRY_CATCH_RE.test(content)) protectedFiles++;
      } catch {
        // skip unreadable files
      }
    }

    const issues: Issue[] = [];

    if (routeFiles === 0) {
      // No async route handlers found — nothing to flag
      return {
        id: 'node-async-errors',
        category: this.category,
        name: 'Async Error Handling',
        score: 90,
        status: 'pass',
        issues,
        toolsUsed: ['node-async-errors'],
        duration: elapsed(),
      };
    }

    const unprotectedFiles = routeFiles - protectedFiles;
    const protectionRatio  = protectedFiles / routeFiles;

    if (unprotectedFiles > 0) {
      issues.push({
        severity: unprotectedFiles === routeFiles ? 'critical' : 'warning',
        message: `${unprotectedFiles} of ${routeFiles} route file(s) contain async handlers without try/catch. Unhandled promise rejections will crash the process in Node.js <15 or produce silent failures.`,
        fix: {
          description: 'Wrap async route handlers in try/catch or use express-async-errors to auto-wrap all handlers',
          command: 'npm install express-async-errors',
        },
        reportedBy: ['node-async-errors'],
      });
    }

    if (!hasErrorMiddleware) {
      issues.push({
        severity: 'warning',
        message: 'No Express error handling middleware found (4-parameter function: err, req, res, next). Without it, errors passed to next() have no centralized handler.',
        fix: {
          description: 'Add app.use((err, req, res, next) => { res.status(500).json({ error: err.message }); }) after all routes',
        },
        reportedBy: ['node-async-errors'],
      });
    }

    const baseScore     = Math.round(protectionRatio * 70);
    const middlewareBonus = hasErrorMiddleware ? 20 : 0;
    const score         = Math.min(100, baseScore + middlewareBonus);
    const status        = score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail';

    return {
      id: 'node-async-errors',
      category: this.category,
      name: 'Async Error Handling',
      score,
      status,
      issues,
      toolsUsed: ['node-async-errors'],
      duration: elapsed(),
    };
  }
}
```

**Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @vitals/core test -- node-async-errors --reporter=verbose
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add packages/core/src/integrations/node-async-errors.ts packages/core/src/integrations/node-async-errors.test.ts
git commit -m "feat(core): add NodeAsyncErrorsRunner for async error handling detection"
```

---

### Task 10: Register new runners and verify against fixtures

**Files:**
- Modify: `packages/core/src/runner.ts`
- Modify: `packages/core/src/index.ts` (if new runners need to be exported)

**Step 1: Register the three new runners in runner.ts**

Add imports at the top of `packages/core/src/runner.ts`:

```typescript
import { NodeSecurityRunner } from './integrations/node-security.js';
import { NodeInputValidationRunner } from './integrations/node-input-validation.js';
import { NodeAsyncErrorsRunner } from './integrations/node-async-errors.js';
```

Add to `ALL_RUNNERS` array:

```typescript
new NodeSecurityRunner(),
new NodeInputValidationRunner(),
new NodeAsyncErrorsRunner(),
```

**Step 2: Build the full monorepo**

```bash
cd /path/to/vitals && pnpm build
```

Expected: all packages build successfully.

**Step 3: Run the full core test suite**

```bash
pnpm --filter @vitals/core test
```

Expected: all tests pass (should be ~340+ tests).

**Step 4: Verify against the React fixture — no Node runners should appear**

```bash
node packages/cli/dist/index.js --path fixtures/packages/react-app --json | jq '.checks[] | {id, status}' | grep -E 'node-security|node-input|node-async'
```

Expected: empty output — no Node runners in the React project results.

**Step 5: Verify against the Node fixture — Node runners should run and catch issues**

```bash
node packages/cli/dist/index.js --path fixtures/packages/node-api --json | jq '.checks[] | select(.id | startswith("node-")) | {id, score, status}'
```

Expected output should show all three Node runners with low scores:
```json
{"id":"node-security","score":0,"status":"fail"}
{"id":"node-input-validation","score":20,"status":"warning"}
{"id":"node-async-errors","score":...,"status":"warning or fail"}
```

**Step 6: Verify react-perf is NOT in the Node fixture results**

```bash
node packages/cli/dist/index.js --path fixtures/packages/node-api --json | jq '.checks[] | select(.id == "react-perf")'
```

Expected: empty output.

**Step 7: Verify react-perf IS in the React fixture results**

```bash
node packages/cli/dist/index.js --path fixtures/packages/react-app --json | jq '.checks[] | select(.id == "react-perf") | {id, status}'
```

Expected: `{"id":"react-perf","status":"pass"}` or `"warning"`.

**Step 8: Final commit**

```bash
git add packages/core/src/runner.ts
git commit -m "feat(core): register Node-specific runners, complete framework-scoped checks implementation"
```

---

## Summary

After completing all tasks:

- `ProjectContext` is computed once per scan, describing runtime/frameworks/tooling
- `BaseRunner` supports declarative `applicableFrameworks`/`applicableRuntimes` — new runners just set properties
- `react-perf` only runs on React/Next/Remix projects (previously ran on any project with `src/`)
- `source-map-explorer` and `asset-size` only run on browser projects
- Three new Node-specific runners catch real issues in the `node-api` fixture
- The pattern is established: adding Angular, Vue, or any future framework means adding runners + declaring context, zero changes to existing code
