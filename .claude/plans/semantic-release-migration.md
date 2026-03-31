# Feature: Semantic Release Migration

> **Roadmap Phase**: Infrastructure / CI — not phase-gated
> **Blocked by**: nothing

This plan replaces `@changesets/cli` with `multi-semantic-release` for fully automated versioning,
changelog generation, and NPM publishing on every push to `main`.

## Feature Description

The current changesets flow requires manually creating changeset files, then waiting for a bot PR
("chore: version packages") to merge before anything publishes. Branch protection made the bot
unreliable. Semantic-release eliminates all manual steps — conventional commit messages drive
everything automatically.

## User Story

As the sole maintainer of Sickbay,
I want pushing a conventional commit to `main` to automatically version, tag, and publish all packages,
So that I never manually create changeset files or merge bot PRs again.

## Problem Statement

Changesets requires human-authored changeset files + a bot merge PR before publishing. Branch
protection blocked the bot. The project now has a graveyard of version commits that serve no purpose.

## Solution Statement

`multi-semantic-release` orchestrates semantic-release across all workspace packages in dependency
order (`core` → `cli` → `sickbay` wrapper). Each package gets its own version, CHANGELOG.md, GitHub
release, and NPM publish. Conventional commits drive version bumps. No manual steps.

## Feature Metadata

**Feature Type**: Refactor / Infrastructure
**Estimated Complexity**: Medium
**Packages Affected**: all publishable packages + root CI config
**New npm Dependencies**: `semantic-release`, `multi-semantic-release`, `@semantic-release/changelog`, `@semantic-release/git`, `@semantic-release/github`
**Touches `types.ts`**: No

---

## PUBLISHABLE PACKAGES

Only these three packages publish to NPM:

| Package                  | Path                        | NPM name                      |
| ------------------------ | --------------------------- | ----------------------------- |
| `@nebulord/sickbay-core` | `packages/core/`            | core analysis engine          |
| `@nebulord/sickbay`      | `apps/cli/`                 | CLI tool                      |
| `sickbay`                | `packages/sickbay-wrapper/` | thin wrapper (re-exports CLI) |

`@nebulord/sickbay-web` is already `"private": true` — `multi-semantic-release` skips it automatically.
`apps/docs` is also private — skipped automatically.

---

## HOW multi-semantic-release WORKS

1. Discovers all packages from `pnpm-workspace.yaml`
2. Skips private packages
3. For each publishable package, analyzes commits affecting that package's directory
4. Determines version bump: `fix:` → patch, `feat:` → minor, `BREAKING CHANGE:` footer → major
5. Publishes in topological order: `core` first, then `cli` (depends on core), then `sickbay` (depends on cli)
6. Replaces `workspace:*` with real version numbers in published packages
7. Commits back `package.json` + `CHANGELOG.md` updates with `[skip ci]` to prevent infinite loop

---

## CONTEXT REFERENCES

### Files to Read Before Implementing

- `package.json` (root) — remove `changeset` + `version-packages` scripts and `@changesets/cli` devDep
- `.changeset/config.json` — delete this file and directory
- `.github/workflows/publish.yml` — full replacement
- `packages/sickbay-wrapper/package.json` — must change `"@nebulord/sickbay": "0.1.0"` → `"workspace:*"`

### New Files to Create

- `.releaserc.json` (root) — shared semantic-release config for all packages
- `packages/core/.releaserc.json` — per-package override (changelog path)
- `apps/cli/.releaserc.json` — per-package override (changelog path)
- `packages/sickbay-wrapper/.releaserc.json` — per-package override (changelog path)

### Commit Message Convention (already in use)

```
feat: add X feature          → minor version bump
fix: resolve Y bug           → patch version bump
chore: update deps           → NO release triggered
docs: update README          → NO release triggered
test: add tests              → NO release triggered
ci: update workflow          → NO release triggered

BREAKING CHANGE in footer    → major version bump
```

---

## IMPLEMENTATION PLAN

### Phase 1: GitHub PAT (prerequisite — manual step by Dan)

`@semantic-release/git` pushes a commit back to `main` with the updated `package.json` and
`CHANGELOG.md`. With branch protection enabled, the default `GITHUB_TOKEN` cannot push directly
to `main`. A Personal Access Token (PAT) is required.

**Dan must do this manually:**

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Create a new token for the `nebulord-dev/sickbay` repo
3. Required permissions:
   - **Contents**: Read and Write
   - **Pull requests**: Read and Write (for `@semantic-release/github`)
   - **Issues**: Read and Write (for `@semantic-release/github`)
4. Add the PAT as a repository secret named `GH_TOKEN`
   - Go to the repo → Settings → Secrets and variables → Actions → New repository secret
   - Name: `GH_TOKEN`, Value: the PAT you just created
5. Confirm `NPM_TOKEN` secret already exists (it should — changesets used it too)

### Phase 2: Install Dependencies

Install at the **root** workspace (devDependencies):

```bash
pnpm add -D -w semantic-release multi-semantic-release @semantic-release/changelog @semantic-release/git @semantic-release/github
```

`@semantic-release/npm`, `@semantic-release/commit-analyzer`, and `@semantic-release/release-notes-generator`
are bundled with `semantic-release` core — no need to install separately.

### Phase 3: Root Release Config

**CREATE** `.releaserc.json` at the monorepo root:

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        "changelogFile": "CHANGELOG.md"
      }
    ],
    "@semantic-release/npm",
    [
      "@semantic-release/git",
      {
        "assets": ["CHANGELOG.md", "package.json"],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ],
    "@semantic-release/github"
  ]
}
```

The `[skip ci]` in the commit message is **critical** — it prevents the release commit itself from
triggering another CI run and entering an infinite loop.

### Phase 4: Per-Package Release Configs

Each publishable package needs its own `.releaserc.json` so the changelog path is relative to the
package directory (not the repo root).

**CREATE** `packages/core/.releaserc.json`:

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        "changelogFile": "CHANGELOG.md"
      }
    ],
    "@semantic-release/npm",
    [
      "@semantic-release/git",
      {
        "assets": ["CHANGELOG.md", "package.json"],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ],
    "@semantic-release/github"
  ]
}
```

**CREATE** `apps/cli/.releaserc.json` — identical content to above.

**CREATE** `packages/sickbay-wrapper/.releaserc.json` — identical content to above.

### Phase 5: Fix Wrapper Dependency

The wrapper currently has `"@nebulord/sickbay": "0.1.0"` pinned. Change to `workspace:*` so
`multi-semantic-release` can auto-update it when the CLI is released.

**UPDATE** `packages/sickbay-wrapper/package.json`:

```json
{
  "dependencies": {
    "@nebulord/sickbay": "workspace:*"
  }
}
```

This is the key to keeping the wrapper's version in sync — when CLI bumps, the wrapper's dep on
`@nebulord/sickbay` changes, which triggers a patch bump on the wrapper, publishing it at the same
time.

### Phase 6: Update GitHub Actions Workflow

**REPLACE** `.github/workflows/publish.yml` entirely:

```yaml
name: Publish

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
      pull-requests: write
      id-token: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Release
        run: pnpm exec multi-semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Critical differences from the old workflow:**

- `fetch-depth: 0` — semantic-release needs the **full git history** to determine version bumps.
  Without this, it can't see past commits and may fail or release incorrectly.
- `persist-credentials: false` — required so the `@semantic-release/git` plugin can use the PAT
  (via `GH_TOKEN`) instead of the default Actions token when pushing the release commit back.
- No `changesets/action@v1` step
- No separate wrapper publish step — `multi-semantic-release` handles all three packages
- `GITHUB_TOKEN` is set to `GH_TOKEN` (the PAT) — this is what allows pushing to protected `main`

### Phase 7: Remove Changesets

**DELETE** the entire `.changeset/` directory:

```bash
rm -rf .changeset
```

**UPDATE** root `package.json` — remove:

- `"changeset": "changeset"` from scripts
- `"version-packages": "changeset version"` from scripts
- `"@changesets/cli": "^2.30.0"` from devDependencies

Then run `pnpm install` to clean up the lockfile.

---

## STEP-BY-STEP TASKS

Execute in order:

### MANUAL: Create GitHub PAT

- Follow Phase 1 instructions above
- Add `GH_TOKEN` secret to repo
- Confirm `NPM_TOKEN` secret exists

---

### INSTALL: `semantic-release` and plugins

```bash
pnpm add -D -w semantic-release multi-semantic-release @semantic-release/changelog @semantic-release/git @semantic-release/github
```

---

### CREATE `.releaserc.json` (root)

- Content: as specified in Phase 3
- **GOTCHA**: The `[skip ci]` message token prevents release commit loops

---

### CREATE `packages/core/.releaserc.json`

- Content: as specified in Phase 4

---

### CREATE `apps/cli/.releaserc.json`

- Content: as specified in Phase 4

---

### CREATE `packages/sickbay-wrapper/.releaserc.json`

- Content: as specified in Phase 4

---

### UPDATE `packages/sickbay-wrapper/package.json`

- Change `"@nebulord/sickbay": "0.1.0"` → `"@nebulord/sickbay": "workspace:*"`
- Run `pnpm install` after to update lockfile

---

### REPLACE `.github/workflows/publish.yml`

- Full replacement as specified in Phase 6
- **GOTCHA**: `fetch-depth: 0` is non-negotiable — semantic-release will fail without full history

---

### REMOVE `.changeset/` directory

```bash
rm -rf .changeset
```

---

### UPDATE root `package.json`

- Remove `changeset` script
- Remove `version-packages` script
- Remove `@changesets/cli` from devDependencies
- Run `pnpm install` to update lockfile

---

## VALIDATION COMMANDS

### Local dry run (before merging to main)

```bash
# Test that multi-semantic-release can find and parse all packages
# Does NOT publish — just shows what would happen
pnpm exec multi-semantic-release --dry-run
```

If you get "No release published" — that's fine. It means the commits since last tag don't
warrant a release (chore/docs/test). To force a test, verify the output shows all 3 packages
were analyzed and no errors.

### Confirm package discovery

```bash
# Should list all packages in workspace
pnpm exec multi-semantic-release --list-packages 2>/dev/null || echo "use --dry-run to verify"
```

### Build check

```bash
pnpm build
```

### Full test suite

```bash
pnpm test
```

---

## ACCEPTANCE CRITERIA

- [ ] `pnpm build` passes
- [ ] `pnpm test` passes
- [ ] `.changeset/` directory removed
- [ ] `@changesets/cli` removed from root `package.json`
- [ ] `changeset` and `version-packages` scripts removed from root `package.json`
- [ ] Root `.releaserc.json` created with correct plugin order
- [ ] Per-package `.releaserc.json` created in `packages/core/`, `apps/cli/`, `packages/sickbay-wrapper/`
- [ ] `packages/sickbay-wrapper/package.json` uses `workspace:*` for `@nebulord/sickbay` dep
- [ ] `.github/workflows/publish.yml` updated (no `changesets/action`, has `fetch-depth: 0`, uses `GH_TOKEN`)
- [ ] `GH_TOKEN` secret set in GitHub repo settings (Dan's manual step)
- [ ] `pnpm exec multi-semantic-release --dry-run` runs without errors

---

## NOTES

### Why per-package `.releaserc.json` instead of just root?

`multi-semantic-release` runs semantic-release in the context of each package's directory. If only
the root `.releaserc.json` exists, the `CHANGELOG.md` path resolves relative to the repo root,
not the package directory. Per-package configs ensure each package gets its own `CHANGELOG.md`.

### What happens on the first release?

`multi-semantic-release` will look at commits since the last git tag. If the last tag is
`@nebulord/sickbay-core@1.3.0` etc., it'll analyze commits since then. If there are no `feat:` or
`fix:` commits, no release will happen (which is correct behavior).

### Versioning strategy

Packages version independently. If only `core` changes, only `core` bumps. The CLI will bump via
its workspace dep change (patch bump). The wrapper follows the same pattern. This is more accurate
than changesets' fixed mode which bumped everything regardless.

### The `[skip ci]` gotcha

The release process commits `CHANGELOG.md` and `package.json` back to `main`. Without `[skip ci]`
in the commit message, this triggers another CI run → another release attempt → infinite loop. The
commit message template in `@semantic-release/git` config already includes it.

### Existing `CHANGELOG.md` files

The existing changelogs in each package were generated by changesets and have a different format.
Semantic-release will append to them using its own format going forward. This is fine — the history
is preserved, new entries use the new format.
