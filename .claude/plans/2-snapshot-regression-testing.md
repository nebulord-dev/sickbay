# Plan: Snapshot Regression Testing Against Fixtures

## Spec

Read the full design spec at `docs/superpowers/specs/2026-03-28-snapshot-regression-testing-design.md` before starting. It contains the complete test structure, normalizer design, vitest config, and file list.

## Kanban Task

Move this task to Done when complete:
```
- `[Testing]` `[Auto]` Snapshot regression testing against fixtures
```

## Steps

### 1. Read the spec and understand the fixture projects

Read the spec thoroughly. Then read:
- `fixtures/README.md` — understand what each fixture contains and what issues are intentional
- `fixtures/packages/react-app/package.json` — the healthy React app
- `fixtures/packages/node-api/package.json` — the intentionally broken Node API
- `packages/core/src/types.ts` — the `SickbayReport`, `CheckResult`, `Issue` interfaces
- `packages/core/src/runner.ts` — how `runSickbay` works
- `vitest.config.ts` (root) — current project configuration

### 2. Create vitest config for snapshot tests

**Create:** `tests/snapshots/vitest.config.ts`

- Node environment
- Include pattern: `*.test.ts`
- Globals enabled
- `testTimeout: 120_000` and `hookTimeout: 120_000` (real tools are slow)

### 3. Create the snapshot test file

**Create:** `tests/snapshots/fixture-regression.test.ts`

Follow the spec's structure exactly:
- Import `runSickbay` and types from `@sickbay/core`
- Use `fileURLToPath(new URL('.', import.meta.url))` for ESM-compatible `__dirname`
- Define `FIXTURES_DIR` pointing to `../../fixtures/packages`
- Implement `normalizeCheck`, `normalizeProjectInfo`, `relativize`, `snapshotCheck`, and `assertUnstableCheck` helpers exactly as described in the spec
- Two `describe` blocks: `react-app` and `node-api`
- `beforeAll` in each runs `runSickbay` once with 120s timeout
- One `it()` per stable check using `snapshotCheck` helper
- Structural assertions for unstable checks (npm-audit, outdated, source-map-explorer, asset-size)
- Overall score range assertion per fixture
- Summary shape assertion per fixture
- `projectInfo` snapshot per fixture

Stable checks to snapshot: knip, depcheck, madge, jscpd, complexity, eslint, coverage, secrets, todo-scanner, heavy-deps, react-perf, node-security, node-input-validation, node-async-errors, license-checker, git, typescript.

Not every check runs on every fixture — `snapshotCheck` handles this by snapshotting `undefined` when a check doesn't fire.

### 4. Add test:snapshots script to root package.json

**Edit:** `package.json` (root)

Add to scripts:
```json
"test:snapshots": "vitest run --config tests/snapshots/vitest.config.ts"
```

Do NOT add the fixtures config to the root `vitest.config.ts` projects array.

### 5. Build core and generate initial snapshots

```bash
pnpm --filter @sickbay/core build
pnpm test:snapshots
```

This will fail on first run because no snapshots exist yet. Then:

```bash
pnpm test:snapshots -- -u
```

This generates the initial `.snap` file. Review it to confirm it looks reasonable — scores in expected ranges, correct checks firing for each fixture type.

### 6. Verify snapshots pass on re-run

```bash
pnpm test:snapshots
```

Should pass cleanly now. Also verify existing tests still pass:

```bash
pnpm test
```

### 7. Dispatch monorepo-architect agent

Run the monorepo-architect agent to review all changes for boundary violations.

### 8. Update kanban and commit

Move the kanban task to Done in `.claude/kanban.md`. Commit all changes including the generated `.snap` file with a descriptive message.
