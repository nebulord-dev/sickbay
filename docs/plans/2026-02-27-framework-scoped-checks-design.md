# Framework-Scoped Checks — Implementation Design

**Date**: 2026-02-27
**Status**: Approved

## Overview

Implement the `ProjectContext` infrastructure (as specified in `2026-02-27-context-aware-checks-design.md`)
and use it to fix misdetecting existing runners and add three new Node-specific check runners.

After this work: running Vitals against a React project shows a React-appropriate check suite;
running against a Node API shows a Node-appropriate suite with no cross-contamination.

---

## Phase 1: ProjectContext Infrastructure

Four files change in `packages/core`.

### `types.ts`

Add new types alongside existing ones:

```typescript
type Framework     = 'react' | 'next' | 'angular' | 'vue' | 'svelte' | 'remix';
type Runtime       = 'browser' | 'node' | 'edge' | 'unknown';
type BuildTool     = 'vite' | 'webpack' | 'esbuild' | 'rollup' | 'tsc' | 'unknown';
type TestFramework = 'vitest' | 'jest' | 'mocha' | null;

interface ProjectContext {
  runtime:       Runtime;
  frameworks:    Framework[];
  buildTool:     BuildTool;
  testFramework: TestFramework;
}
```

### `detect-project.ts`

Add `detectContext(projectPath): Promise<ProjectContext>`. Reads `package.json` once.

Detection rules:

| Signal | Result |
|--------|--------|
| `next` in deps | `frameworks: ['react', 'next']` |
| `react` in deps (no next) | `frameworks: ['react']` |
| `@angular/core` in deps | `frameworks: ['angular']` |
| `vue` in deps | `frameworks: ['vue']` |
| `svelte` in deps | `frameworks: ['svelte']` |
| `@remix-run/react` in deps | `frameworks: ['react', 'remix']` |
| No frontend framework | `frameworks: []`, `runtime: 'node'` |
| Frontend framework present | `runtime: 'browser'` |
| `vite` in devDeps | `buildTool: 'vite'` |
| `webpack` in devDeps | `buildTool: 'webpack'` |
| `vitest` in devDeps | `testFramework: 'vitest'` |
| `jest` in devDeps | `testFramework: 'jest'` |
| `mocha` in devDeps | `testFramework: 'mocha'` |

`ProjectInfo` and `detectProject()` are untouched — this is purely additive.

### `base.ts`

Add to `BaseRunner`:

```typescript
applicableFrameworks?: Framework[];
applicableRuntimes?:   Runtime[];

isApplicableToContext(context: ProjectContext): boolean {
  if (this.applicableFrameworks) {
    const hasMatch = this.applicableFrameworks.some(f => context.frameworks.includes(f));
    if (!hasMatch) return false;
  }
  if (this.applicableRuntimes) {
    if (!this.applicableRuntimes.includes(context.runtime)) return false;
  }
  return true;
}
```

Change `isApplicable()` second argument from `ProjectInfo` → `ProjectContext`. No runner currently
uses this argument, so this is a type-only change with zero behavior impact.

### `runner.ts`

Call `detectContext()` once before dispatch. Filter runners through `isApplicableToContext()`
(synchronous) then `isApplicable()` (async, may do I/O):

```typescript
const context = await detectContext(projectPath);

const applicable = await Promise.all(
  ALL_RUNNERS.map(async runner => {
    if (!runner.isApplicableToContext(context)) return null;
    if (!await runner.isApplicable(projectPath, context)) return null;
    return runner;
  })
);
const runners = applicable.filter(Boolean);
```

---

## Phase 2: Fix Misdetecting Existing Runners

### `react-perf.ts`

**Problem**: `isApplicable()` checks `fileExists(projectPath, "src")` — runs on any Node project
with a `src/` directory.

**Fix**: Set `applicableFrameworks = ['react', 'next', 'remix'] as const`. Delete the
`isApplicable()` override entirely.

### `source-map-explorer.ts`

**Problem**: Checks for `dist/` or `build/` directory — Node APIs compiled with `tsc` also have `dist/`.

**Fix**: Set `applicableRuntimes = ['browser'] as const`. Source map bundle analysis is only
meaningful for browser bundles.

### `asset-size.ts`

**Problem**: Checks for asset directories — same false-positive risk as source-map-explorer.

**Fix**: Set `applicableRuntimes = ['browser'] as const`.

All other runners (`git`, `knip`, `depcheck`, `npm-audit`, `eslint`, `jscpd`, `madge`,
`coverage`, `typescript`, `secrets`, `license-checker`, `todo-scanner`, `complexity`,
`heavy-deps`) are universal — no change needed.

---

## Phase 3: New Node Runners

All three: `applicableRuntimes = ['node'] as const`. Registered in `ALL_RUNNERS` in `runner.ts`.

### `node-security.ts` — category: `security`

Checks `package.json` deps for security middleware presence. Three pillars:

| Package(s) | Score contribution | Severity if missing |
|---|---|---|
| `helmet`, `koa-helmet`, `fastify-helmet` | +35 pts | critical |
| `cors`, `@koa/cors`, `@fastify/cors` | +30 pts | warning |
| `express-rate-limit`, `rate-limiter-flexible`, `@fastify/rate-limit` | +35 pts | warning |

Score = sum of pillars present. Each missing pillar → issue with `npm install <package>` fix command.

### `node-input-validation.ts` — category: `code-quality`

Checks deps for any validation library: `zod`, `joi`, `express-validator`, `yup`, `ajv`,
`@sinclair/typebox`, `valibot`.

- Library present → score 85, `info` noting which library
- No library → score 20, `warning` with fix suggestion

Does not attempt to verify the library is actually used in routes (too complex for v1).

### `node-async-errors.ts` — category: `code-quality`

Two signals:

1. **Async handler protection** — scan `.js`/`.ts` source files for async route handler patterns
   (`app.get(..., async`, `router.post(..., async`, etc.). Count those with a `try/catch` block
   or wrapped in `asyncHandler(` / covered by `express-async-errors` import.
   Score based on ratio of protected vs unprotected handlers.

2. **Error middleware** — look for a 4-parameter Express error handler
   (`(err, req, res, next)`) in source files. Absent → `warning` issue.

Score: 100 if all async handlers protected + error middleware present. A Node API with no
async protection → score ~10, `critical` issue.

---

## Phase 4: Verification

Run against both fixtures and confirm no cross-contamination:

**`fixtures/packages/react-app`** (Vite + React):
- `react-perf` ✅ runs
- `source-map-explorer`, `asset-size` ✅ run (has `dist/`)
- `node-security`, `node-input-validation`, `node-async-errors` ⛔ skipped

**`fixtures/packages/node-api`** (Express-style Node API):
- `node-security` ✅ runs → catches missing helmet/cors/rate-limiting
- `node-input-validation` ✅ runs → catches no validation library
- `node-async-errors` ✅ runs → catches unprotected async handlers
- `react-perf`, `source-map-explorer`, `asset-size` ⛔ skipped

---

## What This Unlocks

- Every future framework just needs `applicableFrameworks = ['angular']` on its runners — zero changes to existing code
- Monorepo support (Phase 3) calls `detectContext()` per-package — identical filtering, no orchestrator changes
- The scattered `isApplicable()` detection pattern is replaced with a single detection point
