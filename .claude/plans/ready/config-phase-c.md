# Feature: Config Phase C — Exclude Paths + Weight Overrides

> **Roadmap Phase**: Phase 2 — Standalone Polish (config system)
> **Blocked by**: Phase B (complete as of 2026-04-04)
> **Jira**: KAN-99

Validate patterns and imports against the codebase before implementing. Pay close attention
to existing type names, util locations, and runner registration patterns.

## Feature Description

Wire two remaining config fields into the pipeline:

1. **Exclude paths** — Global `exclude` patterns apply to all file-scanning runners. Per-check `exclude` patterns apply to individual runners. Both use picomatch glob syntax to filter files from analysis.
2. **Weight overrides** — Partial `weights` config merged with `CATEGORY_WEIGHTS` defaults, then normalized proportionally to sum to 1.0. Passed to `calculateOverallScore()`.

## User Story

As a developer using Sickbay
I want to exclude generated code and vendor directories from analysis, and adjust category weights to match my priorities
So that scores reflect my project's actual health, not noise from auto-generated files or categories I don't care about

## Problem Statement

Phase B wired thresholds. But users still can't exclude paths from scanning (e.g., `src/generated/**`, `src/vendor/**`) or adjust how much each category contributes to the overall score.

## Solution Statement

1. **Exclude**: Merge global `config.exclude` + per-check `checkConfig.exclude` into a combined list. Pass to runners via `RunOptions.checkConfig.exclude`. File-scanning runners (complexity, todo-scanner, secrets, asset-size, react-perf) filter files against the patterns using `picomatch`. External-tool runners (eslint, knip, jscpd, madge) pass patterns via their own `--ignore` flags where supported.
2. **Weights**: Add `normalizeWeights()` to `scoring.ts`. In `runner.ts`, resolve weights from config and pass to `calculateOverallScore()`. The function gains an optional `weights` parameter.

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Medium
**Packages Affected**: core (only)
**New npm Dependencies**: `picomatch` (glob matching for exclude patterns)
**Touches `types.ts`**: No (RunOptions.checkConfig.exclude already exists)

---

## CONTEXT REFERENCES

### Files to Read Before Implementing

- `packages/core/src/scoring.ts` — `CATEGORY_WEIGHTS`, `calculateOverallScore()` to extend with weights param
- `packages/core/src/runner.ts:111-165` — where config is resolved, weights passed to scoring, excludes merged
- `packages/core/src/config.ts` — `SickbayConfig.exclude`, `CheckConfig.exclude`, merging logic needed
- `packages/core/src/integrations/complexity.ts` — file-scanning runner pattern (uses `scanDirectory`)
- `packages/core/src/integrations/todo-scanner.ts` — file-scanning runner pattern
- `packages/core/src/integrations/secrets.ts` — file-scanning runner pattern
- `packages/core/src/integrations/asset-size.ts` — file-scanning runner pattern (uses `scanAssets`)
- `packages/core/src/integrations/react-perf.ts` — file-scanning runner pattern

### Runners That Scan Files Directly (need exclude filtering)

These runners use custom `scanDirectory`/`scanFile` functions with `readdirSync`:

| Runner | Scan function | Filters against |
|---|---|---|
| `complexity` | `scanDirectory()` → file paths | relative paths like `src/foo.ts` |
| `todo-scanner` | `scanDirectory()` → file paths | relative paths |
| `secrets` | `scanDirectory()` → file paths | relative paths |
| `react-perf` | `scanDirectory()` → file paths | relative paths |
| `asset-size` | `scanAssets()` → file paths | relative paths |

### Runners That Use External Tools (exclude via tool flags)

These runners shell out to tools — exclude patterns can be passed as flags:

| Runner | Tool | Exclude mechanism |
|---|---|---|
| `eslint` | eslint CLI | `--ignore-pattern` flag |
| `jscpd` | jscpd CLI | `--ignore` flag |
| `knip` | knip CLI | knip has its own config, skip |
| `depcheck` | depcheck | has `--ignores`, but for packages not paths, skip |
| `madge` | madge CLI | `--exclude` regex flag |

For Phase C, focus on file-scanning runners. External tool excludes are best-effort — some tools don't support arbitrary path ignores well.

### New Files to Create

None — all changes modify existing files.

### Patterns to Follow

**Exclude filtering** (shared utility):
```typescript
// packages/core/src/utils/exclude.ts
import picomatch from 'picomatch';

export function createExcludeFilter(patterns: string[]): (filePath: string) => boolean {
  if (patterns.length === 0) return () => false;
  const isMatch = picomatch(patterns);
  return (filePath: string) => isMatch(filePath);
}
```

**Usage in runners**:
```typescript
const isExcluded = createExcludeFilter(options?.checkConfig?.exclude ?? []);
// In scan loop:
if (isExcluded(relativePath)) continue;
```

---

## IMPLEMENTATION PLAN

### Phase 1: Add picomatch dependency

Install `picomatch` in core package. It's a small, zero-dep glob matcher.

### Phase 2: Create exclude utility

Add `createExcludeFilter()` helper in `packages/core/src/utils/exclude.ts`.

### Phase 3: Merge global + per-check excludes in runner.ts

In `runSickbay()`, combine `config.exclude` (global) with per-check `checkConfig.exclude` into a single array before passing to each runner.

### Phase 4: Wire exclude into file-scanning runners

5 runners: complexity, todo-scanner, secrets, react-perf, asset-size. Each filters scanned files against the exclude patterns.

### Phase 5: Weight normalization

Add `normalizeWeights()` to `scoring.ts`. Update `calculateOverallScore()` to accept optional custom weights. Wire in `runner.ts`.

### Phase 6: Tests

Unit tests for `createExcludeFilter`, `normalizeWeights`, exclude behavior in runners, and weight override in scoring.

---

## STEP-BY-STEP TASKS

### 1. ADD `picomatch` to core package

- **IMPLEMENT**: `pnpm --filter @nebulord/sickbay-core add picomatch` and `pnpm --filter @nebulord/sickbay-core add -D @types/picomatch`
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core build`

### 2. CREATE `packages/core/src/utils/exclude.ts`

- **IMPLEMENT**: Export `createExcludeFilter(patterns: string[]): (filePath: string) => boolean`
  - Returns a function that tests a relative file path against the patterns
  - Empty patterns array → always returns false (nothing excluded)
  - Uses `picomatch` for glob matching
- **VALIDATE**: Unit test in `exclude.test.ts`

### 3. CREATE `packages/core/src/utils/exclude.test.ts`

- **IMPLEMENT**: Test cases:
  - Empty patterns → nothing excluded
  - `src/generated/**` → excludes `src/generated/foo.ts`, doesn't exclude `src/app/foo.ts`
  - `**/*.test.ts` → excludes test files
  - Multiple patterns → union (any match excludes)
  - Exact file path → matches

### 4. UPDATE `packages/core/src/runner.ts` — merge global + per-check excludes

- **IMPLEMENT**: When building `checkConfig` for each runner, merge `config?.exclude` (global) with per-check `checkCfg?.exclude`:
  ```typescript
  const globalExclude = config?.exclude ?? [];
  const checkExclude = checkCfg?.exclude ?? [];
  const mergedExclude = [...globalExclude, ...checkExclude];
  // Pass mergedExclude as checkConfig.exclude
  ```
- **GOTCHA**: Global exclude applies even when there's no per-check config. So `checkConfig.exclude` must be set whenever global exclude is non-empty, even if `checkCfg` is null.
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core build`

### 5. UPDATE `packages/core/src/integrations/complexity.ts` — exclude filtering

- **IMPLEMENT**: Import `createExcludeFilter` from utils. In `run()`, create filter from `options.checkConfig.exclude`. Pass to `scanDirectory`, skip files that match.
- **APPROACH**: Pass `isExcluded` callback to the module-level `scanDirectory` function. Check relative path against filter before processing.
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- complexity`

### 6. UPDATE `packages/core/src/integrations/todo-scanner.ts` — exclude filtering

- **IMPLEMENT**: Same pattern as complexity. Create filter in `run()`, pass to `scanDirectory`/`scanFile`.
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- todo-scanner`

### 7. UPDATE `packages/core/src/integrations/secrets.ts` — exclude filtering

- **IMPLEMENT**: Same pattern. Pass filter to `scanDirectory`/`scanFile`.
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- secrets`

### 8. UPDATE `packages/core/src/integrations/react-perf.ts` — exclude filtering

- **IMPLEMENT**: Same pattern. Pass filter to `scanDirectory`.
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- react-perf`

### 9. UPDATE `packages/core/src/integrations/asset-size.ts` — exclude filtering

- **IMPLEMENT**: Same pattern. Pass filter to `scanAssets`.
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- asset-size`

### 10. UPDATE `packages/core/src/scoring.ts` — weight normalization + optional weights param

- **IMPLEMENT**:
  - Add `normalizeWeights(userWeights, defaults)` function (algorithm from spec)
  - Update `calculateOverallScore(checks, weights?)` — optional second param. If provided, use it instead of `CATEGORY_WEIGHTS`. Weights are already normalized.
  - Export `normalizeWeights` and `CATEGORY_WEIGHTS`
- **GOTCHA**: `CATEGORY_WEIGHTS` is currently a `const` — needs to be exported for use in runner.ts
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- scoring`

### 11. UPDATE `packages/core/src/runner.ts` — pass weights to scoring

- **IMPLEMENT**: After config loads, if `config?.weights` exists, call `normalizeWeights(config.weights, CATEGORY_WEIGHTS)` and pass result to `calculateOverallScore(checks, normalizedWeights)`.
- **IMPORTS**: Add `normalizeWeights, CATEGORY_WEIGHTS` to imports from `scoring.js`
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core build`

### 12. UPDATE `packages/core/src/index.ts` — export new utilities

- **IMPLEMENT**: Export `createExcludeFilter` from utils/exclude, `normalizeWeights` and `CATEGORY_WEIGHTS` from scoring
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core build`

### 13. ADD tests for weight normalization in `packages/core/src/scoring.test.ts`

- **IMPLEMENT**: Test cases:
  - No overrides → returns defaults unchanged
  - `{ security: 0.50 }` → security gets largest share, others shrink proportionally, all sum to 1.0
  - All categories overridden → normalized to sum to 1.0
  - Verify the spec example: `{ security: 0.50 }` → `{ security: 0.417, dependencies: 0.208, ... }`

### 14. ADD test for `calculateOverallScore` with custom weights

- **IMPLEMENT**: Pass checks from two categories with different scores. Verify custom weights change the overall score vs default weights.

### 15. ADD exclude tests in file-scanning runner test files

- **IMPLEMENT**: For each of the 5 file-scanning runners, add one test that verifies files matching an exclude pattern are skipped. Pass `checkConfig: { exclude: ['src/generated/**'] }` and create a file at `src/generated/foo.ts` — verify it doesn't appear in results.

### 16. ADD test in runner.test.ts for global + per-check exclude merging

- **IMPLEMENT**: Verify that global `config.exclude` and per-check `checkConfig.exclude` are merged into a single array passed to the runner.

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

### Level 4: Full build

```bash
pnpm build
```

### Level 5: Manual spot check

```bash
# Create a config with exclude and weights, scan a fixture
cat > fixtures/packages/react-app/sickbay.config.ts << 'EOF'
export default {
  exclude: ['src/test/**'],
  weights: { security: 0.50 },
  checks: {
    outdated: true,
  },
}
EOF
node apps/cli/dist/index.js --path fixtures/packages/react-app
# Verify "Custom config active" appears and score reflects adjusted weights
rm fixtures/packages/react-app/sickbay.config.ts
```

---

## ACCEPTANCE CRITERIA

- [ ] `picomatch` added to core dependencies
- [ ] `createExcludeFilter()` utility with tests
- [ ] Global `config.exclude` merged with per-check `checkConfig.exclude` in runner.ts
- [ ] 5 file-scanning runners filter files against exclude patterns
- [ ] `normalizeWeights()` function with tests matching spec algorithm
- [ ] `calculateOverallScore()` accepts optional custom weights
- [ ] runner.ts resolves and normalizes weights from config
- [ ] Weight validation (> 0) already works from Phase A
- [ ] All existing tests pass
- [ ] Snapshot regression tests pass
- [ ] Full build succeeds
- [ ] No changes to CLI or web packages (core-only)

---

## MONOREPO FUTURE-PROOFING NOTES

- Exclude patterns are relative to project root. In monorepo mode, each package gets its own `runSickbay()` call with its own `projectPath`, so relative paths work correctly.
- Weight overrides apply globally via root config. Per-package weight overrides would come in Phase F with per-package config resolution.

---

## NOTES

- **External tool excludes deferred**: Runners that shell out to tools (eslint, jscpd, madge) would need tool-specific `--ignore` flags. This is fragile and tool-version-dependent. For Phase C, exclude only applies to file-scanning runners. External tool excludes can be added later as needed.
- **picomatch vs minimatch**: picomatch is smaller (no deps), faster, and is what globby/micromatch use under the hood. It's the right choice for this use case.
- **Weight validation already exists**: Phase A added `validateConfig()` which throws on weight values ≤ 0. No new validation needed.
- **Backward compatible**: Empty `exclude` and no `weights` produce identical behavior to current code.
