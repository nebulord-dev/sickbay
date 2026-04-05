# Feature: Config Phase E — Web Config Tab

> **Roadmap Phase**: Phase 2 — Standalone Polish (KAN-99)
> **Blocked by**: Nothing — Phases A–D complete

Validate patterns and imports against the codebase before implementing. Pay close attention
to existing type names, util locations, and tab registration patterns in Dashboard.tsx.

## Feature Description

Add a read-only Config tab to the web dashboard that shows the user's `sickbay.config.ts` settings at a glance. The tab displays which checks are enabled/disabled, which have threshold overrides or suppressions, custom weight overrides, and global exclude patterns. This completes the config system's visibility story: CLI shows a "Custom config active" notice (Phase A), and now the web dashboard shows the full breakdown.

## User Story

As a developer reviewing my project's health dashboard
I want to see my Sickbay configuration reflected in the web UI
So that I can understand how my config affects scoring and which checks are modified

## Problem Statement

Users who customize their `sickbay.config.ts` have no way to see what customizations are active from the web dashboard. The report metadata includes `hasCustomConfig`, `overriddenChecks`, and `disabledChecks`, but this data isn't surfaced anywhere in the web UI.

## Solution Statement

1. Add a `/sickbay-config.json` endpoint to the CLI HTTP server that serves the raw `SickbayConfig` object
2. Create a `ConfigTab.tsx` component that fetches this data and renders a read-only config viewer
3. Add the "config" tab to Dashboard.tsx navigation (conditionally shown only when config metadata exists)

The config data comes from two sources:
- **Report metadata** (`report.config`): already embedded — tells us `hasCustomConfig`, `overriddenChecks`, `disabledChecks`
- **Raw config** (`/sickbay-config.json`): new endpoint — gives us the full config object (weights, thresholds, excludes, suppress rules)

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: Medium
**Packages Affected**: `cli` (HTTP endpoint), `web` (ConfigTab component + Dashboard wiring)
**New npm Dependencies**: None
**Touches `types.ts`**: No — report metadata already has the `config?` field from Phase A

---

## CONTEXT REFERENCES

### Files to Read Before Implementing

- `apps/web/src/components/Dashboard.tsx` — tab structure, `View` type union, tab button array, conditional content rendering
- `apps/web/src/components/CodebaseStats.tsx` — component pattern with collapsible `SectionHeader`, `StatCard` sub-components
- `apps/cli/src/commands/web.ts` — HTTP server endpoint pattern (see `/sickbay-history.json`, `/sickbay-dep-tree.json`)
- `apps/cli/src/commands/web.test.ts` — test pattern for new endpoints (mock `existsSync`/`readFileSync`)
- `packages/core/src/config.ts` — `SickbayConfig`, `CheckConfig`, `SuppressionRule`, `KNOWN_THRESHOLD_KEYS` types
- `packages/core/src/types.ts:18-23` — `config?` field on `SickbayReport`
- `packages/core/src/constants.ts` — `SCORE_GOOD`, `SCORE_FAIR` (already duplicated in `apps/web/src/lib/constants.ts`)
- `apps/web/src/lib/constants.ts` — web-local constants

### New Files to Create

- `apps/web/src/components/ConfigTab.tsx` — read-only config viewer component
- `apps/web/src/components/ConfigTab.test.tsx` — component tests

### Patterns to Follow

**HTTP endpoint pattern (from web.ts:110-121):**
```typescript
if (url === '/sickbay-config.json') {
  // Serve config from memory (passed to serveWeb)
  if (configJson) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(configJson);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{}');
  }
  return;
}
```

**Tab component pattern (from CodebaseStats.tsx):**
- Props: `{ report: SickbayReport }`
- Collapsible sections via `SectionHeader` (define locally, same pattern)
- `StatCard` for key metrics
- `bg-card rounded-lg p-4` for card containers
- `text-xs text-gray-500` for labels
- `font-mono` for technical values

**Web-safe imports:**
```typescript
// Only import types from core — never value imports
import type { SickbayReport } from '@nebulord/sickbay-core';
```

**Dashboard tab registration (Dashboard.tsx:40, 339-366, 404-441):**
```typescript
// 1. Add to View type union
type View = 'overview' | 'issues' | ... | 'config';

// 2. Add tab button (conditionally, like history)
// 3. Add content render block
```

---

## IMPLEMENTATION PLAN

### Phase 1: CLI HTTP Server — Config Endpoint

Pass the raw `SickbayConfig` object into `serveWeb()` and serve it at `/sickbay-config.json`.

**Approach**: The config is already loaded in `runner.ts` and could be passed along, but `serveWeb` is called from `App.tsx` / `TuiApp.tsx` / `index.ts` which don't have access to the raw config. The simplest approach: `serveWeb` receives an optional `config` parameter. The callers already have the report which has `config` metadata, but we need the full `SickbayConfig` for thresholds/suppress details.

**Decision**: Rather than threading the raw config through multiple layers, load the config from disk in `serveWeb` itself — it already knows the `projectPath` from the report. This mirrors how `/sickbay-history.json` reads from disk.

### Phase 2: Web Dashboard — ConfigTab Component

Create `ConfigTab.tsx` that:
1. Fetches `/sickbay-config.json` on mount (lazy, like history)
2. Falls back gracefully if no config exists (404 → show "no custom config" message)
3. Renders sections: Checks, Weights, Excludes, Suppressions

### Phase 3: Dashboard Integration

Wire `ConfigTab` into `Dashboard.tsx`:
- Add `'config'` to `View` type
- Show config tab button only when `report.config?.hasCustomConfig` is true
- Render `ConfigTab` in content area

### Phase 4: Tests

- `web.test.ts`: endpoint tests for `/sickbay-config.json`
- `ConfigTab.test.tsx`: component render tests

---

## STEP-BY-STEP TASKS

### UPDATE `apps/cli/src/commands/web.ts`

Add `/sickbay-config.json` endpoint that loads config from disk.

- **IMPLEMENT**: Add a new endpoint block after the `/sickbay-dep-tree.json` handler (after line 135). Use `loadConfig()` from core to load the config file at request time (same lazy approach as history/dep-tree, but using the config loader instead of raw file read). Import `loadConfig` from `@nebulord/sickbay-core`.
- **PATTERN**: Mirror `/sickbay-dep-tree.json` endpoint pattern (lines 124-135) — but instead of reading a file, call `loadConfig(basePath)` and serialize the result
- **GOTCHA**: `loadConfig()` is async and uses `jiti` — this is fine since the HTTP handler is already async. If loadConfig returns null (no config file), return 404.
- **GOTCHA**: `loadConfig()` uses `process.stderr.write` for warnings — this is acceptable in the CLI HTTP server context.

```typescript
// After dep-tree endpoint
if (url === '/sickbay-config.json') {
  const basePath = 'isMonorepo' in report ? report.rootPath : report.projectPath;
  try {
    const { loadConfig } = await import('@nebulord/sickbay-core');
    const config = await loadConfig(basePath);
    if (config) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(config));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{}');
    }
  } catch {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end('{}');
  }
  return;
}
```

- **VALIDATE**: `pnpm --filter sickbay build`

### CREATE `apps/web/src/components/ConfigTab.tsx`

Read-only config viewer component.

- **IMPORTS**: `import type { SickbayReport } from '@nebulord/sickbay-core'` (type-only!)
- **PROPS**: `{ report: SickbayReport }` — to access `report.config` metadata
- **STATE**: `config` (fetched raw config), `loading` boolean
- **FETCH**: `useEffect` to fetch `/sickbay-config.json` on mount, similar to history fetch pattern in Dashboard.tsx:105-118

**Sections to render:**

1. **Banner** — "Custom configuration active" with count of overrides and disabled checks
2. **Checks section** — List all checks from the config. For each:
   - If `false` or `{ enabled: false }` → dimmed with "disabled" badge
   - If has `thresholds` → "thresholds" badge with expandable details
   - If has `suppress` → "suppress" badge with count
   - If has `exclude` → "exclude" badge
   - If `true` → just the check name, normal styling
3. **Weights section** — Only shown if `config.weights` exists. Show each category with its custom weight vs default weight. Use the default weights from the spec: security 0.30, dependencies 0.25, code-quality 0.25, performance 0.15, git 0.05.
4. **Global Excludes section** — Only shown if `config.exclude` exists. List glob patterns.

**Design details:**
- Use `bg-card rounded-lg p-4` containers
- `font-mono text-sm` for check names and values
- Disabled checks: `opacity-50` + red "disabled" badge
- Override badges: small colored pills — `bg-blue-500/20 text-blue-300` for thresholds, `bg-yellow-500/20 text-yellow-300` for suppress, `bg-purple-500/20 text-purple-300` for exclude
- Weight comparison: show "default → custom" with arrow, color-coded green if increased, red if decreased
- Empty state: "No custom configuration — Sickbay is running with all defaults"

**GOTCHA**: The raw config uses `Record<string, boolean | CheckConfig>` for checks — need to handle all three shapes (`true`, `false`, object).
**GOTCHA**: Web-safe only — no value imports from core. Default weights must be duplicated as local constants (same pattern as `SCORE_GOOD`/`SCORE_FAIR` in `apps/web/src/lib/constants.ts`).

- **VALIDATE**: `pnpm --filter @nebulord/sickbay-web build`

### UPDATE `apps/web/src/lib/constants.ts`

Add default weight constants for the config tab to reference.

- **IMPLEMENT**: Add `DEFAULT_WEIGHTS` constant matching the defaults from `packages/core/src/scoring.ts`

```typescript
/** Default category weights — duplicated from core to avoid Node.js imports */
export const DEFAULT_WEIGHTS: Record<string, number> = {
  security: 0.30,
  dependencies: 0.25,
  'code-quality': 0.25,
  performance: 0.15,
  git: 0.05,
};
```

- **PATTERN**: Same duplication strategy as `SCORE_GOOD` / `SCORE_FAIR` (documented in memory: `project_web_constants_fix.md`)

### UPDATE `apps/web/src/components/Dashboard.tsx`

Wire ConfigTab into the dashboard.

- **IMPLEMENT**:
  1. Add `'config'` to `View` type (line 40)
  2. Import `ConfigTab` component
  3. Add config tab button — place it conditionally next to the history button (lines 354-366). Only show when `activeReport?.config?.hasCustomConfig` is true
  4. Add content render: `{view === 'config' && activeReport && <ConfigTab report={activeReport} />}`
- **PATTERN**: Follow the history tab's conditional rendering pattern (lines 354-366 for button, 429-439 for content)
- **GOTCHA**: Config tab should work for both single-project and per-package monorepo views. The `report.config` field is on `SickbayReport` which `activeReport` already is. For monorepo, each package inherits the root config, so the same config applies.

### CREATE `apps/web/src/components/ConfigTab.test.tsx`

- **PATTERN**: Follow `CodebaseStats.test.tsx` — `makeReport()` helper, `render` + `screen` assertions
- **TESTS**:
  1. Shows empty state when `report.config` is undefined (no custom config)
  2. Shows "Custom configuration active" banner when config present
  3. Shows disabled checks count from `report.config.disabledChecks`
  4. Shows overridden checks count from `report.config.overriddenChecks`
  5. Fetches `/sickbay-config.json` on mount
  6. Handles 404 from config endpoint gracefully (no config file)
- **GOTCHA**: Mock `fetch` for the `/sickbay-config.json` call. Use `vi.fn()` on global `fetch`.

### UPDATE `apps/cli/src/commands/web.test.ts`

Add tests for the new `/sickbay-config.json` endpoint.

- **TESTS**:
  1. `/sickbay-config.json` returns 200 with config data when config file exists
  2. `/sickbay-config.json` returns 404 when no config file found
- **GOTCHA**: The endpoint uses dynamic `import('@nebulord/sickbay-core')` for `loadConfig` — mock the core module's `loadConfig` function. Use `vi.mock('@nebulord/sickbay-core', ...)` to provide a controlled return value.
- **PATTERN**: Mirror the existing `/sickbay-dep-tree.json` test structure (lines 123-153)

---

## VALIDATION COMMANDS

### Level 1: Type checking

```bash
pnpm --filter @nebulord/sickbay-core build
pnpm --filter sickbay build
pnpm --filter @nebulord/sickbay-web build
```

### Level 2: Unit tests

```bash
pnpm --filter sickbay test
pnpm --filter @nebulord/sickbay-web test
```

### Level 3: Full build

```bash
pnpm build
```

### Level 4: Manual spot checks

1. Create a `sickbay.config.ts` in a test project with some overrides:
   ```ts
   import { defineConfig } from 'sickbay'
   export default defineConfig({
     checks: {
       knip: false,
       complexity: { thresholds: { general: { warn: 500, critical: 800 } } },
       secrets: { suppress: [{ match: 'NEXT_PUBLIC', reason: 'public env var' }] },
     },
     weights: { security: 0.50 },
     exclude: ['**/generated/**'],
   })
   ```
2. Run `sickbay --path <project> --web`
3. Verify:
   - Config tab appears in navigation bar
   - Banner shows "Custom configuration active"
   - `knip` shown as disabled (dimmed + badge)
   - `complexity` shows threshold override badge
   - `secrets` shows suppress badge
   - Weights section shows security bumped to 0.50 vs 0.30 default
   - Excludes section shows `**/generated/**`
4. Run against a project with NO config → verify config tab does NOT appear

---

## ACCEPTANCE CRITERIA

- [ ] `/sickbay-config.json` endpoint serves the raw config when a config file exists
- [ ] `/sickbay-config.json` returns 404 when no config file
- [ ] Config tab appears in dashboard navigation only when `hasCustomConfig` is true
- [ ] Config tab shows disabled checks with dimmed styling + badge
- [ ] Config tab shows overridden checks with colored badges (thresholds, suppress, exclude)
- [ ] Config tab shows custom weight overrides vs defaults
- [ ] Config tab shows global exclude patterns
- [ ] Config tab shows graceful empty state when no config
- [ ] All builds pass (`pnpm build`)
- [ ] All tests pass (`pnpm test`)
- [ ] Web package uses only `import type` from core
- [ ] No regressions in existing dashboard tabs

---

## MONOREPO FUTURE-PROOFING NOTES

- In Phase F, per-package config files will be supported. The ConfigTab currently shows the root config for all packages. When per-package configs land, the endpoint may need to accept a `?package=<name>` param to serve package-specific configs, and the tab would need to show merge behavior.
- The `/sickbay-config.json` endpoint loads config from disk at request time. This is fine since config files don't change during a scan session. If per-package configs are added, the endpoint would need to resolve the right config per package path.

---

## NOTES

- The `loadConfig()` function uses `jiti` which is already a dependency of core. The dynamic import in web.ts (`await import('@nebulord/sickbay-core')`) ensures it's only loaded when needed.
- Default weights are duplicated in `apps/web/src/lib/constants.ts` following the established pattern for avoiding Node.js imports in the browser bundle.
- The config tab is intentionally read-only — editing config is done in the `sickbay.config.ts` file directly.
- Suppression `reason` fields are displayed in the tab to reinforce the "no suppress-and-forget" philosophy.

## MONOREPO ARCHITECT REVIEW

Run the monorepo-architect agent as a final review step before committing to verify no boundary violations between core/cli/web packages.
