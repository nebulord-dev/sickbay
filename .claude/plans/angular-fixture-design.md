# Angular Fixture & Health Checks — Design Spec

**Date:** 2026-03-30
**Jira:** KAN-130
**Status:** Approved

---

## Overview

Add a modern Angular (v17+, standalone components) test fixture to `fixtures/packages/angular-app/` and implement four Angular-specific health checks in `packages/core/src/integrations/`. The checks are scoped to Angular projects via the existing `applicableFrameworks` declarative mechanism and will appear automatically in the web dashboard's About page.

---

## Fixture

### Location

`fixtures/packages/angular-app/`

### Structure

```
angular-app/
├── package.json               # @angular/core, @angular/router, rxjs; strict: false in tsconfig
├── tsconfig.json              # strict: false, no angularCompilerOptions block
├── src/
│   ├── main.ts                # bootstrapApplication(AppComponent, appConfig)
│   ├── app.config.ts          # ApplicationConfig with provideRouter(routes)
│   ├── app.routes.ts          # 4 routes, all static component: imports (no loadComponent)
│   ├── app.component.ts       # standalone, no OnPush
│   ├── components/
│   │   ├── header.component.ts           # standalone, no OnPush
│   │   ├── user-list.component.ts        # standalone, no OnPush, unguarded subscription
│   │   └── product-card.component.ts     # standalone, no OnPush, unguarded subscription
│   └── services/
│       └── data.service.ts               # simple injectable service with Observable methods
```

### Intentional Issues

| Check | Violation |
|---|---|
| `angular-change-detection` | All 4 components omit `changeDetection: ChangeDetectionStrategy.OnPush` |
| `angular-lazy-routes` | All routes use `component: SomeComponent` (static import), none use `loadComponent:` |
| `angular-strict` | `tsconfig.json` has `strict: false`; no `angularCompilerOptions` block |
| `angular-subscriptions` | `user-list.component.ts` and `product-card.component.ts` call `.subscribe()` with no `takeUntilDestroyed()`, `takeUntil()`, `DestroyRef`, or `ngOnDestroy` cleanup |

### Framework Detection

`detectContext()` in `packages/core/src/utils/detect-project.ts` already checks `'@angular/core' in allDeps` and pushes `'angular'` into `context.frameworks`. No changes to detection logic are needed.

---

## Checks

All four runners live in `packages/core/src/integrations/` and are registered in `ALL_RUNNERS` in `runner.ts`. All declare `applicableFrameworks = ['angular'] as const` so they are silently skipped on non-Angular projects.

### 1. `angular-change-detection.ts`

**Category:** `performance`
**Tool:** `angular-change-detection` (static analysis, no external tool)

**Logic:**
- Glob `**/*.component.ts` under `src/`
- For each file containing `@Component(`, check whether the decorator body includes `ChangeDetectionStrategy.OnPush`
- Emit one `warning` issue per component missing OnPush

**Scoring:** `max(20, 100 - missingCount * 15)`
- 0 missing → 100
- 4 missing → 40
- 7+ missing → 20 (floor)

**Fix description:** "Add `changeDetection: ChangeDetectionStrategy.OnPush` to the @Component decorator to prevent unnecessary re-renders."

---

### 2. `angular-lazy-routes.ts`

**Category:** `performance`
**Tool:** `angular-lazy-routes` (static analysis, no external tool)

**Logic:**
- Scan for files containing `Routes` type annotation or `provideRouter(` (typically `app.routes.ts`, `app.config.ts`)
- For each route object found, classify as lazy (`loadComponent:`) or static (`component:`)
- Emit one `warning` per static route

**Scoring:** based on ratio of lazy routes
- All lazy → 100
- No lazy routes → `max(20, 100 - staticCount * 20)`

**Fix description:** "Replace `component: MyComponent` with `loadComponent: () => import('./my.component').then(m => m.MyComponent)` to enable route-level code splitting."

---

### 3. `angular-strict.ts`

**Category:** `code-quality`
**Tool:** `angular-strict` (static analysis, no external tool)

**Logic:**
- Read `tsconfig.json`
- Check three settings independently:
  1. `compilerOptions.strict === true`
  2. `angularCompilerOptions.strictTemplates === true`
  3. `angularCompilerOptions.strictInjectionParameters === true`
- Emit one `warning` per missing setting

**Scoring:** `max(20, 100 - missingCount * 27)`
- 0 missing → 100 (rounds to ~100 with `100 - 0 * 27`)
- 1 missing → 73
- 2 missing → 46
- 3 missing → 20 (floor applied)

**Fix descriptions (per setting):**
- `strict`: "Enable `strict: true` in `compilerOptions` for full TypeScript strict mode."
- `strictTemplates`: "Enable `strictTemplates: true` in `angularCompilerOptions` to catch template type errors at build time."
- `strictInjectionParameters`: "Enable `strictInjectionParameters: true` in `angularCompilerOptions` to catch missing injection token errors."

---

### 4. `angular-subscriptions.ts`

**Category:** `code-quality`
**Tool:** `angular-subscriptions` (static analysis, no external tool)

**Logic:**
- Glob `**/*.component.ts` under `src/`
- For each file containing `.subscribe(`:
  - Check for any of: `takeUntilDestroyed(`, `takeUntil(`, `DestroyRef`, `ngOnDestroy`, `.unsubscribe(`
  - If none present, the component has unguarded subscriptions
- Emit one `warning` per leaky component

**Scoring:** `max(20, 100 - leakyCount * 20)`
- 0 leaky → 100
- 2 leaky → 60
- 5+ leaky → 20 (floor)

**Fix description:** "Use `takeUntilDestroyed()` from `@angular/core/rxjs-interop` or call `.unsubscribe()` in `ngOnDestroy` to prevent memory leaks."

---

## About Page

Add four entries to `CHECK_DESCRIPTIONS` in `apps/web/src/components/About.tsx`:

```ts
'angular-change-detection': 'Scans Angular components for missing OnPush change detection strategy.',
'angular-lazy-routes': 'Checks Angular routes for lazy loading via loadComponent().',
'angular-strict': 'Verifies strict TypeScript and Angular compiler settings in tsconfig.json.',
'angular-subscriptions': 'Detects RxJS subscriptions in components that are never unsubscribed.',
```

The About page already renders checks dynamically from `report.checks` grouped by category — no structural changes needed.

---

## Snapshot Tests

Add an `angular-app` case to `tests/snapshots/fixture-regression.test.ts` using **structural assertions only** (no score snapshots — Angular's npm ecosystem changes too frequently):

- Report has `checks` array
- All 4 Angular check IDs are present
- Each Angular check has `status !== 'skipped'`
- React-specific checks (`react-perf`) are absent or `skipped`
- Node-specific checks (`node-security`, `node-async-errors`, `node-input-validation`) are absent or `skipped`

---

## Files Changed

| File | Change |
|---|---|
| `fixtures/packages/angular-app/` | New fixture (all files) |
| `fixtures/README.md` | Document angular-app |
| `packages/core/src/integrations/angular-change-detection.ts` | New runner |
| `packages/core/src/integrations/angular-lazy-routes.ts` | New runner |
| `packages/core/src/integrations/angular-strict.ts` | New runner |
| `packages/core/src/integrations/angular-subscriptions.ts` | New runner |
| `packages/core/src/runner.ts` | Register 4 new runners in `ALL_RUNNERS` |
| `apps/web/src/components/About.tsx` | Add 4 entries to `CHECK_DESCRIPTIONS` |
| `tests/snapshots/fixture-regression.test.ts` | Add angular-app structural assertions |
