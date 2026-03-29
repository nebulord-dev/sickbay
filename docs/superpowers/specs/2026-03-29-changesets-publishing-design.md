# Automated npm Publishing with Changesets — Design Spec

## Goal

Replace the manual `pnpm publish` workflow with `@changesets/cli` and a GitHub Actions pipeline that automates version bumps, changelog generation, and npm publishing for all three publishable packages.

## Current State

- Three publishable packages: `@nebulord/sickbay-core`, `@nebulord/sickbay` (CLI), `sickbay` (wrapper)
- Core and CLI at `0.1.0`, wrapper at `1.2.0` (all published manually once)
- `publishConfig.access: "public"` already set on core and CLI
- Wrapper lives in `packages/sickbay-wrapper`, excluded from pnpm workspace via `!packages/sickbay-wrapper` in `pnpm-workspace.yaml`
- Web and docs packages are private, not published

## Design

### Version Strategy

All three publishable packages use **synchronized versioning** — they always share the same version number. A change to core bumps core, CLI, and wrapper together. This keeps `npx sickbay` and `npx @nebulord/sickbay` always in sync.

**Version alignment:** Before enabling changesets, manually set all three packages to `1.2.0` (matching the wrapper's current npm version, which is the highest). The first changesets release then bumps forward naturally from there (e.g. `1.2.1` for a patch, `1.3.0` for a minor).

Core and CLI jump from `0.1.0` to `1.2.0` — a larger leap, but this is effectively the first "real" release and avoids npm dist-tag complications from publishing a lower version than what already exists.

### Changesets Configuration

`.changeset/config.json`:

```json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [["@nebulord/sickbay-core", "@nebulord/sickbay"]],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@nebulord/sickbay-web", "@nebulord/sickbay-docs"]
}
```

- **`fixed`**: Groups core and CLI so they always get the same version bump. The wrapper is **not** in this array — changesets cannot see it since it's outside the pnpm workspace. Wrapper versioning is handled by the post-publish sync script instead.
- **`ignore`**: Excludes private packages (web, docs) from versioning
- **`commit: false`**: The GitHub Action handles committing
- **`access: "public"`**: Scoped packages publish publicly
- **`baseBranch: "main"`**: Version PR targets main

Root `package.json` additions:
- `@changesets/cli` added to `devDependencies`
- Scripts: `"changeset": "changeset"`, `"version-packages": "changeset version"`

### Developer Workflow

1. Make a code change
2. Run `pnpm changeset` — select patch/minor/major, write a summary
3. Commit the generated `.changeset/<random-name>.md` file alongside the code change
4. Push / merge to main
5. GitHub Action detects pending changesets, runs `changeset version`, opens a "Version Packages" PR with bumped versions and combined CHANGELOG.md entries
6. When ready to release, merge the version PR
7. GitHub Action detects no pending changesets (they were consumed), runs `changeset publish` to push core and CLI to npm, then syncs and publishes the wrapper

Multiple changesets accumulate into a single version bump PR. The highest bump type wins (e.g. one patch + one minor = minor).

### GitHub Actions Workflow

`.github/workflows/publish.yml` — triggers on push to `main`.

**Single job: `release`**

Steps:
1. Checkout code
2. Setup Node 20 + pnpm (using `pnpm/action-setup` reading version from `packageManager` field)
3. `pnpm install`
4. `pnpm build`
5. Run `changesets/action@v1`:
   - `version` command: `pnpm version-packages`
   - `publish` command: `pnpm changeset publish`
   - Creates/updates the "Version Packages" PR when changesets are pending
   - Publishes to npm when no changesets are pending (version PR was just merged)
6. Post-publish step (runs only when `changesets/action` published — check the `published` output): sync wrapper version and publish it
   - Read version from `apps/cli/package.json` (the wrapper's direct dependency)
   - Update `packages/sickbay-wrapper/package.json`: set `version` and `dependencies["@nebulord/sickbay"]` to the new version
   - Set `NODE_AUTH_TOKEN` env var for npm auth
   - Run `npm publish` from wrapper directory
   - Commit updated wrapper `package.json` with `[skip ci]` in the message to prevent re-triggering the workflow

**Authentication:**
- `NPM_TOKEN` repo secret (npmjs.com automation token) — for npm publish. The `changesets/action` writes a root `.npmrc` for workspace packages. The wrapper publish step sets `NODE_AUTH_TOKEN` explicitly.
- `GITHUB_TOKEN` (built-in) — for creating the version PR

### Wrapper Sync

The wrapper is outside the pnpm workspace, so changesets can't manage it directly. The publish workflow handles it as a post-publish step:

1. After `changeset publish` succeeds, a script reads the published version from `apps/cli/package.json` (`@nebulord/sickbay` — the wrapper's direct dependency)
2. Updates `packages/sickbay-wrapper/package.json`: sets `version` and `dependencies["@nebulord/sickbay"]` to the new version
3. Sets `NODE_AUTH_TOKEN` env var and runs `npm publish` from the wrapper directory
4. Commits the wrapper version change back to main with `[skip ci]` to prevent re-triggering the workflow

No `pnpm install` is needed for the wrapper — it has no build step and `node_modules` is not in its `files` array. The `npm publish` just uploads `bin.mjs` and `package.json`.

### Files Changed

**New:**
- `.changeset/config.json`
- `.changeset/README.md` (auto-generated by `changeset init`)
- `.github/workflows/publish.yml`

**Modified:**
- `package.json` (root) — add `@changesets/cli` devDep, add `changeset` and `version-packages` scripts
- `packages/core/package.json` — bump version to `1.2.0`
- `apps/cli/package.json` — bump version to `1.2.0`

**Unchanged:**
- All source code, tests, existing workflows (`docs.yml`)

### One-Time Setup (Manual)

1. Add `NPM_TOKEN` secret to GitHub repo (Settings > Secrets and variables > Actions)
2. Generate token at npmjs.com > Access Tokens > type: Automation
