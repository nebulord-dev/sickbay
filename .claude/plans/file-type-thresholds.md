# Feature: Project-Type-Aware File Length Thresholds

> **Jira**: KAN-125
> **Roadmap Phase**: Phase 2 — Standalone Polish
> **Blocked by**: Nothing

Validate patterns and imports against the codebase before implementing. Pay close attention
to existing type names, util locations, and runner registration patterns.

## Feature Description

Replace the hardcoded `WARN_LINES = 400` / `CRITICAL_LINES = 600` constants with per-file-type thresholds based on filename pattern matching. A 150-line React hook should trigger a warning long before a 500-line utility module does. The complexity runner and react-perf runner both use these constants today — both need updating.

## User Story

As a developer running Sickbay on my project
I want file length warnings tailored to the type of file (component, hook, service, utility)
So that the warnings are actionable and calibrated to real-world expectations for each file type

## Problem Statement

Today every file is judged against the same 400/600 line thresholds regardless of what it is. A 350-line React hook is fine by Sickbay but would be considered bloated by most teams, while a 450-line utility module with pure functions gets flagged even though it may be perfectly reasonable.

## Solution Statement

Add a file-type classifier function that maps filename patterns to a `FileType`, and a thresholds map that provides warn/critical line counts per type. The complexity runner uses the classifier to pick the right thresholds per file. The issue message names the detected file type so the user understands *why* the threshold is what it is. The react-perf runner switches from `WARN_LINES` to the component-specific threshold.

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Low–Medium
**Packages Affected**: `core` only (no CLI/web changes — the issue messages flow through unchanged)
**New npm Dependencies**: None
**Touches `types.ts`**: No

---

## CONTEXT REFERENCES

### Files to Read Before Implementing

- `packages/core/src/constants.ts` — current `WARN_LINES` and `CRITICAL_LINES` definitions
- `packages/core/src/integrations/complexity.ts` — the main runner to modify; uses `WARN_LINES` and `CRITICAL_LINES`
- `packages/core/src/integrations/complexity.test.ts` — existing test patterns to extend
- `packages/core/src/integrations/react-perf.ts` (line 163) — also uses `WARN_LINES` for large component check
- `packages/core/src/utils/file-helpers.ts` (line 41) — re-exports `WARN_LINES`
- `packages/core/src/index.ts` (lines 31–32) — exports `WARN_LINES` and `CRITICAL_LINES` publicly
- `apps/web/src/lib/constants.ts` — duplicated constants for browser bundle (keep in sync)

### New Files to Create

- `packages/core/src/utils/file-types.ts` — file-type classifier + thresholds map
- `packages/core/src/utils/file-types.test.ts` — tests for the classifier

### Patterns to Follow

**Utility module structure** (mirror `file-helpers.ts`):
```typescript
// Pure functions, exported individually, no classes
export function classifyFile(filename: string): FileType { ... }
export function getThresholds(fileType: FileType): { warn: number; critical: number } { ... }
```

**Test patterns** (mirror `complexity.test.ts`):
- Vitest with `describe`/`it`/`expect`
- Colocated with source file
- Test each file type classification and edge cases

---

## IMPLEMENTATION PLAN

### Phase 1: File-Type Classifier and Thresholds Map

Create `packages/core/src/utils/file-types.ts` with:

1. A `FileType` union type:
   ```typescript
   export type FileType =
     | 'react-component'
     | 'custom-hook'
     | 'node-service'
     | 'route-file'
     | 'ts-utility'
     | 'ts-class'
     | 'config'
     | 'test'
     | 'general';
   ```

2. A `classifyFile(filePath: string): FileType` function using filename conventions:
   - `*.test.*` / `*.spec.*` → `test`
   - `*.config.*` / `*.rc.*` / config filenames → `config`
   - `use*.ts` / `use*.tsx` (PascalCase after `use`) → `custom-hook`
   - `*.component.ts` (Angular) → `react-component` (reuse same thresholds)
   - `*.tsx` / `*.jsx` → `react-component`
   - `*route*` / `*router*` / `page.tsx` / `layout.tsx` → `route-file`
   - `*.service.ts` / `*.controller.ts` / `*middleware*` / `*handler*` → `node-service`
   - Everything else `.ts`/`.js` → `ts-utility` (most permissive non-exempt type)

   **Classification order matters** — test and config must be checked first since they can match other patterns (e.g. `useAuth.test.tsx` is a test, not a hook).

3. A thresholds map:
   ```typescript
   export const FILE_TYPE_THRESHOLDS: Record<FileType, { warn: number; critical: number }> = {
     'react-component': { warn: 300, critical: 500 },
     'custom-hook':     { warn: 150, critical: 250 },
     'node-service':    { warn: 500, critical: 800 },
     'route-file':      { warn: 250, critical: 400 },
     'ts-utility':      { warn: 600, critical: 1000 },
     'ts-class':        { warn: 300, critical: 500 },
     'config':          { warn: Infinity, critical: Infinity },  // exempt
     'test':            { warn: Infinity, critical: Infinity },  // exempt
     'general':         { warn: 400, critical: 600 },  // fallback = today's behavior
   };
   ```

4. A convenience function:
   ```typescript
   export function getThresholds(filePath: string): { warn: number; critical: number; fileType: FileType } {
     const fileType = classifyFile(filePath);
     return { ...FILE_TYPE_THRESHOLDS[fileType], fileType };
   }
   ```

**Design note on `ts-class`**: Detecting classes purely from filename is unreliable. Options:
- **Option A**: Skip `ts-class` — fold it into `ts-utility` or `general`. Detect classes only if we read file content (expensive).
- **Option B**: Match `*.class.ts` convention (rare in practice).
- **Recommendation**: Go with **Option A** — drop `ts-class` as a separate type. If a file contains a class but is named `auth-manager.ts`, it's a `ts-utility` by filename. The thresholds for `ts-utility` (600/1000) are generous enough. We can always add content-based classification later.

### Phase 2: Update the Complexity Runner

Modify `packages/core/src/integrations/complexity.ts`:

1. Replace imports of `WARN_LINES` and `CRITICAL_LINES` with `getThresholds` from the new module.

2. In the `run()` method, change the filtering and issue creation:
   - Instead of `files.filter(f => f.lines >= WARN_LINES)`, call `getThresholds(f.path)` per file and compare against that file's specific thresholds.
   - Update the issue message to include the detected file type:
     `"src/hooks/useAuth.ts (custom hook): 180 lines — consider splitting (threshold: 150)"`
   - Update severity: use the file-specific `critical` threshold instead of `CRITICAL_LINES`.

3. Test/config files are already skipped by `isTestFile()` and directory exclusions. The `Infinity` thresholds are a safety net, not the primary filter.

4. Keep `metadata.oversizedCount` working — it should still count files exceeding their respective thresholds.

### Phase 3: Update the React-Perf Runner

Modify `packages/core/src/integrations/react-perf.ts`:

1. Replace the `WARN_LINES` import with `getThresholds`.
2. Line 163: change `if (lineCount > WARN_LINES)` to use the threshold from `getThresholds(relPath)`. Since react-perf only scans `.tsx`/`.jsx` files, this will always resolve to `react-component` thresholds (300 warn).
3. Update the finding message to include the threshold value for clarity.

### Phase 4: Clean Up Constants

1. **Keep `WARN_LINES` and `CRITICAL_LINES` in `constants.ts`** — they're exported publicly and used by the web package. Removing them is a breaking change. Instead, treat them as the `general` fallback values.
2. **No changes needed** to `file-helpers.ts`, `index.ts`, or `apps/web/src/lib/constants.ts` — the public constants remain as-is for backward compatibility. They now represent the `general` file type fallback.

### Phase 5: Tests

**New test file**: `packages/core/src/utils/file-types.test.ts`

Test the classifier:
- `Button.tsx` → `react-component`
- `useAuth.ts` → `custom-hook`
- `useAuth.test.ts` → `test` (not hook — order matters)
- `api.service.ts` → `node-service`
- `routes/users.ts` → `route-file`
- `page.tsx` → `route-file` (not component — Next.js convention)
- `layout.tsx` → `route-file`
- `helpers.ts` → `ts-utility`
- `vite.config.ts` → `config`
- `.eslintrc.js` → `config`
- `utils/format.js` → `ts-utility`

Test `getThresholds`:
- Returns correct warn/critical per type
- Config and test files return `Infinity`

**Update existing test file**: `packages/core/src/integrations/complexity.test.ts`

- Update the mocked `WARN_LINES` mock to instead mock `file-types.js`
- Add tests for:
  - A hook file at 180 lines triggers warning (above hook threshold 150, below old threshold 400)
  - A utility file at 450 lines does NOT trigger warning (below utility threshold 600)
  - A component file at 350 lines triggers warning (above component threshold 300)
  - Issue message includes file type name
  - Issue message includes threshold value
  - Mixed file types in one scan — each judged by its own threshold

**Update existing test file**: `packages/core/src/integrations/react-perf.test.ts`

- Update to reflect new threshold (300 instead of 400 for components)

---

## STEP-BY-STEP TASKS

### CREATE `packages/core/src/utils/file-types.ts`

- **IMPLEMENT**: `FileType` type, `classifyFile()`, `FILE_TYPE_THRESHOLDS`, `getThresholds()`
- **PATTERN**: Pure utility module like `file-helpers.ts`
- **IMPORTS**: Only `path` (for `extname`, `basename`)
- **GOTCHA**: Classification order — test/config patterns must be checked before hook/component patterns. A file like `useAuth.test.tsx` must classify as `test`, not `custom-hook`.
- **GOTCHA**: `page.tsx` and `layout.tsx` are Next.js route files, not generic components.
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core build`

### CREATE `packages/core/src/utils/file-types.test.ts`

- **IMPLEMENT**: Classification tests for every `FileType`, edge cases, threshold lookup
- **PATTERN**: Mirror `packages/core/src/utils/file-helpers.test.ts` and `detect-project.test.ts` style
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test`

### UPDATE `packages/core/src/integrations/complexity.ts`

- **IMPLEMENT**: Replace `WARN_LINES`/`CRITICAL_LINES` with `getThresholds()` per file; update issue messages to name file type and threshold
- **IMPORTS**: Remove `CRITICAL_LINES` from `../constants.js`, remove `WARN_LINES` from `../utils/file-helpers.js`; add `getThresholds` from `../utils/file-types.js`
- **GOTCHA**: Scoring formula `100 - oversized.length * 10` stays the same — only the definition of "oversized" changes per file
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test`

### UPDATE `packages/core/src/integrations/complexity.test.ts`

- **IMPLEMENT**: Mock `../utils/file-types.js` instead of `../utils/file-helpers.js` for thresholds; add file-type-specific threshold tests; update existing assertions for new message format
- **GOTCHA**: The test that checks "400 lines" message text will need updating for the new message format
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test`

### UPDATE `packages/core/src/integrations/react-perf.ts`

- **IMPLEMENT**: Replace `WARN_LINES` import with `getThresholds`; line 163 uses component-specific threshold
- **IMPORTS**: Remove `WARN_LINES` from `../utils/file-helpers.js`; add `getThresholds` from `../utils/file-types.js`
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test`

### UPDATE `packages/core/src/integrations/react-perf.test.ts`

- **IMPLEMENT**: Update mock to reflect new threshold source; adjust any assertions checking the 400-line threshold
- **VALIDATE**: `pnpm --filter @nebulord/sickbay-core test`

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

The snapshot tests run against fixtures (react-app, node-api, next-app, angular-app). The complexity check results will change because thresholds are now file-type-specific. **Snapshots will need updating** — review the diffs to confirm the new thresholds produce sensible results on fixture files.

### Level 4: Full build

```bash
pnpm build
pnpm --filter sickbay build
```

### Level 5: Manual spot check

```bash
node apps/cli/dist/index.js --path fixtures/packages/react-app
node apps/cli/dist/index.js --path fixtures/packages/node-api
node apps/cli/dist/index.js --path fixtures/packages/next-app
```

Verify:
- Issue messages now name the file type (e.g. "custom hook", "React component")
- Hook files with 150+ lines trigger warnings
- Utility files under 600 lines do NOT trigger warnings
- Config and test files are exempt

---

## ACCEPTANCE CRITERIA

- [ ] `classifyFile()` correctly classifies all proposed file types
- [ ] Classification order prevents misclassification (test before hook, config before utility)
- [ ] Complexity runner uses per-file thresholds instead of global constants
- [ ] Issue messages name the detected file type and threshold
- [ ] React-perf runner uses component-specific threshold (300) instead of global 400
- [ ] `WARN_LINES` and `CRITICAL_LINES` constants remain exported (backward compat)
- [ ] All existing tests updated and passing
- [ ] New classifier tests cover every FileType + edge cases
- [ ] Snapshot regression tests reviewed and updated
- [ ] `pnpm build` succeeds across all packages

---

## MONOREPO FUTURE-PROOFING NOTES

No monorepo concerns. File-type classification is per-file and path-based — works identically whether scanning a single project or a monorepo package. The thresholds map is stateless.

---

## NOTES

**Dropping `ts-class`**: The ticket proposes a `ts-class` type (300/500), but class detection from filename alone is unreliable. Folded into `ts-utility` (600/1000). Can revisit with content-based detection later if there's demand.

**`page.tsx` / `layout.tsx` as route files**: These are Next.js conventions. Classifying them as route files (250/400) rather than components (300/500) makes sense because they're thin wiring — a 400-line `page.tsx` usually means logic that should be extracted into components.

**Backward compatibility**: `WARN_LINES` and `CRITICAL_LINES` remain exported from core and duplicated in web. They now represent the `general` file type fallback. No breaking changes.

**Scoring impact**: Files that were previously under the 400-line threshold may now trigger warnings (e.g. a 200-line hook), while files that were over 400 may no longer trigger (e.g. a 500-line utility). Net effect: more precise, fewer false positives on large utility files, more true positives on bloated hooks/components.

## MONOREPO ARCHITECT REVIEW

Run the `monorepo-architect` agent as the final step before committing to verify no package boundary violations were introduced.
