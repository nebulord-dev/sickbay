# Feature: Best Practices Recommendations System

> **Roadmap Phase**: Phase 2 — Standalone Polish (extends the command suite / report data shape)
> **Blocked by**: nothing

Validate patterns and imports against the codebase before implementing. Pay close attention
to existing type names, util locations, and runner registration patterns.

## Feature Description

A non-scored recommendations layer that runs framework-aware best practice checks and surfaces findings in CLI, TUI, and web dashboard **without affecting the health score**. Recommendations are "here's how to make your app better" signals — not "something is wrong" signals.

The system is framework-agnostic by design: a `Recommendation` type and `recommendations` field on the report provide the plumbing, while individual advisor runners (React first, Angular/Next/Node later) produce framework-specific recommendations.

## User Story

As a developer scanning my project with Sickbay
I want to see best practice recommendations alongside my health score
So that I can improve my setup without being penalized for not adopting every practice

## Problem Statement

Sickbay's current architecture only supports scored checks. Some best practices (missing error boundaries, not using React Compiler, no StrictMode) aren't "health issues" — they're improvement opportunities. Forcing them into the scoring system either unfairly penalizes projects or requires awkward always-100 scores. There's no place for advisory, non-judgmental guidance.

## Solution Statement

Add a parallel `recommendations` field to `SickbayReport` (and `PackageReport` for monorepos) populated by a new class of "advisor" runners. These advisors:

- Extend `BaseRunner` but are registered in a separate `ALL_ADVISORS` array
- Run in parallel alongside scored checks (same `Promise.allSettled` pattern)
- Produce `Recommendation` objects (not `CheckResult`) — no score, no status
- Are excluded from scoring, check lists, and the sidebar check nav
- Surface in dedicated UI areas: CLI "Advisor" section, web "Advisor" drawer (mirrors AI Insights pattern)

### Initial advisor: React Best Practices

| Signal | Detection method | Severity |
|--------|-----------------|----------|
| Missing error boundaries | No `ErrorBoundary` component, `componentDidCatch`, or `react-error-boundary` in deps | suggest |
| No Suspense usage | Zero `<Suspense` in any `.tsx`/`.jsx` file | suggest |
| React Compiler not adopted | No `babel-plugin-react-compiler` or `@react-compiler/babel` in deps | suggest |
| No StrictMode | No `<StrictMode` wrapping the app entry point (`main.tsx`, `index.tsx`, `_app.tsx`) | suggest |
| Legacy ReactDOM.render | Uses `ReactDOM.render()` instead of `createRoot()` | recommend |

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: Medium
**Packages Affected**: core → cli → web (all three, in build order)
**New npm Dependencies**: none
**Touches `types.ts`**: Yes — adds `Recommendation` interface and `recommendations` field to report types

---

## CONTEXT REFERENCES

### Files to Read Before Implementing

- `packages/core/src/types.ts` — add `Recommendation` interface, extend `SickbayReport` and `PackageReport`
- `packages/core/src/integrations/base.ts` — `BaseRunner` to extend for `BaseAdvisor`
- `packages/core/src/integrations/react-perf.ts` — closest existing React-scoped runner; reuse scanning utilities
- `packages/core/src/runner.ts` (lines 80–115) — `ALL_RUNNERS` pattern to mirror for `ALL_ADVISORS`; `runSickbay()` flow to extend
- `packages/core/src/index.ts` — exports to update
- `apps/cli/src/components/QuickWins.tsx` — CLI rendering pattern to mirror for recommendations
- `apps/cli/src/components/App.tsx` (lines 289–303) — where to insert recommendations section in results phase
- `apps/cli/src/components/tui/QuickWinsPanel.tsx` — TUI rendering to extend or place a sibling panel
- `apps/web/src/components/Dashboard.tsx` (lines 337–456) — tab system and main content area

### New Files to Create

- `packages/core/src/advisors/base.ts` — `BaseAdvisor` class
- `packages/core/src/advisors/react-best-practices.ts` — React advisor implementation
- `packages/core/src/advisors/react-best-practices.test.ts` — tests
- `apps/cli/src/components/BestPractices.tsx` — CLI rendering component
- `apps/cli/src/components/BestPractices.test.tsx` — CLI component tests
- `apps/web/src/components/BestPracticesDrawer.tsx` — web dashboard drawer (mirrors AISummary.tsx pattern)
- `apps/web/src/components/BestPracticesDrawer.test.tsx` — web component tests

### Patterns to Follow

**Advisor structure (new, mirrors BaseRunner but simpler):**
```typescript
export abstract class BaseAdvisor {
  abstract name: string;
  abstract frameworks: readonly Framework[];

  abstract run(projectPath: string, context: ProjectContext): Promise<Recommendation[]>;

  isApplicableToContext(context: ProjectContext): boolean {
    return this.frameworks.some((f) => context.frameworks.includes(f));
  }
}
```

**Web-safe imports:**
```typescript
// In packages/web — always import type, never value imports from core
import type { Recommendation } from '@nebulord/sickbay-core';
```

**Naming conventions:** kebab-case files, PascalCase components, camelCase functions

**Error handling:** Advisors should never throw — catch internally and return empty array on failure (same pattern as runners returning score 0 on catch)

---

## IMPLEMENTATION PLAN

### Phase 1: Types and Foundation (core)

Add the `Recommendation` type and `BaseAdvisor` class. Extend report types.

**Tasks:**

- Add `Recommendation` interface to `packages/core/src/types.ts`
- Add `recommendations` field to `SickbayReport` and `PackageReport`
- Create `packages/core/src/advisors/base.ts` with `BaseAdvisor` abstract class
- Export new types and base class from `packages/core/src/index.ts`

### Phase 2: React Best Practices Advisor (core)

Implement the first advisor.

**Tasks:**

- Create `packages/core/src/advisors/react-best-practices.ts`
- Register in `runner.ts` in a new `ALL_ADVISORS` array
- Wire advisor execution into `runSickbay()` and `runSickbayMonorepo()`
- Write tests in `packages/core/src/advisors/react-best-practices.test.ts`

### Phase 3: CLI Integration

Surface recommendations in CLI output.

**Tasks:**

- Create `apps/cli/src/components/BestPractices.tsx` — renders recommendations below Quick Wins
- Add `<BestPractices>` to `App.tsx` results phase (after `<QuickWins>`)
- Write tests for the component

### Phase 4: Web Integration

Surface recommendations as a drawer in the web dashboard, mirroring the AI Insights pattern.

**Tasks:**

- Create `apps/web/src/components/BestPracticesDrawer.tsx` — fixed-position drawer (mirrors `AISummary.tsx` layout)
- Add toggle button to Dashboard.tsx header bar (top-right, next to "ai insights" button)
- Add `isBestPracticesOpen` state to Dashboard and wire toggle
- Only use `import type` from core
- Write component tests

### Phase 5: Tests and Validation

**Tasks:**

- Verify all existing tests still pass
- Full build across all packages
- Manual test against `fixtures/packages/react-app` (should produce recommendations)
- Manual test against `fixtures/packages/node-api` (should produce no React recommendations)
- Manual test against `fixtures/packages/angular-app` (should produce no React recommendations)

---

## STEP-BY-STEP TASKS

Execute in order. Each task is atomic and independently testable.

---

### UPDATE `packages/core/src/types.ts`

- **IMPLEMENT**: Add `Recommendation` interface:
  ```typescript
  export interface Recommendation {
    id: string;                           // e.g. 'react-error-boundary'
    framework: Framework | 'universal';   // which framework this applies to
    title: string;                        // e.g. 'Add Error Boundaries'
    message: string;                      // detailed explanation
    severity: 'recommend' | 'suggest';    // recommend = stronger signal, suggest = nice-to-have
    learnMoreUrl?: string;                // link to docs/blog post
    fix?: FixSuggestion;                  // optional actionable fix
  }
  ```
- **IMPLEMENT**: Add `recommendations?: Recommendation[]` to `SickbayReport`
- **IMPLEMENT**: Add `recommendations?: Recommendation[]` to `PackageReport`
- **GOTCHA**: `MonorepoReport` doesn't need it directly — it's per-package via `PackageReport`
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core build`

---

### CREATE `packages/core/src/advisors/base.ts`

- **IMPLEMENT**: `BaseAdvisor` abstract class with `name`, `frameworks`, `run()`, and `isApplicableToContext()`
- **PATTERN**: Mirror `packages/core/src/integrations/base.ts` but simpler — no score, no category, no `isApplicable` async method
- **IMPORTS**: `Framework`, `ProjectContext`, `Recommendation` from `../types.js`
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core build`

---

### CREATE `packages/core/src/advisors/react-best-practices.ts`

- **IMPLEMENT**: `ReactBestPracticesAdvisor extends BaseAdvisor`
  - `frameworks = ['react', 'next', 'remix'] as const`
  - `run()` checks for each signal:
    1. **Error boundaries**: scan `.tsx`/`.jsx` files in `src/` for `ErrorBoundary`, `componentDidCatch`; also check deps for `react-error-boundary`
    2. **Suspense usage**: scan for `<Suspense` in any component file
    3. **React Compiler**: check `package.json` deps for `babel-plugin-react-compiler` or `@react-compiler/babel`
    4. **StrictMode**: scan entry files (`main.tsx`, `index.tsx`, `src/main.tsx`, `src/index.tsx`) for `<StrictMode`
    5. **Legacy ReactDOM.render**: scan entry files for `ReactDOM.render(` vs `createRoot(`
- **PATTERN**: Reuse file scanning approach from `react-perf.ts` (`scanDirectory`, `readFileSync`, etc.)
- **GOTCHA**: Wrap each individual check in try/catch — one failing signal shouldn't block others
- **GOTCHA**: For Next.js projects, skip the StrictMode check (Next handles it via `reactStrictMode` in `next.config.js`). Check `next.config.js` / `next.config.mjs` / `next.config.ts` for `reactStrictMode: true` instead.
- **GOTCHA**: For Next.js projects, skip the legacy ReactDOM.render check (Next manages its own entry point)
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core build`

---

### CREATE `packages/core/src/advisors/react-best-practices.test.ts`

- **IMPLEMENT**: Test each signal independently using mock filesystem (match `react-perf.test.ts` patterns)
  - Project with no error boundary → produces recommendation
  - Project with `react-error-boundary` in deps → no recommendation
  - Project with `<Suspense>` in code �� no recommendation
  - Project with React Compiler in deps → no recommendation
  - Project with `<StrictMode>` → no recommendation
  - Project using `createRoot` → no recommendation for legacy render
  - Next.js project → skips StrictMode and ReactDOM.render checks
- **PATTERN**: `packages/core/src/integrations/react-perf.test.ts`
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test`

---

### UPDATE `packages/core/src/runner.ts`

- **IMPLEMENT**: Import `ReactBestPracticesAdvisor` from `./advisors/react-best-practices.js`
- **IMPLEMENT**: Create `ALL_ADVISORS` array (parallel to `ALL_RUNNERS`)
- **IMPLEMENT**: In `runSickbay()`, after running checks:
  1. Filter advisors by context (`isApplicableToContext`)
  2. Run applicable advisors in parallel via `Promise.allSettled`
  3. Collect results into flat `Recommendation[]`
  4. Add to report: `recommendations: allRecommendations.length > 0 ? allRecommendations : undefined`
- **IMPLEMENT**: In `runSickbayMonorepo()`, pass through recommendations from per-package `runSickbay()` calls into `PackageReport`
- **GOTCHA**: Advisors run in the same `Promise.allSettled` batch as checks for performance, but their results go to `recommendations` not `checks`
- **GOTCHA**: Don't add advisor names to `onRunnersReady` callback — they shouldn't appear in progress lists
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core build`

---

### UPDATE `packages/core/src/index.ts`

- **IMPLEMENT**: Export `Recommendation` type from `types.js`
- **IMPLEMENT**: Export `BaseAdvisor` from `advisors/base.js` (for future third-party/plugin advisors)
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core build`

---

### CREATE `apps/cli/src/components/BestPractices.tsx`

- **IMPLEMENT**: Ink component that renders recommendations from `report.recommendations`
  - Header: "💡 Advisor"
  - Group by framework label (e.g. "React")
  - Each recommendation: severity icon + title + one-line message
  - Show at most 5 recommendations (sorted: `recommend` before `suggest`)
  - Return `null` if no recommendations
- **PATTERN**: Mirror `QuickWins.tsx` structure and imports
- **IMPORTS**: `Box`, `Text` from ink; `SickbayReport` type from core
- **VALIDATE**: `pnpm --filter sickbay build`

---

### UPDATE `apps/cli/src/components/App.tsx`

- **IMPLEMENT**: Import `BestPractices` component
- **IMPLEMENT**: Add `<BestPractices report={report} />` after `<QuickWins report={report} />` in the results phase (around line 297)
- **GOTCHA**: Also add for monorepo results if per-package recommendations exist
- **VALIDATE**: `pnpm --filter sickbay build`

---

### CREATE `apps/cli/src/components/BestPractices.test.tsx`

- **IMPLEMENT**: Test rendering with 0, 1, and multiple recommendations
- **IMPLEMENT**: Test that `recommend` severity sorts before `suggest`
- **IMPLEMENT**: Test max 5 cap
- **PATTERN**: `apps/cli/src/components/QuickWins.test.tsx`
- **VALIDATE**: `pnpm --filter sickbay test`

---

### CREATE `apps/web/src/components/BestPracticesDrawer.tsx`

- **IMPLEMENT**: Fixed-position drawer component mirroring `AISummary.tsx` layout:
  - `fixed top-6 right-6` positioned panel with header, close button, scrollable content
  - Props: `recommendations: Recommendation[]`, `isOpen: boolean`, `onToggle: (open: boolean) => void`
  - Header: lightbulb icon + "Advisor" title + close button (match AISummary header gradient style but with a distinct color — green/teal instead of purple)
  - Content: recommendations grouped by `framework` label, each showing:
    - Severity badge (`recommend` = amber, `suggest` = blue/gray)
    - Title (bold)
    - Message (descriptive text)
    - Optional "Learn more →" link if `learnMoreUrl` is set
  - Return `null` if not open
- **PATTERN**: `apps/web/src/components/AISummary.tsx` (lines 133–211) — exact drawer structure to mirror
- **IMPORTS**: Only `import type { Recommendation } from '@nebulord/sickbay-core'`
- **GOTCHA**: No value imports from core — browser bundle safety
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-web build`

---

### UPDATE `apps/web/src/components/Dashboard.tsx`

- **IMPLEMENT**: Import `BestPracticesDrawer` component
- **IMPLEMENT**: Add `isBestPracticesOpen` state: `const [isBestPracticesOpen, setIsBestPracticesOpen] = useState(false)`
- **IMPLEMENT**: Add toggle button in the top-right header bar (around line 378, next to the "ai insights" button):
  ```tsx
  {activeReport?.recommendations && activeReport.recommendations.length > 0 && (
    <button
      onClick={() => setIsBestPracticesOpen(!isBestPracticesOpen)}
      className={`px-3 py-1 rounded text-sm font-mono transition-colors flex items-center gap-1.5
        ${isBestPracticesOpen ? 'bg-teal-500/20 text-teal-300 font-semibold' : 'text-gray-400 hover:text-white'}`}
    >
      <span>💡</span>
      <span>advisor</span>
    </button>
  )}
  ```
- **IMPLEMENT**: Render drawer at bottom of component (sibling to AISummary and ChatDrawer, around line 467):
  ```tsx
  {activeReport?.recommendations && activeReport.recommendations.length > 0 && (
    <BestPracticesDrawer
      recommendations={activeReport.recommendations}
      isOpen={isBestPracticesOpen}
      onToggle={setIsBestPracticesOpen}
    />
  )}
  ```
- **GOTCHA**: Button only renders when recommendations exist — no empty state to handle
- **GOTCHA**: Close advisor drawer when switching packages in monorepo mode (add to the `useEffect` at line 94)
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-web build`

---

### CREATE `apps/web/src/components/BestPracticesDrawer.test.tsx`

- **IMPLEMENT**: Test drawer renders when `isOpen` is true, hidden when false
- **IMPLEMENT**: Test recommendations are grouped by framework
- **IMPLEMENT**: Test close button calls `onToggle(false)`
- **IMPLEMENT**: Test learn-more links render when `learnMoreUrl` is present
- **PATTERN**: `apps/web/src/components/AISummary.test.tsx`
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-web test`

---

## VALIDATION COMMANDS

Run all of these before considering the feature complete.

### Level 1: Type checking and building

```bash
pnpm --filter @nebulord/sickbay-core build
pnpm --filter sickbay build
pnpm --filter @nebulord/sickbay-web build
```

### Level 2: Unit tests

```bash
pnpm --filter @nebulord/sickbay-core test
pnpm --filter sickbay test
pnpm --filter @nebulord/sickbay-web test
```

### Level 3: Full build and snapshot tests

```bash
pnpm build
pnpm test:snapshots
```

### Level 4: Manual spot checks

- `node apps/cli/dist/index.js --path fixtures/packages/react-app` — should show Advisor section in CLI output
- `node apps/cli/dist/index.js --path fixtures/packages/react-app --json | jq '.recommendations'` — should show recommendations array in JSON
- `node apps/cli/dist/index.js --path fixtures/packages/react-app --web` — should show "advisor" button in web dashboard header, drawer opens with React recommendations
- `node apps/cli/dist/index.js --path fixtures/packages/node-api` — should NOT show Advisor section (no React)
- `node apps/cli/dist/index.js --path fixtures/packages/angular-app` — should NOT show Advisor section (no React advisor yet)

---

## ACCEPTANCE CRITERIA

- [ ] `Recommendation` type added to core types and exported
- [ ] `BaseAdvisor` class created and exported
- [ ] React Best Practices advisor implemented with all 5 signals
- [ ] Advisors run in parallel with checks but results go to `recommendations` not `checks`
- [ ] Recommendations excluded from scoring, status, check lists, and sidebar nav
- [ ] CLI renders "Advisor" section below Quick Wins (only when recommendations exist)
- [ ] Web dashboard shows "advisor" button in header bar (only when recommendations exist)
- [ ] Clicking button opens a drawer (mirrors AI Insights pattern) with grouped recommendations
- [ ] JSON output includes `recommendations` array
- [ ] All type checks pass (`pnpm build`)
- [ ] All tests pass across all packages
- [ ] Snapshot regression tests still pass
- [ ] React advisor produces recommendations for `react-app` fixture
- [ ] React advisor produces NO recommendations for `node-api` and `angular-app` fixtures
- [ ] Web package uses only `import type` from core
- [ ] Tests colocated with new source files

---

## MONOREPO FUTURE-PROOFING NOTES

- `recommendations` is already on `PackageReport`, so monorepo support works out of the box — each package gets its own recommendations based on its detected framework
- The monorepo web overview could aggregate recommendations cross-package in a future enhancement, but that's not needed for v1
- Advisor filtering uses the same `ProjectContext` and `isApplicableToContext` pattern as runners — no new detection needed

---

## NOTES

### Design Decisions

1. **Separate `ALL_ADVISORS` array, not mixed into `ALL_RUNNERS`**: Keeps the scoring pipeline clean. Runners produce `CheckResult` with scores; advisors produce `Recommendation[]` without scores. Mixing them would require conditional scoring logic and special-casing throughout the UI.

2. **`recommend` vs `suggest` severity**: Two tiers instead of one gives us room to distinguish "you really should do this" (missing error boundaries) from "this is a nice-to-have" (React Compiler adoption). Both are non-punitive but `recommend` can sort higher.

3. **Optional `learnMoreUrl`**: Lets us link to React docs, blog posts, or the Sickbay docs site for each recommendation. Valuable in the web dashboard where links are clickable.

4. **Framework-extensible**: The `BaseAdvisor` + `ALL_ADVISORS` pattern means adding Angular/Next/Node advisors later is just "create a new class, add to the array." No plumbing changes needed.

5. **TUI deferred**: The TUI layout is already dense with 6 panels. Adding recommendations there is lower priority than CLI and web. Mark as optional/follow-up.

### Future Advisors (not in scope for this plan)

- **Angular Best Practices**: Standalone components adoption, signal-based inputs, modern control flow (`@if`/`@for` over `*ngIf`/`*ngFor`)
- **Next.js Best Practices**: App Router migration, Turbopack adoption, `next/third-parties` for analytics
- **Node.js Best Practices**: Graceful shutdown handling, structured logging, health check endpoint
- **Universal**: `.nvmrc` / `.node-version` file, `.editorconfig`, `engines` field in `package.json`
