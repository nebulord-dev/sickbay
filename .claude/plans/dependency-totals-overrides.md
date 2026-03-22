# Feature: Dependency Update Totals + Package Overrides

> **Roadmap Phase**: Phase 2 — Standalone Polish
> **Blocked by**: nothing

Validate patterns and imports against the codebase before implementing. Pay close attention
to existing type names, util locations, and runner registration patterns.

## Feature Description

Two additions to the web dashboard Dependencies tab:
1. **Update totals banner** — shows aggregate counts of major, minor, and patch updates at the top
2. **Package overrides section** — collapsible list showing pnpm.overrides / npm overrides / yarn resolutions

## User Story

As a developer reviewing my project health dashboard
I want to see at a glance how many major/minor/patch updates are available and which packages have version overrides
So that I can prioritize dependency maintenance and track temporary overrides that need cleanup

## Problem Statement

The Dependencies tab shows a flat list of packages with individual badges but no aggregate summary. Users must scan every row to understand the overall update situation. Package overrides are invisible in the dashboard despite being important maintenance signals.

## Solution Statement

Add a totals banner above the dependency table with three colored pills (major/minor/patch counts). Below it, add a collapsible overrides section. Core changes: enhance the outdated runner to classify update types as major/minor/patch, and add an `overrides` field to `ProjectInfo` populated during project detection.

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Low-Medium
**Packages Affected**: core, web (in build order)
**New npm Dependencies**: none
**Touches `types.ts`**: Yes — adds `overrides` to `ProjectInfo`

---

## CONTEXT REFERENCES

### Files to Read Before Implementing

- `packages/core/src/types.ts` — `ProjectInfo` interface (line 14-25), add `overrides` field
- `packages/core/src/integrations/outdated.ts` — runner to enhance with update type classification
- `packages/core/src/utils/detect-project.ts` — `detectProject()` to add overrides extraction
- `apps/web/src/components/DependencyList.tsx` — main component to extend with banner + overrides
- `packages/core/src/integrations/outdated.test.ts` — existing test pattern for outdated runner
- `apps/web/src/components/DependencyList.test.tsx` — existing test pattern for web component

### New Files to Create

None — all changes are to existing files.

### Patterns to Follow

**Issue message encoding** (from outdated.ts):
```typescript
// Current: "react: 17.0.2 → 18.0.0"
// New:     "react: 17.0.2 → 18.0.0 (major)"
```

**Web-safe imports** (DependencyList.tsx):
```typescript
import type { SickbayReport } from '@sickbay/core';
```

**Test mocking pattern** (detect-project.test.ts):
```typescript
vi.mock('fs', () => ({ existsSync: vi.fn(), readFileSync: vi.fn() }));
```

---

## IMPLEMENTATION PLAN

### Phase 1: Types

Add `overrides` to `ProjectInfo` in `types.ts`.

### Phase 2: Core — Outdated Runner

Enhance `getUpdateType()` to return `'major' | 'minor' | 'patch'`. Append type suffix to issue message.

### Phase 3: Core — Project Detection

Read overrides from `package.json` in `detectProject()`.

### Phase 4: Web — DependencyList

Add `UpdateTotalsBanner`, `OverridesSection`, and update `DependencyStatus` to use three-way `updateType`.

### Phase 5: Tests

Update outdated runner tests, detect-project tests, and DependencyList tests.

---

## STEP-BY-STEP TASKS

### 1. UPDATE `packages/core/src/types.ts`

- **IMPLEMENT**: Add `overrides?: Record<string, string>` to `ProjectInfo` interface after `devDependencies`
- **GOTCHA**: This is a type-only change but affects all consumers. The field is optional so nothing breaks.
- **VALIDATE**: `pnpm --filter @sickbay/core build`

### 2. UPDATE `packages/core/src/integrations/outdated.ts`

- **IMPLEMENT**:
  - Rename `getMajor()` to `getVersionPart()` or keep it, and add `getMinor(version)` helper
  - Add `getUpdateType(current, latest): 'major' | 'minor' | 'patch'` function:
    ```typescript
    function getUpdateType(current: string, latest: string): 'major' | 'minor' | 'patch' {
      if (getMajor(current) < getMajor(latest)) return 'major';
      if (getMinor(current) < getMinor(latest)) return 'minor';
      return 'patch';
    }
    ```
  - Update issue message format: `"${e.name}: ${e.current} → ${e.latest} (${updateType})"`
  - Keep `severity` mapping as-is (major = warning, minor/patch = info) to preserve scoring
- **VALIDATE**: `pnpm --filter @sickbay/core build && pnpm --filter @sickbay/core test`

### 3. UPDATE `packages/core/src/utils/detect-project.ts`

- **IMPLEMENT**: In `detectProject()`, after reading `pkg`, extract overrides:
  ```typescript
  const overrides: Record<string, string> =
    pkg.pnpm?.overrides ?? pkg.overrides ?? pkg.resolutions ?? {};
  ```
  Add `overrides: Object.keys(overrides).length > 0 ? overrides : undefined` to the return object.
- **VALIDATE**: `pnpm --filter @sickbay/core build && pnpm --filter @sickbay/core test`

### 4. UPDATE `apps/web/src/components/DependencyList.tsx`

- **IMPLEMENT**:
  - Update `DependencyStatus` interface: replace `majorBump: boolean` with `updateType?: 'major' | 'minor' | 'patch'`
  - Update `buildDependencyStatuses()` regex to parse `(major)`, `(minor)`, `(patch)` suffix from message:
    ```typescript
    // Updated regex: "react: 17.0.2 → 18.0.0 (major)"
    const ncuMatch = msg.match(/^([^:]+):\s*([^\s]+)\s*→\s*([^\s]+?)(?:\s*\((major|minor|patch)\))?$/);
    ```
    Fall back to severity-based detection for backward compatibility with old reports.
  - Add `UpdateTotalsBanner` sub-component: counts major/minor/patch from deps array, renders three pills or green "all up to date" message
  - Add `OverridesSection` sub-component: reads `report.projectInfo.overrides`, renders collapsible list. Collapsed by default if > 3 items. Uses `useState` for toggle.
  - Update `StatusBadges`: use `updateType` for three-way badge (`major update` orange, `minor update` blue, `patch update` gray)
  - Render order: `<UpdateTotalsBanner>` → `<OverridesSection>` → existing header → existing table

- **VALIDATE**: `pnpm --filter @sickbay/web build && pnpm --filter @sickbay/web test`

### 5. UPDATE `packages/core/src/integrations/outdated.test.ts`

- **IMPLEMENT**:
  - Update existing `marks major version bumps` test to also check message contains `(major)`
  - Update existing `marks minor/patch bumps` test to check message contains `(patch)` for same-minor bump
  - Add new test: minor version bump (e.g., `4.0.0 → 4.1.0`) produces `(minor)` in message
  - Add new test: patch-only bump (e.g., `4.0.0 → 4.0.1`) produces `(patch)` in message
- **VALIDATE**: `pnpm --filter @sickbay/core test`

### 6. UPDATE `packages/core/src/utils/detect-project.test.ts`

- **IMPLEMENT**:
  - Add test: `detectProject` returns `overrides` when `pnpm.overrides` is present in package.json
  - Add test: `detectProject` returns `overrides` when npm `overrides` is present
  - Add test: `detectProject` returns `overrides` when yarn `resolutions` is present
  - Add test: `detectProject` returns `undefined` overrides when none present
- **VALIDATE**: `pnpm --filter @sickbay/core test`

### 7. UPDATE `apps/web/src/components/DependencyList.test.tsx`

- **IMPLEMENT**:
  - Add test: update totals banner shows correct major/minor/patch counts
  - Add test: banner shows "all up to date" when no outdated deps
  - Add test: overrides section renders when `projectInfo.overrides` is present
  - Add test: overrides section is hidden when no overrides
  - Update existing `"major update"` badge test to use new message format with `(major)` suffix
  - Update existing `"outdated"` badge test — will now show `minor update` or `patch update`
- **VALIDATE**: `pnpm --filter @sickbay/web test`

---

## VALIDATION COMMANDS

### Level 1: Type checking and linting
```bash
pnpm --filter @sickbay/core build
pnpm --filter @sickbay/web build
pnpm lint
```

### Level 2: Unit tests
```bash
pnpm --filter @sickbay/core test
pnpm --filter @sickbay/web test
```

### Level 3: Full build
```bash
pnpm build
```

### Level 4: Manual spot checks
```bash
# Generate a report against a project with outdated deps
node apps/cli/dist/index.js --path fixtures/packages/react-app --json | head -50
# Check the issue messages include (major), (minor), (patch) suffixes

# Generate report and open web dashboard
node apps/cli/dist/index.js --path fixtures/packages/react-app --web
# Verify: totals banner shows colored pills
# Verify: overrides section shows if package.json has overrides
# Verify: table badges show major/minor/patch distinction
```

---

## ACCEPTANCE CRITERIA

- [ ] Outdated runner classifies updates as major/minor/patch in issue messages
- [ ] `ProjectInfo` includes `overrides` field populated from package.json
- [ ] Dependencies tab shows update totals banner with three colored counts
- [ ] Dependencies tab shows collapsible overrides section when overrides exist
- [ ] Table badges distinguish major/minor/patch updates
- [ ] Backward compatible — old reports without `(type)` suffix still render correctly
- [ ] All type checks pass (`pnpm build`)
- [ ] All tests pass across core and web
- [ ] Linting passes
- [ ] Web package uses only `import type` from core

---

## NOTES

- The `DependencyStatus.majorBump` boolean becomes `updateType?: 'major' | 'minor' | 'patch'`. Existing tests that check for `major update` badge text will need updating since the badge text changes slightly for minor/patch.
- Backward compatibility: the web regex falls back to severity-based detection (`severity === 'warning'` → major) when no parenthetical suffix is present. This handles reports generated before this change.
- The overrides field is optional on `ProjectInfo`, so monorepo package reports and existing serialized reports won't break.
- pnpm overrides live at `pkg.pnpm.overrides`, npm at `pkg.overrides`, yarn at `pkg.resolutions`. These are mutually exclusive in practice.
