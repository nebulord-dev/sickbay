# CI/CD Design — GitHub Actions

**Date**: 2026-02-26
**Status**: Approved

## Overview

Add a GitHub Actions CI pipeline to the sickbay monorepo. No workflows exist today. Goal is to catch lint errors, test failures, and broken builds on every push and PR to `main`.

## Triggers

- `push` to `main`
- `pull_request` targeting `main`

## Environment

- **Node**: 20 LTS (satisfies `engines: { node: ">=18.0.0" }`)
- **pnpm**: `10.30.1` (matches `packageManager` field in root `package.json`)
- **pnpm store**: cached via `actions/setup-node` to keep installs fast

## Jobs

Single workflow file: `.github/workflows/ci.yml`

### Execution order

```
lint ──┐
       ├──▶ build (needs: test)
test ──┘
```

`lint` and `test` run in parallel. `build` runs only after `test` passes — no point building broken code.

### `lint`

- Runs `pnpm turbo run lint`
- Fails if any package has lint errors
- Runs in parallel with `test`

### `test`

- Runs `pnpm -r test:coverage` across all three packages (`@sickbay/core`, `@sickbay/cli`, `@sickbay/web`)
- Uploads per-package coverage reports as artifacts (downloadable from Actions UI)
- No hard coverage threshold gate — report only for now
- Runs in parallel with `lint`

### `build`

- Runs `pnpm turbo run build`
- Turbo handles the `core → cli` dependency order automatically
- `needs: [test]` — only runs after test passes

## Out of Scope (for now)

- Playwright / E2E tests (deferred until UI stabilises)
- Coverage threshold enforcement (revisit when CLI reaches 80%)
- PR score delta comments (future Phase 2 item)
- Publishing / release workflow (separate task)
