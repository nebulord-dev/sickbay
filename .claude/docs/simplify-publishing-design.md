# Simplify Publishing — Design Spec

**Jira:** Derived from KAN-121 discussion (publishing prerequisite)
**Date:** 2026-04-01
**Status:** Approved

## Summary

Replace `multi-semantic-release` with plain `semantic-release`. Publish a single package (`sickbay`) to npm. Stop publishing `@nebulord/sickbay` and `@nebulord/sickbay-core` as separate packages. Delete the wrapper package.

## Context

The current setup publishes three npm packages via `multi-semantic-release`:

| Package                     | npm name                 | Version (npm) | Version (repo) |
| --------------------------- | ------------------------ | ------------- | -------------- |
| `packages/core/`            | `@nebulord/sickbay-core` | 1.3.1         | 1.3.0          |
| `apps/cli/`                 | `@nebulord/sickbay`      | 1.3.2         | 1.3.1          |
| `packages/sickbay-wrapper/` | `sickbay`                | 1.0.1         | 1.0.0          |

(npm versions are slightly ahead because semantic-release bumps and publishes before the git commit lands back.)

This creates version-sync problems: the wrapper's dependency on `@nebulord/sickbay` goes stale because `multi-semantic-release` only bumps packages whose files changed. Since the wrapper is a one-line shim (`bin.mjs`), it never gets bumped.

Nobody is consuming `@nebulord/sickbay-core` or `@nebulord/sickbay` directly. Users run `npx sickbay`. The monorepo structure is good internal architecture — it just doesn't need to be reflected in npm.

## End State

```
npx sickbay          → works (one published package)
npx sickbay --web    → works (web dashboard bundled into CLI dist)
sickbay --version    → shows real version (e.g. 1.1.0)
```

One version. One package. One release per merge to `main`.

## Design

### 1. Rename the CLI package to `sickbay`

**File:** `apps/cli/package.json`

- Change `"name"` from `"@nebulord/sickbay"` to `"sickbay"`
- Remove `publishConfig` (no longer scoped, no access config needed — `sickbay` is already public on npm)
- Keep everything else: `bin`, `exports`, `files`, `type`, `dependencies`

### 2. Mark core as private, stop publishing

**File:** `packages/core/package.json`

- Add `"private": true`
- Remove `"publishConfig"`

**File:** `packages/core/.releaserc.json`

- Delete this file entirely

### 3. Delete the wrapper package

**Directory:** `packages/sickbay-wrapper/`

- Delete the entire directory (`package.json`, `bin.mjs`, `.releaserc.json`, `CHANGELOG.md`)

### 4. Bundle core into the CLI and remove it as a runtime dependency

**Problem:** If `@nebulord/sickbay-core` remains in the CLI's `dependencies` with `workspace:*`, `@semantic-release/npm` (which uses `npm publish`, not `pnpm publish`) would publish the literal string `"workspace:*"` to npm — an invalid dependency specifier. pnpm's publish resolves workspace protocols automatically, but semantic-release does not use pnpm.

**Solution:** Bundle core into the CLI at build time via tsup's `noExternal` option. Core becomes part of the CLI's `dist/` output, not a runtime dependency.

**File:** `apps/cli/tsup.config.ts`

- Add `noExternal: ['@nebulord/sickbay-core']` to the tsup config. This tells tsup to inline core's source code into the CLI bundle instead of leaving it as an external import.

**File:** `apps/cli/package.json`

- Move `"@nebulord/sickbay-core"` from `dependencies` to `devDependencies` with `"workspace:*"`. It's needed at build time (tsup resolves the import) but not at runtime (it's bundled). Since `devDependencies` are not installed by consumers, the `workspace:*` protocol never reaches npm.
- **Add core's runtime dependencies to the CLI's `dependencies`.** When tsup inlines core's source, core's own `import 'execa'`, `import 'knip'`, etc. remain as bare imports in the bundle — they are NOT recursively inlined. These must be declared in the CLI's `dependencies` so npm installs them for consumers. Move from `packages/core/package.json`:
  ```
  "depcheck": "^1.4.7",
  "execa": "^9.6.1",
  "globby": "^16.2.0",
  "jscpd": "^4.0.8",
  "knip": "^6.1.0",
  "license-checker": "^25.0.1",
  "madge": "^8.0.0",
  "source-map-explorer": "^2.5.3"
  ```
- Core's `package.json` can keep these in `dependencies` too (for development/testing), or move them to `devDependencies` since core is now private. Either way, the CLI must list them.

**File:** `apps/web/package.json`

- Change `"@nebulord/sickbay-core": "1.3.0"` to `"@nebulord/sickbay-core": "workspace:*"` (already in devDependencies — type-only import, never published)

**After this change:** Run `pnpm install` to regenerate `pnpm-lock.yaml`. Commit the updated lockfile.

### 5. Replace multi-semantic-release with single semantic-release

**File:** Root `.releaserc.json`

Replace with a configuration that publishes from `apps/cli/`:

```json
{
  "branches": ["main"],
  "tagFormat": "v${version}",
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        "changelogFile": "CHANGELOG.md"
      }
    ],
    [
      "@semantic-release/npm",
      {
        "pkgRoot": "apps/cli"
      }
    ],
    [
      "@semantic-release/git",
      {
        "assets": ["CHANGELOG.md", "apps/cli/package.json"],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ],
    "@semantic-release/github"
  ]
}
```

Key differences from current config:

- `tagFormat: "v${version}"` — clean tags like `v2.0.0` instead of `@nebulord/sickbay@1.3.2`
- `pkgRoot: "apps/cli"` — tells `@semantic-release/npm` to publish from the CLI directory where `package.json` with `"name": "sickbay"` lives
- `assets` includes `apps/cli/package.json` — so the version bump gets committed back

**File:** `apps/cli/.releaserc.json`

- Delete this file (config is now at root only)

**File:** `packages/sickbay-wrapper/.releaserc.json`

- Already deleted with the wrapper directory

### 6. Update the publish workflow

**File:** `.github/workflows/publish.yml`

Change the release command:

```yaml
- name: Release
  run: pnpm exec semantic-release
  env:
    GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Only change is `multi-semantic-release` → `semantic-release`.

### 7. Update root package.json

**File:** `package.json`

- Remove `multi-semantic-release` from `devDependencies` (keep `semantic-release` — it's already listed)
- Remove `@semantic-release/exec` from `devDependencies` (unused — not referenced in any `.releaserc.json`)
- Update `pnpm --filter` scripts that reference `@nebulord/sickbay` to use the new name `sickbay`:
  - `"cli": "pnpm --filter sickbay dev"`
  - `"test:cli": "pnpm --filter sickbay test"`
  - `"test:cli:ui": "pnpm --filter sickbay test:ui"`
- Note: scripts referencing `@nebulord/sickbay-core` and `@nebulord/sickbay-web` stay unchanged — those package names are not changing (they're internal workspace packages)

### 8. Update turbo.json

**File:** `turbo.json`

The CLI-specific build task references the old name:

```json
"@nebulord/sickbay#build": {
  "dependsOn": ["@nebulord/sickbay-web#build", "^build"],
  "outputs": ["dist/**"]
}
```

Update to:

```json
"sickbay#build": {
  "dependsOn": ["@nebulord/sickbay-web#build", "^build"],
  "outputs": ["dist/**"]
}
```

### 9. Fix the hardcoded version in Commander

**File:** `apps/cli/src/index.ts`

Replace `.version('0.0.1')` with the build-time `__VERSION__` constant. The CLI's `tsup.config.ts` already defines this:

```typescript
define: {
  __VERSION__: JSON.stringify(version),  // reads from package.json at build time
}
```

In `index.ts`, declare and use it:

```typescript
declare const __VERSION__: string;

program.name('sickbay').version(__VERSION__);
```

This is already the established pattern in the codebase — no `createRequire` needed, no runtime file reads, and it works correctly with tsup bundling.

### 10. Clean up stale changelogs

Delete per-package changelogs that are no longer maintained:

- `packages/core/CHANGELOG.md` — core is no longer published
- `packages/sickbay-wrapper/CHANGELOG.md` — already deleted with the wrapper directory
- `apps/cli/CHANGELOG.md` — the root `CHANGELOG.md` is now the single source of truth

Keep `apps/web/CHANGELOG.md` and `apps/docs/CHANGELOG.md` if they exist (historical, not harmful).

### 11. Update documentation

**File:** `.claude/docs/semantic-release-workflow.md`

Rewrite the "What Gets Published" table and relevant sections to reflect the single-package setup. Remove references to `multi-semantic-release`, the wrapper, and per-package releases.

**File:** `CLAUDE.md`

If any references to the old package names exist in the publishing/CI sections, update them.

### 12. Deprecate old npm packages

After the first successful publish, manually run:

```bash
npm deprecate @nebulord/sickbay@"*" "Moved to 'sickbay' — run npx sickbay"
npm deprecate @nebulord/sickbay-core@"*" "Internal package — use 'sickbay' instead"
```

This shows a deprecation warning to anyone who tries to install the old names.

### 13. First release versioning

The `sickbay` package on npm is currently at `1.0.1`. Semantic-release determines the next version from the latest git tag matching `tagFormat`. Since existing tags use the old format (`@nebulord/sickbay@1.3.2`) and the new `tagFormat` is `v${version}`, semantic-release will find no matching tags.

**Important:** When semantic-release finds no previous tags, it treats it as a first release and starts at `1.0.0` — even with a `BREAKING CHANGE` footer (breaking changes bump from a _previous_ version; with no previous version, there's nothing to bump from).

**To give semantic-release the correct baseline**, manually create a git tag before the first release:

```bash
git tag v1.3.0   # matches the latest npm version of the sickbay package
git push origin v1.3.0
```

Then a `feat:` commit will bump from `1.3.0` → `1.4.0`:

```
feat: simplify publishing to single sickbay package
```

Note: The wrapper package was silently bumped to `1.3.0` by `multi-semantic-release` even though the repo's `package.json` stayed at `1.0.0` (version bumps were committed back with `[skip ci]`). The baseline tag must match the latest _npm_ version, not the repo version.

## What Doesn't Change

- **Monorepo structure**: `packages/core/`, `apps/cli/`, `apps/web/`, `apps/docs/` stay as-is
- **Build pipeline**: `pnpm build` via Turbo still builds core -> web -> cli in order
- **Internal imports**: `import { runSickbay } from '@nebulord/sickbay-core'` still works (workspace resolution)
- **CI workflow trigger**: still fires on push to `main`
- **Web and docs packages**: already private, unaffected
- **pnpm workspace config**: `pnpm-workspace.yaml` stays the same (minus the wrapper being gone)
- **Test commands**: `pnpm test` still runs all tests across the monorepo

## Risks

- **npm token permissions**: The existing `NPM_TOKEN` must have publish access to the `sickbay` package (not just the `@nebulord` scope). Verify this before merging.
- **Tag format change**: Old tags like `@nebulord/sickbay@1.3.2` won't match the new `v${version}` format. The manually created `v1.0.1` tag gives semantic-release the correct baseline.
- **Lockfile drift after release**: `@semantic-release/npm` bumps `apps/cli/package.json` version, but `pnpm-lock.yaml` still references the old version. This is cosmetic (the lockfile version field is for display, not resolution), but if it causes issues with `--frozen-lockfile` in subsequent CI runs, add `pnpm-lock.yaml` to the `@semantic-release/git` assets list.
