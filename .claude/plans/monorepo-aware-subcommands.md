# Feature: Monorepo-Aware Subcommands

> **Roadmap Phase**: Phase 3 — Monorepo Support (completing the last gap)
> **Blocked by**: nothing — monorepo detection, `runSickbayMonorepo`, and `--package` on the main scan are all shipped

Validate patterns and imports against the codebase before implementing. Pay close attention
to existing type names, util locations, and runner registration patterns.

## Feature Description

The subcommands `doctor`, `stats`, `trend`, and `fix` currently accept `--path` but ignore monorepo structure entirely. When pointed at a monorepo root they scan only the root `package.json` and produce misleading results (e.g. `sickbay doctor` against the fixtures monorepo checks for React/browser configs that are irrelevant to the Node API package inside it).

This feature threads monorepo awareness through all four subcommands using the same `detectMonorepo` + `--package` pattern already proven on the main scan command.

## User Story

As a developer working in a monorepo
I want `sickbay doctor`, `sickbay stats`, `sickbay trend`, and `sickbay fix` to understand my workspace structure
So that I get accurate per-package results instead of misleading root-level output

## Problem Statement

All four subcommands blindly use `options.path` (defaulting to cwd) as a single project path. In a monorepo this means:

- `doctor` checks root-level configs that may not exist (browserslist, React versions) and misses package-level issues
- `stats` counts root files and misses per-package breakdowns
- `trend` looks for `.sickbay/history.json` at the root which may not exist per-package
- `fix` scans the root and finds issues that belong to specific packages, then runs fix commands in the wrong directory

## Solution Statement

For each subcommand, add `--package <name>` option. When run at a monorepo root:

1. **With `--package`**: Resolve the named package path (same logic as main scan), run the subcommand against that single package
2. **Without `--package`**: Run the subcommand against each discovered package and aggregate/display results with package labels

This mirrors how the main scan already handles `--package` in `index.ts` lines 56-80.

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Medium
**Packages Affected**: cli only (core already has all needed infrastructure)
**New npm Dependencies**: none
**Touches `types.ts`**: No

---

## CONTEXT REFERENCES

### Files to Read Before Implementing

- `apps/cli/src/index.ts` (lines 56-80) — the `--package` resolution pattern to replicate
- `apps/cli/src/commands/doctor.ts` — `runDiagnostics(projectPath)` function signature
- `apps/cli/src/commands/stats.ts` — `gatherStats(projectPath)` function signature
- `apps/cli/src/commands/fix.ts` — `collectFixableIssues(report)` and `executeFix(fix, projectPath)` signatures
- `apps/cli/src/commands/trend.ts` — pure utility (sparkline/trendArrow), no changes needed
- `apps/cli/src/lib/history.ts` — `loadHistory(projectPath)` reads from `<projectPath>/.sickbay/history.json`
- `apps/cli/src/components/DoctorApp.tsx` — current props: `{ projectPath, autoFix, jsonOutput }`
- `apps/cli/src/components/StatsApp.tsx` — current props: `{ projectPath, jsonOutput }`
- `apps/cli/src/components/TrendApp.tsx` — current props: `{ projectPath, last, jsonOutput }`
- `apps/cli/src/components/FixApp.tsx` — current props: `{ projectPath, checks?, applyAll, dryRun, verbose }`
- `packages/core/src/utils/detect-monorepo.ts` — `detectMonorepo(rootPath)` returns `MonorepoInfo | { isMonorepo: false }`

### New Files to Create

None — all changes are to existing files.

### Patterns to Follow

**Package resolution pattern** (from `index.ts`):

```typescript
const { detectMonorepo } = await import('@sickbay/core');
const monorepoInfo = await detectMonorepo(options.path);

if (options.package && monorepoInfo.isMonorepo) {
  const { readFileSync } = await import('fs');
  const targetPath = monorepoInfo.packagePaths.find((p) => {
    try {
      const pkg = JSON.parse(readFileSync(join(p, 'package.json'), 'utf-8'));
      return pkg.name === options.package || pkg.name?.endsWith(`/${options.package}`);
    } catch {
      return false;
    }
  });

  if (!targetPath) {
    process.stderr.write(`Package "${options.package}" not found in monorepo\n`);
    process.exit(1);
  }
  // ... use targetPath instead of options.path
}
```

**Multi-package iteration pattern**: When no `--package` is specified and a monorepo is detected, iterate over `monorepoInfo.packagePaths`, resolve each package name from its `package.json`, and pass each path to the subcommand's core function.

---

## IMPLEMENTATION PLAN

### Strategy: Shared helper + per-command wiring

Extract a shared `resolvePackagePath` helper to avoid duplicating the package-name-to-path resolution logic across 4 commands. Then update each command's action handler in `index.ts` and its corresponding component.

### Phase 1: Shared Monorepo Resolution Helper

Create a small utility function that both the main scan and subcommands can use to resolve `--package` to a path. This deduplicates the logic currently inline in the main action handler.

### Phase 2: Update `index.ts` Command Definitions

Add `--package <name>` option to each of the four subcommands. In each action handler, call `detectMonorepo` and resolve the package path before rendering the component.

### Phase 3: Update Components for Multi-Package Support

For the "no `--package` at monorepo root" case, each component needs to handle iterating over multiple packages:

- **DoctorApp**: Run diagnostics per package, display results grouped by package name
- **StatsApp**: Gather stats per package, display a multi-package summary
- **TrendApp**: Load history per package, show per-package sparklines
- **FixApp**: Scan per package, present fixes grouped by package

### Phase 4: Tests

Update existing tests and add new test cases for monorepo scenarios.

---

## STEP-BY-STEP TASKS

### 1. CREATE `apps/cli/src/lib/resolve-package.ts`

Extract the package resolution logic into a reusable helper:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';
import { detectMonorepo } from '@sickbay/core';
import type { MonorepoInfo } from '@sickbay/core';

export interface MonorepoResolution {
  isMonorepo: true;
  monorepoInfo: MonorepoInfo;
  targetPath?: string; // set when --package resolves
  packagePaths: string[]; // all discovered packages
  packageNames: Map<string, string>; // path → name
}

export interface SingleProjectResolution {
  isMonorepo: false;
  targetPath: string;
}

export type ProjectResolution = MonorepoResolution | SingleProjectResolution;

export async function resolveProject(
  projectPath: string,
  packageName?: string,
): Promise<ProjectResolution> {
  const monorepoInfo = await detectMonorepo(projectPath);

  if (!monorepoInfo.isMonorepo) {
    if (packageName) {
      process.stderr.write(`--package flag used but "${projectPath}" is not a monorepo\n`);
      process.exit(1);
    }
    return { isMonorepo: false, targetPath: projectPath };
  }

  // Build name→path map
  const packageNames = new Map<string, string>();
  for (const p of monorepoInfo.packagePaths) {
    try {
      const pkg = JSON.parse(readFileSync(join(p, 'package.json'), 'utf-8'));
      packageNames.set(p, pkg.name ?? p);
    } catch {
      packageNames.set(p, p);
    }
  }

  if (packageName) {
    const targetPath = monorepoInfo.packagePaths.find((p) => {
      const name = packageNames.get(p) ?? '';
      return name === packageName || name.endsWith(`/${packageName}`);
    });

    if (!targetPath) {
      process.stderr.write(`Package "${packageName}" not found in monorepo\n`);
      process.exit(1);
    }

    return {
      isMonorepo: true,
      monorepoInfo,
      targetPath,
      packagePaths: monorepoInfo.packagePaths,
      packageNames,
    };
  }

  return {
    isMonorepo: true,
    monorepoInfo,
    packagePaths: monorepoInfo.packagePaths,
    packageNames,
  };
}
```

- **VALIDATE**: `pnpm --filter @sickbay/cli build`

### 2. UPDATE `apps/cli/src/index.ts` — Add `--package` to all four subcommands

For each subcommand (`doctor`, `stats`, `trend`, `fix`), add:

```
.option("--package <name>", "scope to a single package (monorepo only)")
```

Then in each action handler, call `resolveProject()` and pass the resolution to the component.

**doctor handler changes:**

- Import `resolveProject`
- Call `resolveProject(options.path, options.package)`
- Pass resolution info to `DoctorApp` as new props: `isMonorepo`, `packagePaths`, `packageNames`, or `targetPath` for single-package

**stats handler changes:**

- Same pattern as doctor

**trend handler changes:**

- Same pattern as doctor

**fix handler changes:**

- Same pattern as doctor

- **VALIDATE**: `pnpm --filter @sickbay/cli build`

### 3. UPDATE `apps/cli/src/components/DoctorApp.tsx` — Multi-package support

**Props change:**

```typescript
interface DoctorAppProps {
  projectPath: string; // root or single package path
  autoFix: boolean;
  jsonOutput: boolean;
  // New:
  isMonorepo?: boolean;
  packagePaths?: string[]; // when monorepo, all package paths
  packageNames?: Map<string, string>;
}
```

**Behavior:**

- If `isMonorepo` and `packagePaths` provided: run `runDiagnostics` for each package, display results grouped under package name headers
- If single project: unchanged behavior
- JSON output: array of `{ package: string, results: DiagnosticResult[] }` for monorepo

- **VALIDATE**: `pnpm --filter @sickbay/cli build && pnpm --filter @sickbay/cli test`

### 4. UPDATE `apps/cli/src/components/StatsApp.tsx` — Multi-package support

**Props change:**

```typescript
interface StatsAppProps {
  projectPath: string;
  jsonOutput: boolean;
  // New:
  isMonorepo?: boolean;
  packagePaths?: string[];
  packageNames?: Map<string, string>;
}
```

**Behavior:**

- If monorepo: run `gatherStats` per package, show a compact summary table (package name, files, LOC, deps, framework)
- If single project: unchanged behavior

- **VALIDATE**: `pnpm --filter @sickbay/cli build && pnpm --filter @sickbay/cli test`

### 5. UPDATE `apps/cli/src/components/TrendApp.tsx` — Multi-package support

**Props change:**

```typescript
interface TrendAppProps {
  projectPath: string;
  last: number;
  jsonOutput: boolean;
  // New:
  isMonorepo?: boolean;
  packagePaths?: string[];
  packageNames?: Map<string, string>;
}
```

**Behavior:**

- If monorepo: load history for each package, show a per-package sparkline + score summary
- If single project: unchanged behavior

- **VALIDATE**: `pnpm --filter @sickbay/cli build && pnpm --filter @sickbay/cli test`

### 6. UPDATE `apps/cli/src/components/FixApp.tsx` — Multi-package support

**Props change:**

```typescript
interface FixAppProps {
  projectPath: string;
  checks?: string[];
  applyAll: boolean;
  dryRun: boolean;
  verbose: boolean;
  // New:
  isMonorepo?: boolean;
  packagePaths?: string[];
  packageNames?: Map<string, string>;
}
```

**Behavior:**

- If monorepo: scan each package via `runSickbay`, collect fixable issues with package labels, present grouped selection UI, execute fixes in the correct package directory
- If single project: unchanged behavior

- **VALIDATE**: `pnpm --filter @sickbay/cli build && pnpm --filter @sickbay/cli test`

### 7. UPDATE `apps/cli/src/index.ts` — Refactor main scan to use `resolveProject`

Optionally refactor the main scan's inline package resolution to use the new shared helper. This deduplicates ~25 lines.

- **VALIDATE**: `pnpm --filter @sickbay/cli build`

### 8. ADD tests

- `apps/cli/src/lib/resolve-package.test.ts` — test `resolveProject` with mock monorepo info
- Update `apps/cli/src/components/DoctorApp.test.tsx` — add monorepo test case
- Update `apps/cli/src/components/StatsApp.test.tsx` — add monorepo test case
- Update `apps/cli/src/components/TrendApp.test.tsx` — add monorepo test case
- Update `apps/cli/src/components/FixApp.test.tsx` — add monorepo test case

- **VALIDATE**: `pnpm --filter @sickbay/cli test`

---

## VALIDATION COMMANDS

### Level 1: Type checking and linting

```bash
pnpm --filter @sickbay/cli build    # catches type errors
pnpm lint                           # ESLint across all packages
```

### Level 2: Unit tests

```bash
pnpm --filter @sickbay/cli test     # cli unit tests
pnpm --filter @sickbay/core test    # core tests (should be unaffected)
```

### Level 3: Full build and manual validation

```bash
pnpm build                          # full turbo build
```

### Level 4: Manual spot checks

```bash
# Single project (should work as before)
node apps/cli/dist/index.js doctor --path fixtures/packages/react-app
node apps/cli/dist/index.js stats --path fixtures/packages/react-app
node apps/cli/dist/index.js fix --path fixtures/packages/react-app --dry-run

# Monorepo root without --package (should show all packages)
node apps/cli/dist/index.js doctor --path fixtures
node apps/cli/dist/index.js stats --path fixtures
node apps/cli/dist/index.js fix --path fixtures --dry-run

# Monorepo root with --package (should scope to one package)
node apps/cli/dist/index.js doctor --path fixtures --package react-app
node apps/cli/dist/index.js stats --path fixtures --package react-app
node apps/cli/dist/index.js fix --path fixtures --package node-api --dry-run

# Trend (may have no history — that's OK, should not error)
node apps/cli/dist/index.js trend --path fixtures --package react-app
```

---

## ACCEPTANCE CRITERIA

- [ ] All four subcommands accept `--package <name>` flag
- [ ] `--package` resolves correctly using same logic as main scan
- [ ] Without `--package` at monorepo root, subcommands iterate all packages
- [ ] Single-project behavior is completely unchanged (no regressions)
- [ ] JSON output works correctly for both monorepo and single-project modes
- [ ] All type checks pass (`pnpm build`)
- [ ] All existing tests pass, new tests added for monorepo paths
- [ ] Linting passes (`pnpm lint`)
- [ ] Manual verification against fixtures/ monorepo produces correct results

---

## NOTES

- The `trend` command is the trickiest for monorepo since history is stored per-project in `.sickbay/history.json`. Packages within a monorepo may or may not have history depending on whether they've been scanned individually before. The component should handle missing history gracefully (already does for single projects).
- `FixApp` is the most complex component (multi-phase with keyboard input). For the monorepo case, the simplest approach is to scan all packages, collect all fixable issues with package name labels, and present them in one unified selection UI. Each fix already carries its `projectPath` context via the report.
- The `resolveProject` helper should also be usable by the main scan action handler to reduce duplication, but this refactor is optional and lower priority than getting the subcommands working.
- Consider using `basename` or the short package name (after `/`) for display labels to keep terminal output compact.
