# Snapshot Regression Testing Against Fixtures

## Goal

Catch unintended regressions in check output when runners are modified. Running `sickbay` against real fixture projects and snapshotting the results provides end-to-end coverage that mocked unit tests can't.

## Problem

The codebase has 97% unit test coverage on core, but all runner tests mock tool outputs. There is no test that verifies the full pipeline — detection → runner filtering → execution → scoring → report output — against real projects. A runner could pass all unit tests but produce wrong results on a real codebase.

## Approach

Vitest snapshot tests using built-in `toMatchSnapshot()`, running real tools against the existing fixture projects (`react-app` and `node-api`). Snapshots commit to git and show up in PR diffs for review.

## Test Location

**`tests/snapshots/fixture-regression.test.ts`** at the root workspace level, with its own vitest config at `tests/snapshots/vitest.config.ts`.

Why root level and not inside `fixtures/`: The fixtures directory is a **separate pnpm workspace** (`fixtures/pnpm-workspace.yaml`) intentionally isolated from the main Turbo workspace. It cannot resolve `@sickbay/core` via `workspace:*`. Placing the test at the root level gives it access to `@sickbay/core` as a normal workspace dependency while still pointing at the fixture directories by filesystem path.

These are slow integration tests (real tools, real projects, 60-120s per fixture) and should **not** run as part of the default `pnpm test`. They run separately via a dedicated script.

## Test Structure

### Per-fixture describe blocks

```typescript
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { runSickbay } from '@sickbay/core';
import type { SickbayReport, CheckResult } from '@sickbay/core';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../fixtures/packages');

describe('react-app', () => {
  let report: SickbayReport;

  beforeAll(async () => {
    report = await runSickbay({ projectPath: resolve(FIXTURES_DIR, 'react-app') });
  }, 120_000);

  // Project detection
  it('projectInfo', () => {
    expect(normalizeProjectInfo(report.projectInfo)).toMatchSnapshot();
  });

  // Stable checks — one test per check, full snapshot
  it('knip', () => snapshotCheck(report, 'knip'));
  it('eslint', () => snapshotCheck(report, 'eslint'));
  it('madge', () => snapshotCheck(report, 'madge'));
  // ... one it() per stable check

  // Unstable checks — structural assertions only
  it('npm-audit has valid structure', () => {
    assertUnstableCheck(report, 'npm-audit', 'security');
  });

  // Overall report — range assertion, not exact
  it('overall score is in expected range', () => {
    expect(report.overallScore).toBeGreaterThanOrEqual(40);
    expect(report.overallScore).toBeLessThanOrEqual(95);
  });

  it('summary shape', () => {
    expect(report.summary).toMatchObject({
      critical: expect.any(Number),
      warnings: expect.any(Number),
      info: expect.any(Number),
    });
  });
});

describe('node-api', () => {
  // Same structure — lower expected score range, different checks fire
  // Expected overall score range: 20-50
});
```

### Helper functions

```typescript
function snapshotCheck(report: SickbayReport, id: string) {
  const check = report.checks.find(c => c.id === id);
  if (!check) {
    // Check didn't run for this project type — snapshot that fact
    expect(check).toBeUndefined();
    return;
  }
  expect(normalizeCheck(check)).toMatchSnapshot();
}

function assertUnstableCheck(report: SickbayReport, id: string, expectedCategory: string) {
  const check = report.checks.find(c => c.id === id);
  if (!check) return; // may not run on all fixtures
  expect(check).toMatchObject({
    id,
    category: expectedCategory,
    score: expect.any(Number),
    status: expect.stringMatching(/^(pass|warning|fail|skipped)$/),
  });
  expect(check.score).toBeGreaterThanOrEqual(0);
  expect(check.score).toBeLessThanOrEqual(100);
}

function normalizeCheck(check: CheckResult): Record<string, unknown> {
  return {
    id: check.id,
    category: check.category,
    name: check.name,
    score: check.score,
    status: check.status,
    issues: check.issues.map(issue => ({
      severity: issue.severity,
      message: issue.message,
      file: issue.file ? relativize(issue.file) : undefined,
      fix: issue.fix ? {
        description: issue.fix.description,
        command: issue.fix.command,
        // strip codeChange — too verbose for snapshots
      } : undefined,
      reportedBy: issue.reportedBy,
    })),
    toolsUsed: check.toolsUsed,
    // duration: stripped (varies by machine)
    // metadata: stripped (may contain absolute paths, timestamps, or machine-specific data)
  };
}

function normalizeProjectInfo(info: Record<string, unknown>): Record<string, unknown> {
  // Strip fields that change when fixture deps are updated
  const { dependencies, devDependencies, totalDependencies, ...stable } = info as any;
  return stable;
}

function relativize(filePath: string): string {
  // Use path.relative from the fixtures dir for precision
  const rel = path.relative(FIXTURES_DIR, filePath);
  return rel.startsWith('.') ? rel : rel;
}
```

### Check classification

**Stable checks (full snapshot):** knip, depcheck, madge, jscpd, complexity, eslint, coverage, secrets, todo-scanner, heavy-deps, react-perf, node-security, node-input-validation, node-async-errors, license-checker, git, typescript

**Unstable checks (structural assertion only):** npm-audit (CVE database changes), outdated (new versions publish), source-map-explorer (depends on build output), asset-size (depends on build output)

Not every check runs on every fixture. The `snapshotCheck` helper handles checks that don't fire on a given project type by snapshotting `undefined`.

## Vitest Configuration

### `tests/snapshots/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['*.test.ts'],
    globals: true,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
```

### Root vitest config — NO changes

The fixtures snapshot tests are **not** added to the root `vitest.config.ts` projects array. They are slow integration tests and should not run as part of the default `pnpm test`. Instead, a separate script runs them explicitly.

### Root `package.json` — add script

```json
{
  "scripts": {
    "test:snapshots": "vitest run --config tests/snapshots/vitest.config.ts"
  }
}
```

This keeps `pnpm test` fast (unit tests only) while `pnpm test:snapshots` runs the slow fixture tests on demand or in CI.

## CI Integration

In CI, run both:
```bash
pnpm test              # fast unit tests
pnpm test:snapshots    # slow fixture regression tests
```

These can run in parallel as separate CI jobs. The snapshot files (`.snap`) commit to git alongside the test file.

## Workflow for Intentional Changes

1. Modify a runner (e.g. change scoring logic in `knip.ts`)
2. Run `pnpm test:snapshots` — snapshot test fails showing the diff
3. Review the diff — is the change intentional?
4. If yes: run `pnpm test:snapshots -- -u` to update snapshots
5. Commit the updated `.snap` file — it shows up in the PR diff for reviewer visibility
6. If no: the test caught an unintended regression — fix the runner

## Files to Create

### `tests/snapshots/vitest.config.ts`
- Vitest config for the fixture integration tests (node environment, 120s timeouts)

### `tests/snapshots/fixture-regression.test.ts`
- Import `runSickbay` and types from `@sickbay/core`
- Use `fileURLToPath(new URL('.', import.meta.url))` for `__dirname` (ESM compatible)
- Two describe blocks: `react-app` and `node-api`
- `beforeAll` in each runs the full scan once, shares the report across tests
- Per-check snapshot tests for stable checks via `snapshotCheck` helper
- Structural assertions for unstable checks via `assertUnstableCheck` helper
- `normalizeCheck`, `normalizeProjectInfo`, and `relativize` helper functions
- Explicitly construct normalized objects (don't spread-and-delete) to avoid capturing unexpected volatile fields

## Files to Modify

### `package.json` (root)
- Add `"test:snapshots": "vitest run --config tests/snapshots/vitest.config.ts"` to scripts

## Files Generated on First Run

### `tests/snapshots/__snapshots__/fixture-regression.test.ts.snap`
- Auto-generated by Vitest on first run
- Committed to git as the source of truth
- Updated via `pnpm test:snapshots -- -u` when intentional changes are made

## Expected Score Ranges

Approximate expectations for review when generating initial snapshots:

| Fixture | Expected Overall Score | Key Characteristics |
|---------|----------------------|---------------------|
| `react-app` | 60–85 | Mostly healthy, warnings on heavy deps and outdated packages |
| `node-api` | 20–50 | Intentionally broken — failures across most categories |

## Notes

- `RunnerOptions` is not exported from `@sickbay/core`'s public API — pass a plain object literal to `runSickbay()`, do not attempt to import the type
- `reportedBy` on issues contains tool names (not versions), so it is stable across environments
- The `metadata` field on `CheckResult` is deliberately excluded from snapshots — it may contain absolute paths, tool-specific data structures, or machine-dependent values that would cause false failures
- The `dependencies`/`devDependencies`/`totalDependencies` fields on `projectInfo` are excluded from snapshots — they change when fixture `package.json` files are modified
- Ensure `@sickbay/core` is built before running snapshot tests (`pnpm build --filter @sickbay/core`). The test imports from the published package, which resolves to `dist/`
