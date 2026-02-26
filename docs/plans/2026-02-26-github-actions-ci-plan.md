# GitHub Actions CI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a GitHub Actions CI workflow that lints, tests, and builds the vitals monorepo on every push and PR to `main`.

**Architecture:** Single workflow file with three jobs — `lint` and `test` run in parallel, `build` runs after `test` passes. Turbo handles monorepo build order (`core → cli`). Coverage reports uploaded as artifacts for inspection.

**Tech Stack:** GitHub Actions, pnpm 10.30.1, Node 20 LTS, Turbo

**Design doc:** `docs/plans/2026-02-26-ci-cd-design.md`

---

### Task 1: Create the workflow directory and file

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create the directory**

```bash
mkdir -p .github/workflows
```

**Step 2: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.30.1

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm turbo run lint

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.30.1

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build core (required before testing cli)
        run: pnpm --filter @vitals/core build

      - name: Test with coverage
        run: pnpm -r test:coverage

      - name: Upload coverage reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-reports
          path: |
            packages/core/coverage/
            packages/cli/coverage/
            packages/web/coverage/
          retention-days: 7

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.30.1

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build all packages
        run: pnpm turbo run build
```

**Step 3: Verify the YAML is valid**

```bash
npx js-yaml .github/workflows/ci.yml
```
Expected: no output (valid YAML)

**Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for lint, test, and build"
```

**Step 5: Push and verify**

```bash
git push origin main
```

Then open `https://github.com/DTeel_r1github/vitals/actions` and confirm all three jobs appear and turn green.

---

## Notes

- The `test` job builds `@vitals/core` before running tests because `@vitals/cli` imports from it. `pnpm -r test:coverage` does not build first.
- `if: always()` on the artifact upload ensures coverage is uploaded even if some tests fail — useful for debugging.
- The `lint` job runs `turbo run lint` which hits all three packages via Turbo's task graph.
- Coverage artifacts are retained for 7 days, visible in the Actions run summary.
