# Feature: Config Phase B — Threshold Overrides

> **Roadmap Phase**: Phase 2 — Standalone Polish (config system)
> **Blocked by**: Phase A (complete as of 2026-04-04)
> **Jira**: KAN-99

Validate patterns and imports against the codebase before implementing. Pay close attention
to existing type names, util locations, and runner registration patterns.

## Feature Description

Wire threshold overrides from `sickbay.config.ts` into the 12 configurable runners. Each runner reads its `thresholds` from the config instead of hardcoded constants, falling back to existing defaults when no config is provided. Unknown threshold keys produce a warning to stderr.

## User Story

As a developer using Sickbay
I want to customize threshold values for individual health checks
So that Sickbay's scoring reflects my project's specific standards (e.g., a monorepo with intentionally large utility files, or a project that tolerates more outdated packages)

## Problem Statement

Phase A wired config loading and enable/disable. But runners still use hardcoded thresholds — a user can't tell Sickbay "500-line React components are fine for us" or "we fail at 5 outdated packages, not 15." The `thresholds` field exists on `CheckConfig` but nothing reads it yet.

## Solution Statement

1. Add `checkConfig?: CheckConfig` to the existing `RunOptions` interface
2. In `runner.ts`, resolve per-check config and pass it through the `options` parameter
3. Each of the 12 configurable runners reads thresholds from `options?.checkConfig?.thresholds` with typed defaults
4. Add a `getCheckConfig()` helper in `config.ts` to extract per-check config
5. Add unknown-threshold-key validation per runner
6. Complexity runner merges user thresholds with `FILE_TYPE_THRESHOLDS` from `file-types.ts`

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Medium
**Packages Affected**: core (only — no CLI/web changes needed)
**New npm Dependencies**: none
**Touches `types.ts`**: Yes (adds `checkConfig` to `RunOptions`)

---

## CONTEXT REFERENCES

### Files to Read Before Implementing

- `packages/core/src/types.ts:100-111` — `RunOptions` interface to extend
- `packages/core/src/config.ts` — `CheckConfig` type, `loadConfig()`, add `getCheckConfig()` helper
- `packages/core/src/runner.ts:132-142` — where runners are called, pass config through
- `packages/core/src/integrations/base.ts` — `BaseRunner`, `run()` signature already accepts `RunOptions`
- `packages/core/src/utils/file-types.ts` — `FILE_TYPE_THRESHOLDS`, `FileType` — complexity runner merges with these

### Runner Threshold Audit

Each runner's hardcoded values that become configurable:

| Runner | Hardcoded constants | Config shape |
|---|---|---|
| `outdated` | `count > 15` → fail | `{ maxOutdated: 15 }` |
| `complexity` | `FILE_TYPE_THRESHOLDS` (8 file types × warn/critical) | `{ 'react-component'?: {warn,critical}, ... }` |
| `jscpd` | `> 5` warn, `> 20` critical | `{ warnPercent: 5, criticalPercent: 20 }` |
| `coverage` | `< 80` lines, `< 80` functions | `{ lines: 80, functions: 80 }` |
| `eslint` | `> 10` errors → fail | `{ maxErrors: 10 }` |
| `typescript` | `> 20` errors → fail | `{ maxErrors: 20 }` |
| `madge` | `> 5` circles → fail | `{ maxCircular: 5 }` |
| `todo-scanner` | `TODO\|FIXME\|HACK` regex | `{ patterns: ['TODO','FIXME','HACK'] }` |
| `asset-size` | 6 byte constants | `{ imageWarn, imageCritical, svgWarn, fontWarn, totalWarn, totalCritical }` |
| `source-map-explorer` | `500KB` warn, `1MB` fail | `{ warnSize, failSize }` |
| `license-checker` | `PROBLEMATIC_LICENSES` array | `{ blocklist: string[] }` |
| `git` | `6` months stale, `20` branches | `{ staleMonths: 6, maxRemoteBranches: 20 }` |

### New Files to Create

None — all changes modify existing files.

### Patterns to Follow

**Threshold extraction pattern** (each runner):
```typescript
async run(projectPath: string, options?: RunOptions): Promise<CheckResult> {
  const thresholds = options?.checkConfig?.thresholds as MyThresholds | undefined;
  const maxErrors = thresholds?.maxErrors ?? 10; // hardcoded default
  // ... use maxErrors instead of literal 10
}
```

**Type per runner** (local interface, not exported):
```typescript
interface OutdatedThresholds {
  maxOutdated?: number;
}
```

---

## IMPLEMENTATION PLAN

### Phase 1: Types and Plumbing

Extend `RunOptions` with `checkConfig` and add a helper to extract per-check config.

### Phase 2: Runner Wiring

Update `runner.ts` to resolve and pass per-check config to each runner.

### Phase 3: Runner Updates (12 runners)

Each runner reads thresholds from config with fallback to hardcoded defaults.

### Phase 4: Threshold Validation

Warn on unknown threshold keys per runner.

### Phase 5: Tests

Unit tests for each runner's threshold override behavior.

---

## STEP-BY-STEP TASKS

### 1. UPDATE `packages/core/src/types.ts`

- **IMPLEMENT**: Add `checkConfig?: CheckConfig` to the `RunOptions` interface
- **IMPORTS**: Add `import type { CheckConfig } from './config.js'` — but to avoid circular deps, use inline type:
  ```typescript
  checkConfig?: {
    thresholds?: Record<string, unknown>;
    exclude?: string[];
    suppress?: Array<{ path?: string; match?: string; reason: string }>;
  };
  ```
  Actually, since `config.ts` already imports from `types.ts` would be circular. Instead, import `CheckConfig` from config in runner.ts only and pass the relevant piece. The cleanest approach: add `checkConfig` to `RunOptions` using the shape directly (no import from config.ts needed since RunOptions is in types.ts).
- **GOTCHA**: `CheckConfig` is defined in `config.ts` which doesn't import from `types.ts`, but `types.ts` shouldn't import from `config.ts` (circular risk with runner). Use `Record<string, unknown>` for `thresholds` in RunOptions — runners cast locally.
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core build`

Final shape:
```typescript
export interface RunOptions {
  verbose?: boolean;
  timeout?: number;
  checkConfig?: {
    thresholds?: Record<string, unknown>;
    exclude?: string[];
  };
}
```

### 2. ADD `getCheckConfig()` to `packages/core/src/config.ts`

- **IMPLEMENT**: Helper that extracts per-check config from `SickbayConfig`:
  ```typescript
  export function getCheckConfig(config: SickbayConfig | null, checkId: string): CheckConfig | null {
    if (!config?.checks) return null;
    const entry = config.checks[checkId];
    if (typeof entry === 'object' && entry.enabled !== false) return entry;
    return null;
  }
  ```
- **VALIDATE**: Unit test in `config.test.ts`

### 3. UPDATE `packages/core/src/runner.ts`

- **IMPLEMENT**: In the `runners.map(async (runner) => { ... })` block, resolve per-check config and pass it:
  ```typescript
  const checkCfg = getCheckConfig(config, runner.name);
  const result = await runner.run(projectPath, {
    verbose: options.verbose,
    checkConfig: checkCfg ? { thresholds: checkCfg.thresholds, exclude: checkCfg.exclude } : undefined,
  });
  ```
- **IMPORTS**: Add `getCheckConfig` to the existing import from `./config.js`
- **GOTCHA**: Don't change the existing `options.onCheckStart` / `options.onCheckComplete` flow
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core build`

### 4. UPDATE `packages/core/src/integrations/outdated.ts`

- **IMPLEMENT**: Read `maxOutdated` from config thresholds, default 15
- **PATTERN**: Add local `OutdatedThresholds` interface, extract at top of `run()`
- **CHANGE**: Line 72 — `count > 15` becomes `count > maxOutdated`
- The score formula `100 - count * 3` stays unchanged (it's continuous, not threshold-based)
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- outdated`

### 5. UPDATE `packages/core/src/integrations/complexity.ts`

- **IMPLEMENT**: Merge user thresholds with `FILE_TYPE_THRESHOLDS`. Config shape matches `FileType` keys.
- **APPROACH**: If user provides `thresholds: { 'react-component': { warn: 500, critical: 800 } }`, merge into a copy of `FILE_TYPE_THRESHOLDS`. Pass merged thresholds to a new local helper instead of calling `getThresholds()` directly.
- **GOTCHA**: `getThresholds()` in `file-types.ts` classifies the file AND returns thresholds. We still need classification but override the thresholds. Solution: use `classifyFile()` from file-types.ts, then look up thresholds from merged map.
- **IMPORTS**: Add `classifyFile`, `FILE_TYPE_THRESHOLDS`, `FileType` from `file-types.ts` (already imports `getThresholds` and `getFileTypeLabel`)
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- complexity`

### 6. UPDATE `packages/core/src/integrations/jscpd.ts`

- **IMPLEMENT**: Read `warnPercent` (default 5) and `criticalPercent` (default 20) from config
- **CHANGE**: Lines 63, 65, 80-86 — replace hardcoded 5 and 20 with config values
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- jscpd`

### 7. UPDATE `packages/core/src/integrations/coverage.ts`

- **IMPLEMENT**: Read `lines` (default 80) and `functions` (default 80) from config
- **CHANGE**: Lines 199, 207 — replace hardcoded 80 with config values. Also line 245-248 (status thresholds using `< 50` stays — that's the fail-hard floor, not configurable)
- **GOTCHA**: Coverage has two code paths (`buildResult` and `readExistingCoverage`). Both need to use the same thresholds. Thread thresholds through or store on instance.
- **APPROACH**: Pass thresholds as params to `buildResult()` and `readExistingCoverage()`. The `run()` method extracts thresholds from options and passes down.
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- coverage`

### 8. UPDATE `packages/core/src/integrations/eslint.ts`

- **IMPLEMENT**: Read `maxErrors` (default 10) from config
- **CHANGE**: Line 104 — `totalErrors > 10` becomes `totalErrors > maxErrors`
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- eslint`

### 9. UPDATE `packages/core/src/integrations/typescript.ts`

- **IMPLEMENT**: Read `maxErrors` (default 20) from config
- **CHANGE**: Line 73 — `count > 20` becomes `count > maxErrors`
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- typescript`

### 10. UPDATE `packages/core/src/integrations/madge.ts`

- **IMPLEMENT**: Read `maxCircular` (default 5) from config
- **CHANGE**: Line 124 — `circles.length > 5` becomes `circles.length > maxCircular`
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- madge`

### 11. UPDATE `packages/core/src/integrations/todo-scanner.ts`

- **IMPLEMENT**: Read `patterns` (default `['TODO', 'FIXME', 'HACK']`) from config
- **CHANGE**: Line 16 — `TODO_PATTERN` regex needs to be built dynamically from the patterns array. Move pattern construction into `run()` or a helper.
- **APPROACH**: Build regex in `run()`: `new RegExp('\\b(' + patterns.join('|') + ')\\b[:\\s]*(.*)', 'i')`
- **GOTCHA**: The `TODO_PATTERN` is currently module-level const. Move to inside `run()` or pass to `scanDirectory`/`scanFile`.
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- todo-scanner`

### 12. UPDATE `packages/core/src/integrations/asset-size.ts`

- **IMPLEMENT**: Read 6 threshold values from config, defaulting to current constants
- **CHANGE**: Lines 24-29 constants become defaults; actual values come from config
- **APPROACH**: Extract thresholds at top of `run()`, pass to the comparison logic
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- asset-size`

### 13. UPDATE `packages/core/src/integrations/source-map-explorer.ts`

- **IMPLEMENT**: Read `warnSize` (default 512000) and `failSize` (default 1048576) from config
- **CHANGE**: Lines 36-37 constants become defaults; lines 95, 104, 116-119, 190, 201, 214-215 use config values
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- source-map`

### 14. UPDATE `packages/core/src/integrations/license-checker.ts`

- **IMPLEMENT**: Read `blocklist` (default `PROBLEMATIC_LICENSES`) from config
- **CHANGE**: Line 15 array becomes default; line 47 comparison uses config value
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- license`

### 15. UPDATE `packages/core/src/integrations/git.ts`

- **IMPLEMENT**: Read `staleMonths` (default 6) and `maxRemoteBranches` (default 20) from config
- **CHANGE**: Lines 59-60 (stale check) and line 69 (branch count) use config values
- **GOTCHA**: Stale detection currently parses the human-readable `git log --format=%cr` output (e.g., "8 months ago"). For configurable months, we need to parse the number from the string and compare against `staleMonths`. Current logic: `lastCommit.includes('year') || (lastCommit.includes('month') && parseInt(lastCommit) > 6)`. Change `6` to `staleMonths`.
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- git`

### 16. ADD unknown threshold key validation

- **IMPLEMENT**: In `config.ts`, add `validateThresholdKeys()` that accepts a check ID and the known keys for that runner. Called during validation phase.
- **APPROACH**: Define a `KNOWN_THRESHOLD_KEYS` map in `config.ts` (or export from each runner) mapping check IDs to valid key arrays. During `validateConfig()`, check each `thresholds` object against known keys and warn on unknown ones.
- **ALTERNATIVE** (simpler, preferred): Each runner validates its own thresholds at the start of `run()`. If it finds unknown keys, it writes a warning to stderr. This is more decentralized but keeps runner knowledge local.
- **DECISION**: Centralized approach in `validateConfig()` — keeps validation in one place, consistent with how unknown check IDs are already validated there. Define the known keys map in config.ts.
- **VALIDATE**: Unit test in `config.test.ts`

### 17. ADD tests for `getCheckConfig()` in `packages/core/src/config.test.ts`

- **IMPLEMENT**: Test cases:
  - Returns null when config is null
  - Returns null when check not in config
  - Returns null when check is `true`
  - Returns null when check is `false`
  - Returns null when check has `enabled: false`
  - Returns CheckConfig object when check has thresholds
  - Returns CheckConfig object when check has exclude/suppress but no thresholds

### 18. ADD threshold override tests to each runner's test file

- **IMPLEMENT**: For each of the 12 runners, add a test that passes custom thresholds via `options.checkConfig.thresholds` and verifies the runner uses them instead of defaults.
- **PATTERN**: Most runner tests mock `execa` — add a test case that feeds the same data but with custom thresholds and asserts different status/score.
- **KEY TESTS**:
  - `outdated.test.ts`: 16 outdated packages → fail with default, pass with `{ maxOutdated: 20 }`
  - `complexity.test.ts`: File with 400 lines → warning for react-component default (300), pass with `{ 'react-component': { warn: 500 } }`
  - `jscpd.test.ts`: 10% duplication → warning with default (5%), pass with `{ warnPercent: 15 }`
  - `eslint.test.ts`: 12 errors → fail with default (10), warning with `{ maxErrors: 15 }`
  - `typescript.test.ts`: 22 errors → fail with default (20), warning with `{ maxErrors: 25 }`
  - `git.test.ts`: 25 branches → info with default (20), pass with `{ maxRemoteBranches: 30 }`
  - etc.

---

## VALIDATION COMMANDS

### Level 1: Type checking

```bash
pnpm --filter @nebulord/sickbay-core build
```

### Level 2: Unit tests

```bash
pnpm --filter @nebulord/sickbay-core test
```

### Level 3: Snapshot regression

```bash
pnpm test:snapshots
```

### Level 4: Full build (ensures CLI/web still compile with types.ts change)

```bash
pnpm build
```

### Level 5: Manual spot check

```bash
# Create a temp config with custom thresholds and scan a fixture
echo 'export default { checks: { outdated: { thresholds: { maxOutdated: 5 } } } }' > fixtures/packages/node-api/sickbay.config.ts
node apps/cli/dist/index.js --path fixtures/packages/node-api
# Verify outdated check uses the custom threshold
rm fixtures/packages/node-api/sickbay.config.ts
```

---

## ACCEPTANCE CRITERIA

- [ ] `RunOptions.checkConfig` field added to types.ts
- [ ] `getCheckConfig()` helper in config.ts with tests
- [ ] `runner.ts` resolves and passes per-check config to each runner
- [ ] All 12 configurable runners read thresholds from config with fallback to defaults
- [ ] Unknown threshold keys produce warnings to stderr
- [ ] Complexity runner merges user thresholds with `FILE_TYPE_THRESHOLDS`
- [ ] Each runner has at least one test verifying threshold override behavior
- [ ] All existing tests pass (`pnpm --filter @nebulord/sickbay-core test`)
- [ ] Snapshot regression tests pass (`pnpm test:snapshots`)
- [ ] Full build succeeds (`pnpm build`)
- [ ] No changes to CLI or web packages (core-only)

---

## MONOREPO FUTURE-PROOFING NOTES

- Config is already loaded once at root for monorepo scans and passed to per-package `runSickbay()` calls via `_config`. Threshold overrides will automatically work per-package since the config threading is already in place.
- Per-package config override (Phase F) will allow different thresholds per package — no structural changes needed in runners for that, just different config resolution in `runner.ts`.

---

## NOTES

- **No CLI/web changes**: Phase B is entirely within `packages/core`. The config metadata (`overriddenChecks`) already detects checks with thresholds set — it will automatically reflect Phase B configs in CLI/web notices.
- **Scoring formulas unchanged**: Thresholds control status (pass/warning/fail) boundaries, not the continuous score formulas. For example, `outdated` still scores `100 - count * 3` regardless of threshold — the threshold only controls when status becomes 'fail'.
- **todo-scanner patterns**: This is the most structurally different threshold — it changes the detection regex, not a numeric boundary. The regex must be rebuilt per-run when custom patterns are provided.
- **Backward compatible**: All thresholds are optional with defaults matching current hardcoded values. No behavioral change for users without a config.
