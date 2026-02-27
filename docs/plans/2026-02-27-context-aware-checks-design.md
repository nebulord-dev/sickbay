# Context-Aware Checks — Architecture Design

**Date**: 2026-02-27
**Status**: Approved

## Overview

Make check runners context-aware so they only run when relevant to the detected project
(framework, runtime, tooling). Adding support for a new framework — Angular, Vue, Express,
etc. — should require only adding new runners and detection logic, with zero changes to
existing runners or the orchestrator.

This follows the **Open/Closed Principle**: the system is open for extension (new frameworks,
new runners) but closed for modification (existing runners don't need to be audited or changed
when a new framework is added).

---

## Current State and Problems

`detect-project.ts` returns a `ProjectInfo` with a single `framework` string:

```typescript
framework: 'next' | 'vite' | 'cra' | 'react' | 'unknown'
```

Problems:

1. **Single-value** — can't express "this is a React + Next.js + TypeScript project"
2. **No runtime concept** — no distinction between a browser app and a Node API
3. **Detection is scattered** — each runner re-detects context itself inside `isApplicable()`,
   leading to inconsistency (`react-perf` checks if `src/` exists rather than "is this React?")
4. **Adding a framework requires auditing all runners** — to ensure none accidentally run on
   the new framework type, you must touch existing code, violating OCP

---

## Design

### 1. Replace `framework` with `ProjectContext`

Add a richer `ProjectContext` type computed once per project scan. `ProjectInfo` retains its
existing fields for backwards compatibility; `projectContext` is added alongside it.

```typescript
type Framework = 'react' | 'next' | 'angular' | 'vue' | 'svelte' | 'remix' | 'astro';
type Runtime   = 'browser' | 'node' | 'edge' | 'unknown';
type BuildTool = 'vite' | 'webpack' | 'esbuild' | 'rollup' | 'tsc' | 'unknown';
type TestFramework = 'vitest' | 'jest' | 'mocha' | null;

interface ProjectContext {
  runtime: Runtime;
  frameworks: Framework[];       // e.g. ['react', 'next'] for a Next.js app
  buildTool: BuildTool;
  testFramework: TestFramework;
}
```

Detection rules (in `detect-project.ts`):

| Signal | Result |
|--------|--------|
| `@angular/core` in deps | `frameworks: ['angular']` |
| `next` in deps | `frameworks: ['react', 'next']` |
| `react` in deps (no next) | `frameworks: ['react']` |
| `vue` in deps | `frameworks: ['vue']` |
| No frontend framework | `frameworks: []`, `runtime: 'node'` |
| `vite` in devDeps | `buildTool: 'vite'` |
| `vitest` in devDeps | `testFramework: 'vitest'` |
| `jest` in devDeps | `testFramework: 'jest'` |

### 2. Declarative applicability on runners

Runners declare what they need. The base class handles the filtering automatically.

```typescript
// BaseRunner — new field + default isApplicableToContext()
abstract class BaseRunner {
  applicableFrameworks?: Framework[];   // undefined = runs on all projects
  applicableRuntimes?: Runtime[];       // undefined = runs on all runtimes

  isApplicableToContext(context: ProjectContext): boolean {
    if (this.applicableFrameworks) {
      const hasMatch = this.applicableFrameworks.some(f =>
        context.frameworks.includes(f)
      );
      if (!hasMatch) return false;
    }
    if (this.applicableRuntimes) {
      if (!this.applicableRuntimes.includes(context.runtime)) return false;
    }
    return true;
  }

  // isApplicable() remains as an escape hatch for complex conditions
  // (e.g. CoverageRunner checks if vitest/jest config is present)
  async isApplicable(_projectPath: string, _context: ProjectContext): Promise<boolean> {
    return true;
  }
}
```

Runners that are framework-specific just set the property:

```typescript
class ReactPerfRunner extends BaseRunner {
  applicableFrameworks = ['react', 'next', 'remix'] as const;
  // No isApplicable override needed
}

class AngularRunner extends BaseRunner {
  applicableFrameworks = ['angular'] as const;
  // Same pattern — added without touching anything else
}
```

Runners that run everywhere (e.g. `git`, `npm-audit`, `jscpd`) set nothing — they run by default.

Runners with complex conditions keep `isApplicable()` but now receive `ProjectContext`
instead of just `projectPath`:

```typescript
class CoverageRunner extends BaseRunner {
  async isApplicable(_projectPath: string, context: ProjectContext): Promise<boolean> {
    return context.testFramework !== null;
  }
}
```

### 3. Orchestrator filters once before dispatching

`runner.ts` computes context once, filters runners before any `Promise.allSettled` call:

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

No per-runner context detection. One place. Done.

---

## Adding a New Framework (e.g. Angular)

1. Add `'angular'` to the `Framework` union type in `types.ts`
2. Add detection in `detect-project.ts`: `'@angular/core' in deps → frameworks.push('angular')`
3. Create Angular-specific runners with `applicableFrameworks = ['angular']`
4. Done — existing runners are untouched, orchestrator is untouched

---

## Migration Path

Non-breaking. Each step is independently shippable.

1. Add `ProjectContext` to `types.ts`, add `detectContext()` to `detect-project.ts`
2. Add `applicableFrameworks`, `applicableRuntimes`, `isApplicableToContext()` to `BaseRunner`
3. Update `runner.ts` to call `isApplicableToContext()` before dispatching
4. Update `isApplicable()` signatures across runners to accept `ProjectContext` (was just `projectPath`)
5. Migrate runners one by one to use `applicableFrameworks` instead of manual `isApplicable` logic
6. Once all runners are migrated, deprecate the old `framework` single-string field from `ProjectInfo`

---

## Phase 3 (Monorepo) Compatibility

This design is a prerequisite for monorepo support. In a monorepo, `detectContext()` runs
**per package** — `packages/web` gets `{frameworks: ['react'], runtime: 'browser'}` and
`packages/api` gets `{frameworks: [], runtime: 'node'}`. The declarative runner system works
identically with no changes; the orchestrator just runs against a different context per package.

---

## Out of Scope

- Node-specific runners (Express, Fastify checks) — a separate backlog task; this design
  makes them trivial to add once the framework detection work lands
- Angular/Vue detection edge cases — handle when those runners are actually being built
- `.vitalsrc` per-check overrides — that's a separate config system (Phase 4)
