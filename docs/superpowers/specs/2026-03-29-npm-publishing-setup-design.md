# npm Publishing Setup — Design Spec

**Date**: 2026-03-29
**Status**: Draft

## Goal

Publish Sickbay to npm under the `@nebulord` scope so users can install via `npx sickbay` or `npm install -g sickbay`.

## Package Map

| Current name | New npm name | Version | Published? |
|---|---|---|---|
| `@sickbay/core` | `@nebulord/sickbay-core` | `0.1.0` | Yes |
| `@sickbay/cli` | `@nebulord/sickbay` | `0.1.0` | Yes |
| `@sickbay/web` | `@nebulord/sickbay-web` | `0.1.0` | No (`"private": true`) |
| `@sickbay/constants` | *(deleted)* | — | No (folded into core) |
| *(new)* | `sickbay` | `0.1.0` | Yes |

## Changes

### 1. Fold constants into core

`packages/constants/src/index.ts` contains 6 constants (score/complexity thresholds). These move to `packages/core/src/constants.ts`.

**Files to update:**

Source files importing `@sickbay/constants`:
- `packages/core/src/scoring.ts` — change to relative import `./constants.js`
- `packages/core/src/integrations/complexity.ts` — change to relative import `../constants.js`
- `packages/core/src/utils/file-helpers.ts` — change to relative import `../constants.js`
- `apps/web/src/components/Dashboard.tsx` — change to `import { ... } from "@nebulord/sickbay-core"`
- `apps/web/src/components/ScoreCard.tsx` — change to `import { ... } from "@nebulord/sickbay-core"`
- `apps/web/src/components/HistoryChart.tsx` — change to `import { ... } from "@nebulord/sickbay-core"`
- `apps/web/src/components/CodebaseStats.tsx` — change to `import { ... } from "@nebulord/sickbay-core"`
- `apps/web/src/components/About.tsx` — change to `import { ... } from "@nebulord/sickbay-core"`
- `apps/web/src/components/MonorepoOverview.tsx` — change to `import { ... } from "@nebulord/sickbay-core"`

Test files importing `@sickbay/constants`:
- `packages/core/src/integrations/complexity.test.ts` — change to relative import
- `packages/core/src/integrations/heavy-deps.test.ts` — change to relative import
- `packages/core/src/integrations/react-perf.test.ts` — change to relative import
- `packages/core/src/integrations/secrets.test.ts` — change to relative import
- `packages/core/src/integrations/todo-scanner.test.ts` — change to relative import

Other changes:
- Create `packages/core/src/constants.ts` with the constants
- Update `packages/core/src/index.ts` to re-export them
- Remove `@sickbay/constants` from `dependencies` in `packages/core/package.json` and `apps/web/package.json`
- Remove `noExternal: ['@sickbay/constants']` from `packages/core/tsup.config.ts`
- Delete `packages/constants/` directory

**Important**: The web package currently imports these constants as value imports from `@sickbay/constants`. After the fold, they'll come from `@nebulord/sickbay-core`. These are simple number constants, not Node.js APIs, so value imports are safe — they'll be tree-shaken by Vite. However, verify that `@nebulord/sickbay-core` doesn't pull in Node.js modules transitively through these re-exports. If it does, the constants should be duplicated in a shared file or the web imports should use `import type` with hardcoded values.

### 2. Rename packages

Update `name` field in each `package.json`:

| File | Old name | New name |
|---|---|---|
| `packages/core/package.json` | `@sickbay/core` | `@nebulord/sickbay-core` |
| `apps/cli/package.json` | `@sickbay/cli` | `@nebulord/sickbay` |
| `apps/web/package.json` | `@sickbay/web` | `@nebulord/sickbay-web` |

Update internal dependency references:

| File | Old reference | New reference |
|---|---|---|
| `apps/cli/package.json` | `"@sickbay/core": "workspace:*"` | `"@nebulord/sickbay-core": "workspace:*"` |
| `apps/web/package.json` | `"@sickbay/core": "workspace:*"` | `"@nebulord/sickbay-core": "workspace:*"` |
| `apps/web/package.json` | `"@sickbay/constants": "workspace:*"` | *(removed — folded into core)* |
| `packages/core/package.json` | `"@sickbay/constants": "workspace:*"` | *(removed — folded into core)* |

Update all source code imports:
- `from "@sickbay/core"` → `from "@nebulord/sickbay-core"` (in CLI source files)
- `from "@sickbay/core"` → `from "@nebulord/sickbay-core"` (in web source files — value imports for constants, `import type` for types)
- `from "@sickbay/constants"` → relative imports (core) or from `@nebulord/sickbay-core` (web) — see step 1

Update root `package.json` scripts (9 filter commands):
- `"cli": "pnpm --filter @sickbay/cli dev"` → `"cli": "pnpm --filter @nebulord/sickbay dev"`
- `"web": "pnpm --filter @sickbay/web dev"` → `"web": "pnpm --filter @nebulord/sickbay-web dev"`
- `"test:web": "pnpm --filter @sickbay/web test"` → `"test:web": "pnpm --filter @nebulord/sickbay-web test"`
- `"test:web:ui": "pnpm --filter @sickbay/web test:ui"` → `"test:web:ui": "pnpm --filter @nebulord/sickbay-web test:ui"`
- `"test:cli": "pnpm --filter @sickbay/cli test"` → `"test:cli": "pnpm --filter @nebulord/sickbay test"`
- `"test:cli:ui": "pnpm --filter @sickbay/cli test:ui"` → `"test:cli:ui": "pnpm --filter @nebulord/sickbay test:ui"`
- `"test:core": "pnpm --filter @sickbay/core"` → `"test:core": "pnpm --filter @nebulord/sickbay-core"`
- `"test:core:ui": "pnpm --filter @sickbay/core test:ui"` → `"test:core:ui": "pnpm --filter @nebulord/sickbay-core test:ui"`

Remove the stale `"workspaces"` field from root `package.json` — pnpm uses `pnpm-workspace.yaml` exclusively; the npm-style `"workspaces"` field only lists `packages/*` (missing `apps/*`) and causes confusion.

Update other configs:
- `turbo.json` — check for package name references
- `knip.json` — check for package name references
- `pnpm-workspace.yaml` — no change needed (uses globs)
- `vitest.config.ts` / `tsconfig` files — check for package name references
- `README.md`, `CONTRIBUTING.md`, `CLAUDE.md` — update all `@sickbay/*` references
- `docs/scoring.md` — references `@sickbay/constants`
- Snapshot test files — may reference package names in report output

### 3. Version bump

All packages from `0.0.1` → `0.1.0`:
- `packages/core/package.json`
- `apps/cli/package.json`
- `apps/web/package.json`
- Root `package.json` (monorepo root, stays `"private": true`)

### 4. Add publishConfig

Add to `packages/core/package.json` and `apps/cli/package.json`:

```json
"publishConfig": {
  "access": "public"
}
```

This is required because scoped packages (`@nebulord/*`) default to private on npm.

### 5. Create wrapper package

New directory: `packages/sickbay-wrapper/`

**`packages/sickbay-wrapper/package.json`:**
```json
{
  "name": "sickbay",
  "version": "0.1.0",
  "description": "Zero-config health check CLI for JavaScript and TypeScript projects",
  "bin": {
    "sickbay": "./bin.js"
  },
  "files": ["bin.js"],
  "dependencies": {
    "@nebulord/sickbay": "0.1.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/nebulord-dev/sickbay"
  }
}
```

**`packages/sickbay-wrapper/bin.js`:**
```js
#!/usr/bin/env node
import("@nebulord/sickbay");
```

Note: The wrapper uses dynamic `import()` (not `require()`) because the CLI is ESM-only (`"type": "module"`, tsup `format: ["esm"]`). `require()` would fail with `ERR_REQUIRE_ESM`. The wrapper omits `"type": "module"` so `bin.js` runs as CJS with a dynamic import, which works in Node 18+.

**Workspace exclusion**: The wrapper must be excluded from `pnpm-workspace.yaml` to prevent pnpm from linking `@nebulord/sickbay` as a workspace dependency. The wrapper depends on the *published registry version*, not the local workspace copy. Add `!packages/sickbay-wrapper` to the workspace globs.

### 6. Mark web as private

Add `"private": true` to `apps/web/package.json` to prevent accidental publishing.

### 7. Add repository, license, and description metadata

Add to `packages/core/package.json`:

```json
"description": "Analysis engine for the Sickbay health check CLI",
"license": "MIT",
"repository": {
  "type": "git",
  "url": "https://github.com/nebulord-dev/sickbay"
}
```

Add to `apps/cli/package.json`:

```json
"description": "Zero-config health check CLI for JavaScript and TypeScript projects",
"license": "MIT",
"repository": {
  "type": "git",
  "url": "https://github.com/nebulord-dev/sickbay"
},
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
  }
}
```

The `exports` field is added to the CLI so the wrapper's `import("@nebulord/sickbay/dist/index.js")` resolves correctly and won't break if exports are tightened later.

### 8. Verify core tsup generates declaration files

`packages/core/tsup.config.ts` already has `dts: true` — confirmed. Consumers of `@nebulord/sickbay-core` will get TypeScript declarations.

## Publish Order

Packages must be published in dependency order:

1. `@nebulord/sickbay-core` — no npm dependencies on other sickbay packages
2. `@nebulord/sickbay` — depends on `@nebulord/sickbay-core`
3. `sickbay` — depends on `@nebulord/sickbay`

Commands:
```bash
pnpm build
pnpm --filter @nebulord/sickbay-core publish --no-git-checks
pnpm --filter @nebulord/sickbay publish --no-git-checks
cd packages/sickbay-wrapper && npm publish
```

The `--no-git-checks` flag is needed because pnpm publish normally requires a clean git tree and matching git tag. We skip this for the initial publish. Future publishes should use proper versioning (changesets or manual tagging).

The wrapper uses `npm publish` (not pnpm) because it's excluded from the workspace — it depends on the published registry version of `@nebulord/sickbay`, not a workspace link.

## What pnpm publish does with workspace:* references

When you run `pnpm publish`, it automatically converts `"workspace:*"` references to the actual version number of the referenced package. So `"@nebulord/sickbay-core": "workspace:*"` becomes `"@nebulord/sickbay-core": "0.1.0"` in the published tarball. No manual intervention needed.

## Out of Scope

- Changesets / automated version management (future improvement)
- CI/CD publish pipeline (future improvement)
- GitHub release tags (can be added later)
- npm provenance / attestation (nice-to-have, not required for initial publish)
