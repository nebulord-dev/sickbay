# Feature: Branch Diff

> **Roadmap Phase**: Phase 2 — Standalone Polish
> **Blocked by**: nothing

Validate patterns and imports against the codebase before implementing. Pay close attention
to existing type names, util locations, and runner registration patterns.

## Feature Description

`sickbay diff <branch>` compares the health of the current working directory against a target branch. It runs a full scan on the current code, retrieves the target branch's last saved report (via `git show <branch>:.sickbay/last-report.json`), and displays a per-check comparison showing regressions, improvements, and the overall score delta. Different from `sickbay trend` (historical over time) — this is branch-aware and perfect as a pre-push check.

## User Story

As a developer working on a feature branch
I want to compare my branch's health score against main
So that I can catch regressions before merging

## Problem Statement

There's no way to see if a branch introduced health regressions relative to another branch. The trend command shows historical changes over time but doesn't support branch-to-branch comparison. Developers need a pre-push/pre-merge sanity check.

## Solution Statement

Add a `sickbay diff <branch>` subcommand that:

1. Reads the target branch's last report from git (`git show <branch>:.sickbay/last-report.json`)
2. Runs a fresh scan on the current working directory
3. Compares the two reports per-check and overall
4. Renders a terminal table showing score deltas with color-coded arrows

This avoids git checkout/worktree complexity by relying on the auto-save to `.sickbay/last-report.json` that already happens on every scan. The target branch just needs to have been scanned at least once.

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: Low-Medium
**Packages Affected**: cli only
**New npm Dependencies**: none
**Touches `types.ts`**: No

---

## CONTEXT REFERENCES

### Files to Read Before Implementing

- `apps/cli/src/index.ts` — command registration pattern (mirror `trend` or `stats`)
- `apps/cli/src/components/TrendApp.tsx` — closest existing UI pattern (score display, category breakdown, regressions)
- `apps/cli/src/lib/history.ts` — `loadHistory`, `detectRegressions` pattern for reading `.sickbay/` files
- `packages/core/src/types.ts` — `SickbayReport`, `CheckResult` interfaces for the diff logic
- `packages/core/src/scoring.ts` — `getScoreColor` for color thresholds
- `apps/cli/src/lib/resolve-package.ts` — `resolveProject()` for monorepo support

### New Files to Create

- `apps/cli/src/commands/diff.ts` — diff logic (load base report from git, compare reports)
- `apps/cli/src/commands/diff.test.ts` — unit tests
- `apps/cli/src/components/DiffApp.tsx` — Ink component for rendering the diff
- `apps/cli/src/components/DiffApp.test.tsx` — component tests

### Patterns to Follow

**Command module pattern** (from stats.ts, badge.ts):

```typescript
export function loadBaseReport(projectPath: string, branch: string): SickbayReport | null { ... }
export function compareReports(current: SickbayReport, base: SickbayReport): DiffResult { ... }
```

**Ink component pattern** (from TrendApp.tsx):

```typescript
export function DiffApp({ projectPath, branch, jsonOutput }: DiffAppProps) {
  const { exit } = useApp();
  const [result, setResult] = useState<DiffResult | null>(null);
  // ...
}
```

**Git command for reading file from another branch:**

```bash
git show main:.sickbay/last-report.json
```

---

## IMPLEMENTATION PLAN

### Phase 1: Diff Logic Module

Create `apps/cli/src/commands/diff.ts` with pure functions for loading the base report from git and comparing two reports.

### Phase 2: DiffApp Component

Create `apps/cli/src/components/DiffApp.tsx` — runs scan on current branch, loads base from git, renders comparison table.

### Phase 3: CLI Registration

Register `sickbay diff <branch>` in `apps/cli/src/index.ts`.

### Phase 4: Tests

Unit tests for diff logic and component.

---

## STEP-BY-STEP TASKS

### 1. CREATE `apps/cli/src/commands/diff.ts`

- **IMPLEMENT**:
  - `loadBaseReport(projectPath: string, branch: string): SickbayReport | null`
    - Run `git show <branch>:.sickbay/last-report.json` via `execSync` with `cwd: projectPath`
    - Parse JSON, return `SickbayReport` or null if the command fails (branch doesn't exist, file not committed)
    - Catch errors gracefully — return null
  - `CheckDiff` interface:
    ```typescript
    interface CheckDiff {
      id: string;
      name: string;
      category: string;
      currentScore: number;
      baseScore: number;
      delta: number;
      status: 'improved' | 'regressed' | 'unchanged' | 'new' | 'removed';
    }
    ```
  - `DiffResult` interface:
    ```typescript
    interface DiffResult {
      branch: string;
      currentScore: number;
      baseScore: number;
      scoreDelta: number;
      checks: CheckDiff[];
      summary: {
        improved: number;
        regressed: number;
        unchanged: number;
        newChecks: number;
        removedChecks: number;
      };
    }
    ```
  - `compareReports(current: SickbayReport, base: SickbayReport, branch: string): DiffResult`
    - Match checks by `id`
    - Classify each as improved (delta > 0), regressed (delta < 0), unchanged (delta === 0), new (in current but not base), or removed (in base but not current)
    - Calculate overall score delta
    - Sort: regressions first, then improvements, then unchanged
- **IMPORTS**: `{ execSync }` from `child_process`
- **GOTCHA**: `git show` outputs to stdout — use `encoding: 'utf-8'` and `stdio: 'pipe'` to suppress stderr noise
- **VALIDATE**: `pnpm --filter @sickbay/cli build`

### 2. CREATE `apps/cli/src/components/DiffApp.tsx`

- **IMPLEMENT**:
  - Props: `{ projectPath, branch, jsonOutput, verbose, checks? }`
  - Phase 1 (loading): Show spinner "Scanning current branch..."
  - Phase 2 (loading): Show spinner "Loading {branch} baseline..."
  - Phase 3 (results): Render diff table
  - Use `runSickbay` from `@sickbay/core` for current branch scan (dynamic import)
  - Use `loadBaseReport` from `./commands/diff.js` for base
  - If base report is null, show error: "No saved report found on {branch}. Run `sickbay` on that branch first."
  - Render a table:

    ```
    Branch Diff: current vs main

    Overall: 87 → 92 (+5) ↑

    Check              Current  Base  Delta
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ↑ Tests & Coverage    85     72    +13
    ↑ Unused Code         95     90     +5
    ↓ Dependencies        80     85     -5
    = Git Health         100    100      0
    + React Perf          90      —    new
    ```

  - Color: green for improvements, red for regressions, dim for unchanged, cyan for new
  - After table, show summary line: "3 improved, 1 regressed, 8 unchanged"
  - If `jsonOutput`, write `DiffResult` as JSON and exit
  - Save current report to history/last-report as other commands do

- **PATTERN**: Mirror `TrendApp.tsx` structure (useEffect scan, loading/error/results phases)
- **VALIDATE**: `pnpm --filter @sickbay/cli build`

### 3. UPDATE `apps/cli/src/index.ts`

- **IMPLEMENT**: Register `sickbay diff <branch>` command:

  ```typescript
  program
    .command("diff <branch>")
    .description("Compare health score against another branch")
    .option("-p, --path <path>", "project path to analyze", process.cwd())
    .option("-c, --checks <checks>", "comma-separated list of checks to run")
    .option("--json", "output diff as JSON")
    .option("--verbose", "show verbose output")
    .action(async (branch, options) => { ... });
  ```

  - Note: Commander passes positional args before options in `.action()` callback
  - Dynamic import `DiffApp` component, render with Ink
  - Load .env from project path like other commands

- **PATTERN**: Mirror `trend` command registration
- **VALIDATE**: `pnpm --filter @sickbay/cli build`

### 4. CREATE `apps/cli/src/commands/diff.test.ts`

- **IMPLEMENT**:
  - Test `loadBaseReport`: returns parsed report when `git show` succeeds
  - Test `loadBaseReport`: returns null when branch doesn't exist
  - Test `loadBaseReport`: returns null when file not found on branch
  - Test `compareReports`: identifies improved checks (score went up)
  - Test `compareReports`: identifies regressed checks (score went down)
  - Test `compareReports`: identifies unchanged checks (same score)
  - Test `compareReports`: identifies new checks (in current but not base)
  - Test `compareReports`: identifies removed checks (in base but not current)
  - Test `compareReports`: calculates correct overall score delta
  - Test `compareReports`: sorts regressions first, then improvements, then unchanged
- **VALIDATE**: `pnpm --filter @sickbay/cli test`

### 5. CREATE `apps/cli/src/components/DiffApp.test.tsx`

- **IMPLEMENT**:
  - Test: shows spinner during loading
  - Test: shows error when base report not found
  - Test: renders diff table with correct deltas
  - Test: outputs JSON when `--json` flag is set
  - Mock `runSickbay` from `@sickbay/core` and `loadBaseReport` from diff module
- **PATTERN**: Mirror `apps/cli/src/components/TrendApp.test.tsx`
- **VALIDATE**: `pnpm --filter @sickbay/cli test`

---

## VALIDATION COMMANDS

### Level 1: Type checking

```bash
pnpm --filter @sickbay/cli build
```

### Level 2: Unit tests

```bash
pnpm --filter @sickbay/cli test
```

### Level 3: Manual spot checks

```bash
# Run sickbay on main first to create baseline
git stash && node apps/cli/dist/index.js --path . && git stash pop

# Then diff against main
node apps/cli/dist/index.js diff main --path .

# JSON output
node apps/cli/dist/index.js diff main --path . --json
```

---

## ACCEPTANCE CRITERIA

- [ ] `sickbay diff <branch>` runs a scan and compares against the target branch's last report
- [ ] Shows per-check comparison with score deltas
- [ ] Color-coded: green for improvements, red for regressions
- [ ] Shows overall score delta prominently
- [ ] Shows summary line (N improved, N regressed, N unchanged)
- [ ] `--json` outputs `DiffResult` as JSON
- [ ] Helpful error when target branch has no saved report
- [ ] All CLI tests pass
- [ ] Build passes

---

## MONOREPO FUTURE-PROOFING NOTES

- v1 is single-project only (no `--package` flag). Monorepo diff would need per-package comparison, which adds significant UI complexity. Can be added later by comparing `MonorepoReport` objects.
- The `git show` approach works for any branch regardless of monorepo structure since `.sickbay/last-report.json` is per-project-path.

---

## NOTES

- The `git show <branch>:<path>` approach is elegant — no checkout, no worktree, no stash. It reads the file directly from git's object store. The tradeoff is the target branch must have been scanned at least once with the report committed (or at least present in the tree).
- `execSync` is fine here since it's a single fast git command, not a long-running process.
- The diff command deliberately does NOT use `--package` in v1 to keep scope tight. Monorepo diff is a natural follow-up.
- The auto-save to `.sickbay/last-report.json` (already implemented) is what makes this feature possible without expensive cross-branch scans.
