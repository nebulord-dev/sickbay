# Design: Dependency Update Totals + Package Overrides

## Overview

Two additions to the web dashboard's Dependencies tab:

1. **Update totals banner** — aggregate counts of major, minor, and patch updates available, shown above the dependency table
2. **Package overrides section** — collapsible list of `pnpm.overrides` / npm `overrides` / yarn `resolutions`, shown between the totals and the table

## Feature 1: Update Totals Banner

### Core Change

The outdated runner (`packages/core/src/integrations/outdated.ts`) currently classifies updates as either major (`severity: 'warning'`) or non-major (`severity: 'info'`). This needs to become a three-way classification: major / minor / patch.

**Approach:** Add an `updateType` field to each outdated issue's metadata. The `getUpdateType(current, latest)` function compares semver segments:
- **major**: first version number differs
- **minor**: first matches, second differs
- **patch**: only third (or beyond) differs

The issue severity stays unchanged (major = `warning`, minor/patch = `info`) to avoid breaking scoring. The `updateType` is carried in the issue message or metadata for the web dashboard to parse.

**Chosen encoding:** Extend the issue message format from `"react: 17.0.2 → 18.0.0"` to `"react: 17.0.2 → 18.0.0 (major)"` — the parenthetical suffix is parseable by the web dashboard and backward-compatible (existing regex still captures the package/version part).

### Web Change

`DependencyList.tsx` parses the `(major)`, `(minor)`, `(patch)` suffix from outdated issue messages. Displays three colored pills above the table:

- **N major** (orange, `bg-orange-900/40 text-orange-400`)
- **N minor** (blue, `bg-blue-900/30 text-blue-400`)
- **N patch** (gray, `bg-gray-800 text-gray-400`)

If all counts are zero, show: "All dependencies up to date" in green.

The existing `DependencyStatus.majorBump` boolean becomes `updateType: 'major' | 'minor' | 'patch' | undefined` to support the three-way badge in the table rows.

## Feature 2: Package Overrides Section

### Core Change

Add an `overrides` field to the `ProjectInfo` type:

```typescript
overrides?: Record<string, string>; // { "minimatch": ">=10.2.3" }
```

Populated in `detectProject()` by reading from `package.json`:
- `pnpm.overrides` (pnpm)
- `overrides` (npm)
- `resolutions` (yarn)

First non-empty source wins (they're mutually exclusive in practice).

### Web Change

New `OverridesSection` component rendered between the totals banner and the dependency table. Shows:
- Header: "Package Overrides" with count badge
- Each override as a row: package name (mono font) → pinned version
- Collapsed by default if > 3 overrides, with "Show all N overrides" toggle
- Muted styling (gray border, subtle background) since overrides are informational, not actionable

## Packages Affected

1. **`@sickbay/core`** — `outdated.ts` (update type classification), `types.ts` (overrides field on ProjectInfo), `detect-project.ts` (read overrides from package.json)
2. **`@sickbay/web`** — `DependencyList.tsx` (totals banner, overrides section, updated badges)

## Data Flow

```
package.json → detectProject() → ProjectInfo.overrides → SickbayReport → DependencyList → OverridesSection
outdated runner → Issue.message "(major|minor|patch)" → DependencyList → UpdateTotalsBanner + updated badges
```

## Out of Scope

- Overrides health scoring (no new check — overrides are informational)
- CLI terminal display of overrides (web only for now)
- Overrides in monorepo per-package views (follows existing pattern — each package report has its own ProjectInfo)
