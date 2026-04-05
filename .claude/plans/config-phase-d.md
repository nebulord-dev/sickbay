# Feature: Config Phase D — Suppression

> **Roadmap Phase**: Phase 2 — Standalone Polish (config system)
> **Blocked by**: Phase C (complete as of 2026-04-04)
> **Jira**: KAN-99

Validate patterns and imports against the codebase before implementing. Pay close attention
to existing type names, util locations, and runner registration patterns.

## Feature Description

Per-check suppression rules that filter issues from check results before scoring. Users can suppress specific findings by file path (glob), message content (substring), or both. Every suppression requires a `reason` field to prevent suppress-and-forget drift. Suppressed findings are tracked in report metadata.

## User Story

As a developer using Sickbay
I want to suppress known false positives and intentional violations
So that my health scores reflect real issues, not noise I've already evaluated

## Problem Statement

Some findings are intentional (e.g., `NEXT_PUBLIC_` env vars flagged as secrets, a specific npm advisory that's not exploitable in context). Currently users can only disable the entire check — there's no way to keep the check running but suppress specific findings.

## Solution Statement

1. Add `suppress` field to `RunOptions.checkConfig` (already on `CheckConfig` type)
2. Create `applySuppression()` utility that filters `Issue[]` against `SuppressionRule[]`
3. In `runner.ts`, apply suppression to each runner's results after `run()` returns
4. Track suppressed count in `CheckResult.metadata` and report-level config metadata
5. `SuppressionRule.path` uses picomatch (already installed), `match` is case-insensitive substring

Key design decision: suppression happens **in runner.ts after the runner returns**, not inside each runner. This keeps runner code clean and centralizes the logic.

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Low-Medium
**Packages Affected**: core (only)
**New npm Dependencies**: none (picomatch already installed from Phase C)
**Touches `types.ts`**: Yes (add `suppress` to `RunOptions.checkConfig`)

---

## CONTEXT REFERENCES

### Files to Read Before Implementing

- `packages/core/src/config.ts:16-27` — `CheckConfig.suppress`, `SuppressionRule` types (already defined)
- `packages/core/src/types.ts:69-75` — `Issue` interface (`file?`, `message` fields matched against)
- `packages/core/src/types.ts:108-115` — `RunOptions.checkConfig` to extend with `suppress`
- `packages/core/src/runner.ts:138-148` — where runner results come back, apply suppression here
- `packages/core/src/utils/exclude.ts` — picomatch pattern, similar glob matching needed

### New Files to Create

- `packages/core/src/utils/suppress.ts` — `applySuppression()` utility
- `packages/core/src/utils/suppress.test.ts` — tests

---

## STEP-BY-STEP TASKS

### 1. UPDATE `packages/core/src/types.ts` — add suppress to RunOptions

- **IMPLEMENT**: Add `suppress` field to `RunOptions.checkConfig`:
  ```typescript
  checkConfig?: {
    thresholds?: Record<string, unknown>;
    exclude?: string[];
    suppress?: Array<{ path?: string; match?: string; reason: string }>;
  };
  ```
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core build`

### 2. CREATE `packages/core/src/utils/suppress.ts`

- **IMPLEMENT**: `applySuppression(issues, rules)` function:
  ```typescript
  import picomatch from 'picomatch';
  import type { Issue } from '../types.js';
  import type { SuppressionRule } from '../config.js';

  interface SuppressionResult {
    issues: Issue[];
    suppressedCount: number;
  }

  export function applySuppression(
    issues: Issue[],
    rules: SuppressionRule[],
  ): SuppressionResult {
    if (rules.length === 0) return { issues, suppressedCount: 0 };

    // Pre-compile path matchers
    const compiled = rules.map(rule => ({
      pathMatch: rule.path ? picomatch(rule.path) : null,
      match: rule.match?.toLowerCase() ?? null,
    }));

    let suppressedCount = 0;
    const kept = issues.filter(issue => {
      const suppressed = compiled.some(rule => {
        const pathOk = rule.pathMatch
          ? (issue.file ? rule.pathMatch(issue.file) : false)
          : true; // no path filter = matches all
        const matchOk = rule.match
          ? issue.message.toLowerCase().includes(rule.match)
          : true; // no match filter = matches all
        return pathOk && matchOk;
      });
      if (suppressed) suppressedCount++;
      return !suppressed;
    });

    return { issues: kept, suppressedCount };
  }
  ```
- **LOGIC**: When both `path` and `match` are provided → AND (both must match). When only one is provided → it alone determines the match. A rule with neither would match everything — but `reason` is required so this is a user choice.
- **VALIDATE**: Unit tests

### 3. CREATE `packages/core/src/utils/suppress.test.ts`

- **IMPLEMENT**: Test cases:
  - Empty rules → returns all issues unchanged, suppressedCount 0
  - Path-only rule → suppresses issues with matching `file`, keeps others
  - Match-only rule → suppresses issues with matching `message` substring, case-insensitive
  - Path AND match rule → only suppresses when both match
  - Path rule on issue without `file` field → no match (issue kept)
  - Multiple rules → union (any rule matching suppresses)
  - Returns correct `suppressedCount`

### 4. UPDATE `packages/core/src/runner.ts` — thread suppress and apply post-run

- **IMPLEMENT**:
  1. Pass `suppress` from `checkCfg` through to `checkConfig`:
     ```typescript
     checkConfig: ... ? {
       thresholds: checkCfg?.thresholds,
       exclude: mergedExclude.length > 0 ? mergedExclude : undefined,
       suppress: checkCfg?.suppress,
     } : undefined,
     ```
  2. After `runner.run()` returns, apply suppression:
     ```typescript
     const result = await runner.run(...);
     if (checkCfg?.suppress?.length) {
       const { issues, suppressedCount } = applySuppression(result.issues, checkCfg.suppress);
       result.issues = issues;
       if (suppressedCount > 0) {
         result.metadata = { ...result.metadata, suppressedCount };
       }
     }
     ```
- **IMPORTS**: Add `applySuppression` from `./utils/suppress.js`
- **GOTCHA**: Suppression must happen BEFORE `onCheckComplete` callback fires, so consumers see filtered results
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core build`

### 5. UPDATE `packages/core/src/index.ts` — export suppress utility

- **IMPLEMENT**: Export `applySuppression` from `./utils/suppress.js` and re-export `SuppressionRule` type if not already exported (it is — check)
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core build`

### 6. ADD tests for suppression in runner.test.ts

- **IMPLEMENT**: Add test that configures a check with `suppress` rules, verifies the returned `CheckResult.issues` are filtered and `metadata.suppressedCount` is set
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test -- runner`

### 7. UPDATE VitePress docs — remove "coming soon" from suppression

- **IMPLEMENT**: Remove `(coming soon)` from the Suppression Rules heading in `apps/docs/guide/configuration.md`
- **VALIDATE**: Visual check

### 8. UPDATE config spec — mark Phase D complete

- **IMPLEMENT**: Add ✅ Complete marker to Phase D in `.claude/docs/sickbay-config-spec.md`

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
# Add suppress rule to react-app config, scan, verify finding is gone
```

---

## ACCEPTANCE CRITERIA

- [ ] `suppress` field on `RunOptions.checkConfig`
- [ ] `applySuppression()` utility with tests
- [ ] Suppression applied in runner.ts after each runner returns
- [ ] `suppressedCount` tracked in `CheckResult.metadata`
- [ ] Path matching uses picomatch, match is case-insensitive substring
- [ ] AND logic when both path and match provided
- [ ] All existing tests pass
- [ ] Snapshot regression tests pass
- [ ] Full build succeeds
- [ ] VitePress docs updated
- [ ] Config spec marked complete

---

## NOTES

- **Suppression is post-run, not per-runner**: Unlike thresholds and excludes which are wired into runners, suppression filters results centrally in runner.ts. This avoids touching all 34 runners.
- **Score impact**: Suppressed issues are removed before scoring, so suppressing a critical issue WILL improve the check's score. This is intentional — if you've evaluated a finding and decided it's not relevant, it shouldn't count against you.
- **No re-scoring needed**: `calculateOverallScore` receives the final `CheckResult[]` from runner.ts. Since we modify `result.issues` in place before pushing to the `checks` array, the score calculation automatically reflects suppressed results.

Wait — actually, scores are computed inside each runner's `run()` method, not from the issues array. So suppressing issues won't change the score. This is correct behavior per the spec: suppression removes findings from reports, but the check's own score formula (which ran inside the runner) is unchanged. The score reflects "how the tool graded you" while suppression controls "which findings you see."
