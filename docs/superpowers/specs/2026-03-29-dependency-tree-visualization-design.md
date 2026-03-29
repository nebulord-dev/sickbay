# Dependency Tree Visualization — Design Spec

**Jira**: KAN-103
**Date**: 2026-03-29
**Status**: Draft

## Summary

An interactive npm package dependency graph accessible from the web dashboard's Dependencies tab. Renders as a full-screen overlay showing top-level dependencies with one level of transitive deps expandable on click. Nodes display status badges (vulnerable, outdated, unused) cross-referenced from existing runner data. A side panel shows package details on node click.

## Motivation

The Dependencies tab currently shows a flat list of packages with status badges. There's no way to see how dependencies relate to each other — which packages pull in which transitive deps, or where a vulnerability chain leads. The module import graph on the Codebase tab shows file-to-file relationships, not npm packages. This feature fills that gap.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Graph data source | npm package tree (`pnpm ls --json --depth 1`) | Shows installed packages and their relationships; distinct from the module import graph |
| Placement | Full-screen overlay from Dependencies tab | Avoids tab bloat; graph is contextual to dependency data; overlay gives room for pan/zoom |
| Tree depth | Top-level + 1 transitive, expand on click | Full transitive tree is too large; lazy expansion keeps it manageable |
| Data persistence | Cached to `.sickbay/dep-tree.json` per scan | Consistent with `last-report.json` pattern; available without live server |
| Node design | Badged — border color + status pills | Handles multi-status nodes (e.g., both vulnerable and outdated); informative at a glance |
| Filter behavior | Dim non-matching nodes (20% opacity) | Preserves tree structure context while highlighting problems |
| Detail interaction | Side panel on node click | Consistent with AI insights drawer pattern; doesn't fight with graph pan/zoom |

## Data Layer

### New Utility: `getDependencyTree()`

Location: `packages/core/src/utils/dep-tree.ts`

Runs the appropriate package manager command based on the detected package manager:

- **pnpm**: `pnpm ls --json --depth 1`
- **npm**: `npm ls --json --depth 1`
- **yarn**: `yarn list --json --depth 1`

Returns a typed structure:

```typescript
interface DependencyTreeNode {
  name: string;
  version: string;
  dependencies?: Record<string, DependencyTreeNode>;
}

interface DependencyTree {
  name: string;
  version: string;
  packageManager: string;
  dependencies: Record<string, DependencyTreeNode>;
}
```

### Caching

Written to `.sickbay/dep-tree.json` during each scan, alongside `last-report.json`. Overwritten every scan. Called from the same locations that write the report (CLI `App.tsx`, `index.ts` JSON path, `TuiApp.tsx`).

### HTTP Endpoint

The CLI web server (`apps/cli/src/commands/web.ts`) adds a `/sickbay-dep-tree.json` route serving the cached file. Same pattern as `/sickbay-history.json`.

## Annotation Cross-referencing

The graph component reads the `SickbayReport` (already available in the Dashboard) and cross-references runner data with tree nodes by package name:

| Runner | Matching strategy | Node annotation |
|--------|------------------|-----------------|
| npm-audit | **Requires a small change**: add `metadata.vulnerablePackages: Record<string, number>` to the npm-audit runner (maps package name → vulnerability count, built from the `vulnerabilities` object keys). The graph component reads this map directly — no message parsing needed. | Red border, "N vuln" pill |
| outdated | Parse issue messages matching `"packageName: current → latest (type)"` — split on `:` to extract the package name | Orange border, "outdated" pill |
| depcheck/knip | Parse issue messages matching `"Unused dependency: packageName"` or `"Unused devDependency: packageName"` | Gray dashed border, "unused" pill |
| heavy-deps | `metadata.heavyDeps` string array — direct name match | Optional "heavy" pill |
| (none) | No issues for this package | Default gray border, no pills |

Nodes can have multiple statuses. Border color uses the worst status (vulnerable > outdated > unused > healthy).

## UI Components

### Trigger

A "View Graph" button added to the top of the existing `DependencyList` component. Clicking it opens the overlay and lazily fetches `/sickbay-dep-tree.json`.

### DependencyTreeOverlay (`apps/web/src/components/DependencyTreeOverlay.tsx`)

Full-screen overlay covering the main content area (not the sidebar). Structure:

```
┌─────────────────────────────────────────────────────────┐
│ Dependency Graph    42 packages   [Vuln] [Outdated] [x] │
├─────────────────────────────────────┬───────────────────┤
│                                     │ lodash            │
│          @xyflow/react              │ 4.17.20           │
│          graph area                 │                   │
│          (pan + zoom)               │ 1 vulnerability   │
│                                     │ Prototype Pollut… │
│     [my-app]                        │                   │
│       ├── [react]                   │ Update available  │
│       ├── [express]                 │ 4.17.20 → 4.17.21│
│       ├── [lodash] ←── selected     │                   │
│       └── [zod]                     │ [Run fix command] │
│                                     │                   │
└─────────────────────────────────────┴───────────────────┘
```

**Header bar**: Title, total package count, filter toggle buttons (All / Vulnerable / Outdated / Unused), close button.

**Graph area**: `@xyflow/react` with `dagre` layout (top-down / `TB` rankdir). Root node is the project. Direct dependencies fan out below as the default view. Each direct dep node that has transitive children (from the depth-1 tree data) shows a small expand/collapse indicator. Clicking it reveals the transitive children already present in the cached tree — no additional fetching occurs. Dagre re-layouts to accommodate the new nodes. The maximum depth shown is always 1 level of transitive deps (matching the `--depth 1` data source).

**Side detail panel**: Slides in from the right when a node is clicked. Shows:
- Package name and version
- Vulnerability details (CVE IDs, severity) if applicable
- Update info (current → latest, major/minor/patch) if outdated
- "Unused" notice if flagged by depcheck/knip
- Fix command button if a fix is available from the report's issue data
- Click another node to switch; click empty space or panel close button to dismiss

### Graph Behavior

- **Initial load**: Fit-to-view after layout completes (same `onInit` pattern as existing `DependencyGraph.tsx`)
- **Pan/zoom**: Built-in ReactFlow controls, min zoom 0.1, max zoom 2
- **Expand transitive**: Click expand indicator on a node to show its children (already in the cached tree data at depth 1). Dagre re-layouts smoothly.
- **Node click**: Opens/switches side panel. Does not interfere with expand.

### Filter Behavior

- **All** (default): Every node at full opacity
- **Vulnerable**: Nodes with npm-audit issues at full opacity; all others at 20% opacity
- **Outdated**: Nodes with outdated issues at full opacity; all others at 20% opacity
- **Unused**: Nodes flagged by depcheck/knip at full opacity; all others at 20% opacity
- Dimmed nodes remain interactive (clickable, expandable)
- Filter buttons are toggle-style; one active at a time

### Custom Node Component

ReactFlow custom node (`DepTreeNode`) renders:
- Package name (monospace)
- Version (smaller, muted)
- Status pills below: colored background, small text ("1 vuln", "outdated", "unused")
- Border color: worst status (red > orange > gray-dashed > default gray)
- Expand indicator (chevron or +/−) if the node has transitive dependencies

Node width: ~160px. Height: dynamic based on number of pills (~40-56px).

## Monorepo Support

For monorepo reports, the graph shows the dep tree for the currently selected package. Each package's Dependencies view has its own "View Graph" button. The `.sickbay/dep-tree.json` at the root contains trees keyed by package name:

```typescript
interface MonorepoDependencyTree {
  packages: Record<string, DependencyTree>;
}
```

The `DependencyList` component already receives a `SickbayReport` with `projectInfo.name`. The overlay receives this name as a `packageName` prop and uses it to look up the correct tree in `MonorepoDependencyTree.packages`. For single-project reports, the tree file contains a single `DependencyTree` (not wrapped in `packages`).

## Files to Create

| File | Purpose |
|------|---------|
| `packages/core/src/utils/dep-tree.ts` | `getDependencyTree()` utility |
| `packages/core/src/utils/dep-tree.test.ts` | Unit tests |
| `apps/web/src/components/DependencyTreeOverlay.tsx` | Overlay + graph + side panel |
| `apps/web/src/components/DependencyTreeOverlay.test.tsx` | Component tests |

## Files to Modify

| File | Change |
|------|--------|
| `packages/core/src/index.ts` | Export `getDependencyTree` and types |
| `apps/cli/src/components/App.tsx` | Call `getDependencyTree()` and write cache after scan |
| `apps/cli/src/index.ts` | Write cache in `--json` path |
| `apps/cli/src/components/tui/TuiApp.tsx` | Write cache after TUI scan |
| `apps/cli/src/commands/web.ts` | Add `/sickbay-dep-tree.json` endpoint |
| `packages/core/src/integrations/npm-audit.ts` | Add `vulnerablePackages` map to metadata |
| `apps/web/src/components/DependencyList.tsx` | Add "View Graph" button, render overlay |

## Testing

- **Core unit tests**: Mock `execa` for pnpm/npm/yarn, verify tree parsing, handle errors gracefully (return empty tree)
- **Web component tests**: Mock ReactFlow (same pattern as `DependencyGraph.test.tsx`), verify nodes rendered from tree data, filter toggling dims nodes, side panel opens on click, overlay open/close
- **Endpoint test**: Verify `/sickbay-dep-tree.json` serves cached file, returns 404 when no cache exists

## Error and Loading States

- **Loading**: Show a centered spinner/skeleton in the overlay while fetching `/sickbay-dep-tree.json`
- **No data (404)**: Show a message: "No dependency tree available — run a scan first." with a close button. This handles reports generated before this feature existed.
- **Empty tree**: If the project has no dependencies, show "No dependencies found" in the overlay.

## Out of Scope

- Full transitive tree (beyond depth 1) — expand-on-click covers depth 1 only
- Searching/filtering by package name (could be added later)
- Animated transitions on expand (keep it simple for v1)
- Dependency graph in the TUI (web only)
