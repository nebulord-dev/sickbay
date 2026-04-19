---
name: audit-architecture
description: Use when auditing Sickbay's monorepo architecture for boundary violations, dependency order problems, bundled-deps drift, cross-package import issues, workspace registration gaps, fixtures/docs isolation, tsconfig drift, or release-workflow invariants. Run before merging large cross-package branches, after adding new packages, or before a major release.
---

# Audit: Monorepo Architecture

Dispatch the `monorepo-architect` agent to review structural integrity across all Sickbay packages and apps. This audit is about the *shape* of the monorepo, not the correctness of any single package.

## Checklist

### 1. Package Boundary Violations

**Critical rule:** `apps/web` must NEVER import values from `sickbay-core`. Only `import type` is allowed — value imports would bundle Node.js modules (execa, fs, etc.) into the browser build.

- Search `apps/web/src/` for any `from 'sickbay-core'` that is NOT `import type`
- Search for any `require('sickbay-core')` in web
- Check `apps/web/src/lib/constants.ts` — constants that needed core values are duplicated here (not imported)

### 2. Dependency Order

The enforced build order is: `packages/core` → `apps/cli` → `apps/web`.

- `packages/core` must not import from `apps/cli`, `apps/web`, or `apps/docs`
- `apps/cli` must not import from `apps/web` or `apps/docs`
- `apps/web` and `apps/docs` must not import from each other
- Check `turbo.json` pipeline — `dependsOn` reflects this order
- Check `pnpm-workspace.yaml` — no circular workspace references

### 3. Bundled-Deps Mirror Invariant

`apps/cli` bundles `sickbay-core` inline via tsdown `deps.alwaysBundle`. Every runtime dep of core must also appear in `apps/cli/package.json` dependencies with matching version ranges.

- Run `pnpm check:bundled-deps` — must pass with zero drift
- Compare `packages/core/package.json` dependencies vs `apps/cli/package.json` dependencies manually
- Check `apps/cli/knip.config.ts` `ignoreDependencies` list matches core's deps exactly
- If a new package is added that also bundles core, update `scripts/check-bundled-deps.mjs` to include it

### 4. Circular Dependencies Within Packages

- Run `pnpm --filter sickbay-core exec madge --circular src/` — must return no cycles
- Run `pnpm --filter sickbay exec madge --circular src/` — same
- Pay attention to `src/integrations/` — runners must not import from each other. Same for `src/advisors/`

### 5. Type Export Discipline

- `packages/core/src/index.ts` — check what's exported. Types should be exported; internal implementation should not leak
- `apps/cli` imports from `sickbay-core` — verify these are workspace imports, not relative path hacks (e.g. `../../packages/core/src/...`)
- Internal utilities (`utils/suppress`, `utils/dep-tree`) should not be in the public export unless explicitly needed by cli

### 6. Documentation Site (`apps/docs`)

VitePress site deployed to `nebulord-dev.github.io/sickbay` via `.github/workflows/docs.yml`. Easy to forget because it's not built by the root `pnpm build`.

- `apps/docs` is in `pnpm-workspace.yaml`
- Excluded from `turbo.json` default build pipeline — docs deploy separately, and bundling it into the root build slows cold builds
- Docs workflow triggers are correct (main-only deploy or PR preview)
- **Content-coupling check:** if a CLI flag, config option, or scoring rule changed in this branch, verify the corresponding `apps/docs/commands/*.md` or `apps/docs/guide/*.md` was updated. The `sync-docs` skill can generate a draft; architecture audit verifies the coupling isn't broken

### 7. Fixtures Workspace Isolation

`fixtures/` is a separate pnpm workspace — by design, so intentionally-broken dependencies don't pollute Sickbay's own dep tree.

- Fixtures has its own `pnpm-lock.yaml` — MUST NOT be merged into root lockfile
- Fixtures MUST NOT be in root `pnpm-workspace.yaml` (it has its own)
- Fixtures MUST NOT be in `turbo.json` pipeline — fixtures should only be scanned by Sickbay, never built as part of the project
- `fixtures/packages/*/.sickbay/` cache directories — intentionally tracked for deterministic snapshot tests; check `.gitignore` handling
- New fixture added → `fixtures/README.md` documents what intentional issues it contains

### 8. Snapshot Tests Workspace (`tests/snapshots/`)

Standalone test directory with its own `tsconfig.json` and `vitest.config.ts`. Runs fixtures through the built CLI and compares JSON output to committed snapshots.

- Must treat fixtures as black-box inputs — no direct imports from `fixtures/`
- Snapshot diffs flag real regressions — never update snapshots to make tests pass without explaining why
- `pnpm test:snapshots` is in CI; this audit verifies the workspace config is still correct

### 9. TypeScript Configuration

- `tsconfig.base.json` is shared. Each package extends it via `{ "extends": "../../tsconfig.base.json" }` (or the right relative path)
- Per-package overrides that silently loosen strictness (`noImplicitAny: false`, `strict: false`, `skipLibCheck` added locally when it's already in base) are suspect — either fix the root cause or document why
- If any package uses TypeScript **project references** (`"references": []`), the whole system must be consistent — partial adoption causes mysterious build-order issues where one package "can't see" another's types

### 10. Release Workflow Invariant

Only `sickbay` (the CLI) publishes to npm via semantic-release. Core and web are private, and this must not change without a plan.

- `packages/core/package.json` must stay `"private": true` — publishing it breaks the bundled-deps invariant (users would install two copies)
- `apps/web/package.json` must stay `"private": true`
- `apps/docs/package.json` must stay `"private": true`
- `.releaserc.json` only bumps `apps/cli/package.json` for version changes
- If a new publishable package is proposed, that's a release-strategy decision, not a routine change

### 11. New Package Registration

If any new package was added since last audit:

- In `pnpm-workspace.yaml`?
- In `turbo.json` with correct `dependsOn`?
- Own `tsconfig.json` extending `tsconfig.base.json`?
- Own `vitest.config.ts` (if tested)?
- `scripts/check-bundled-deps.mjs` updated if the new package bundles core?
- `.releaserc.json` updated if the new package publishes?

### 12. `.sickbay/` Cache Directories

Sickbay writes to `.sickbay/` inside any analyzed project, including its own repo.

- Root `.gitignore` includes `.sickbay/` (so Sickbay's own scans don't pollute git)
- Fixtures' `.sickbay/` caches are currently tracked — intentional for deterministic snapshot tests
- No cache files accidentally committed in CLI/core/web packages

## War Stories

Past architectural bugs that this audit exists to prevent from recurring. Each entry is a real failure mode — treat as worked examples of what goes wrong:

- **Web bundling Node.js modules** — before the `import type`-only rule was enforced, `apps/web` pulled `execa` and `child_process` into the browser bundle via a single value import from core. Vite build succeeded but runtime crashed on `fs is not defined` in production. Fix: `apps/web/src/lib/constants.ts` duplicates values; value imports from core flagged at review.
- **Cross-platform path bugs (silent)** — 19 call sites used `fullPath.replace(projectRoot + '/', '')` for years. Linux CI never caught it. On Windows, the literal `/` didn't match `\`, so paths came out unchanged. Reports for Windows users had absolute paths with usernames for the entire project's history. Fix: `relativeFromRoot()` helper in core, Windows in the test matrix.
- **Bundled-deps drift** — a runtime dep was removed from core without updating `apps/cli/package.json`. The published npm version crashed on first `require()` because the bundled code referenced a package that wasn't installed. Fix: `scripts/check-bundled-deps.mjs` runs in CI.
- **In-house dep graph viz** — an early dashboard version shipped a bespoke dep graph component that was slower and worse than dedicated tools. Replaced with a link to Node Modules Inspector. Lesson: don't reinvent visualization; link out.
- **Fixtures leaking into root build** — at one point fixtures were accidentally registered in the root `pnpm-workspace.yaml`, which pulled their intentionally-broken deps into the root lockfile and caused `pnpm install` to fail on fresh clones. Fix: fixtures isolated as a separate workspace with its own lockfile.

## Key Files

```
turbo.json                        # Pipeline dependency order
pnpm-workspace.yaml               # Workspace registration (no fixtures)
tsconfig.base.json                # Shared compiler settings
packages/core/package.json        # Private, dependency source-of-truth
apps/cli/package.json             # Must mirror core's runtime deps
apps/cli/knip.config.ts           # ignoreDependencies mirror
apps/cli/tsdown.config.ts         # deps.alwaysBundle — the bundling invariant
apps/web/src/lib/constants.ts     # Browser-safe duplicates from core
scripts/check-bundled-deps.mjs    # CI guardrail
.releaserc.json                   # Publishing scope — CLI only
.github/workflows/                # ci.yml, publish.yml, docs.yml
```

## Output Format

Dispatched reviewer should report findings as:

```
[Severity: High|Medium|Low] path/to/file:123 (or <package boundary>)
What's wrong: <one-line description>
Why it matters: <impact on build, release, or runtime>
Suggested fix: <concrete change>
```

## How to Run

Dispatch the `monorepo-architect` agent. Provide it this checklist and the current state of: `turbo.json`, `pnpm-workspace.yaml`, `packages/core/package.json`, `apps/cli/package.json`, `apps/cli/knip.config.ts`, `apps/web/src/lib/constants.ts`, `.releaserc.json`.

First action: run `pnpm check:bundled-deps`. Then walk the checklist, citing war stories when a finding maps to a recurring class of bug.

## Related Audits

- Findings in §1 (boundary violations) → run **audit-web**
- Findings in §3 (bundled-deps drift) → run **audit-cli**
- Findings in §6 (docs coupling) → run `/sync-docs`
