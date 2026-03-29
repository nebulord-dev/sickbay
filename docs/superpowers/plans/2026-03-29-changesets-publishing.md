# Automated npm Publishing with Changesets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up `@changesets/cli` with a GitHub Actions pipeline that automates version bumps, changelog generation, and npm publishing for `@nebulord/sickbay-core`, `@nebulord/sickbay`, and the `sickbay` wrapper.

**Architecture:** Add changesets config with a fixed version group for core + CLI. A GitHub Actions workflow runs `changesets/action` to open version PRs and publish on merge. A post-publish step syncs the wrapper (outside pnpm workspace) and publishes it separately.

**Tech Stack:** @changesets/cli, GitHub Actions, pnpm workspaces, npm registry

**Spec:** `docs/superpowers/specs/2026-03-29-changesets-publishing-design.md`

---

### Task 1: Align package versions to 1.2.0

All publishable packages must start at the same version before changesets takes over. The wrapper is already at `1.2.0` on npm, so core and CLI bump up to match.

**Files:**
- Modify: `packages/core/package.json`
- Modify: `apps/cli/package.json`

- [ ] **Step 1: Bump core version**

In `packages/core/package.json`, change `"version"` from `"0.1.0"` to `"1.2.0"`.

- [ ] **Step 2: Bump CLI version**

In `apps/cli/package.json`, change `"version"` from `"0.1.0"` to `"1.2.0"`.

- [ ] **Step 3: Verify build still works**

```bash
pnpm build
```

Expected: All packages build successfully. Version changes don't affect builds.

- [ ] **Step 4: Commit**

```bash
git add packages/core/package.json apps/cli/package.json
git commit -m "chore: align core and CLI versions to 1.2.0 to match wrapper"
```

---

### Task 2: Install and configure changesets

**Files:**
- Modify: `package.json` (root)
- Create: `.changeset/config.json`
- Create: `.changeset/README.md`

- [ ] **Step 1: Install @changesets/cli**

```bash
pnpm add -Dw @changesets/cli
```

This adds it to the root `devDependencies` and updates `pnpm-lock.yaml`.

- [ ] **Step 2: Add scripts to root package.json**

In `package.json` (root), add to `"scripts"`:

```json
"changeset": "changeset",
"version-packages": "changeset version"
```

- [ ] **Step 3: Create `.changeset/config.json`**

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

- [ ] **Step 4: Create `.changeset/README.md`**

```markdown
# Changesets

This folder is managed by [@changesets/cli](https://github.com/changesets/changesets).

To add a changeset, run `pnpm changeset` from the repo root.
```

- [ ] **Step 5: Verify changesets can see the right packages**

```bash
pnpm changeset status
```

Expected: Shows `@nebulord/sickbay-core` and `@nebulord/sickbay` with no pending changesets. Should NOT list `sickbay` (wrapper), `@nebulord/sickbay-web`, or `@nebulord/sickbay-docs`.

- [ ] **Step 6: Commit**

```bash
git add .changeset/config.json .changeset/README.md package.json pnpm-lock.yaml
git commit -m "chore: add @changesets/cli for automated versioning and publishing"
```

---

### Task 3: Create the GitHub Actions publish workflow

**Files:**
- Create: `.github/workflows/publish.yml`

- [ ] **Step 1: Create `.github/workflows/publish.yml`**

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
      pull-requests: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

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

      - name: Create Release PR or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          version: pnpm version-packages
          publish: pnpm changeset publish
          title: "chore: version packages"
          commit: "chore: version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Publish wrapper package
        if: steps.changesets.outputs.published == 'true'
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: |
          # Read the version that was just published
          VERSION=$(node -p "require('./apps/cli/package.json').version")
          echo "Publishing sickbay wrapper at version $VERSION"

          # Update wrapper package.json
          cd packages/sickbay-wrapper
          node -e "
            const pkg = require('./package.json');
            pkg.version = '$VERSION';
            pkg.dependencies['@nebulord/sickbay'] = '$VERSION';
            require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
          "

          # Create .npmrc for auth
          echo "//registry.npmjs.org/:_authToken=\${NODE_AUTH_TOKEN}" > .npmrc

          # Publish
          npm publish

          # Clean up .npmrc
          rm .npmrc

      - name: Commit wrapper version update
        if: steps.changesets.outputs.published == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add packages/sickbay-wrapper/package.json
          git commit -m "chore: sync wrapper version [skip ci]" || echo "No changes to commit"
          git push
```

- [ ] **Step 2: Verify YAML syntax**

```bash
cat .github/workflows/publish.yml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin.read()); print('Valid YAML')"
```

Expected: `Valid YAML`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: add GitHub Actions workflow for automated npm publishing"
```

---

### Task 4: Add a user-friendly publishing guide

Create a repo-level doc explaining the changesets workflow for the project maintainer. This lives at `docs/publishing.md` (not in the VitePress site at `apps/docs/` — it's an internal reference doc for contributors, not public documentation).

**Files:**
- Create: `docs/publishing.md`

- [ ] **Step 1: Write `docs/publishing.md`**

Write a user-friendly guide covering:
- What changesets are and why they exist
- Day-to-day workflow: how to add a changeset when making changes
- How to trigger a release (merging the version PR)
- What happens automatically (version bumps, changelogs, npm publish, wrapper sync)
- How to do a manual/emergency publish if the automation breaks
- One-time setup: adding the `NPM_TOKEN` secret
- Common scenarios: forgot to add a changeset, want to batch releases, need to skip a release

Keep the tone conversational and practical. Assume the reader has never used changesets before.

- [ ] **Step 2: Commit**

```bash
git add docs/publishing.md
git commit -m "docs: add publishing guide for changesets workflow"
```

---

### Task 5: Verify end-to-end with a dry-run changeset

**Files:**
- Create: `.changeset/<generated-name>.md` (temporary, will be consumed by first release)

- [ ] **Step 1: Create a test changeset**

```bash
pnpm changeset
```

When prompted:
- Select `@nebulord/sickbay-core` (space to select, enter to confirm)
- Choose `patch`
- Summary: `chore: set up automated publishing with changesets`

This creates a file like `.changeset/happy-dogs-fly.md`.

- [ ] **Step 2: Verify the changeset file looks correct**

```bash
cat .changeset/*.md
```

Expected: A markdown file with frontmatter listing `@nebulord/sickbay-core: patch` and the summary text.

Note: The `fixed` group ensures `@nebulord/sickbay` gets the same bump at version time, even if only core appears in the frontmatter. Do NOT run `pnpm version-packages` to test — it consumes (deletes) the changeset file and mutates package versions. The real version bump happens via the GitHub Action after merging to main.

- [ ] **Step 3: Commit the changeset file**

```bash
git add .changeset/
git commit -m "chore: add initial changeset for first automated release"
```

---

### Task 6: Final review

- [ ] **Step 1: Verify no stale references**

```bash
grep -r "0\.1\.0" packages/core/package.json apps/cli/package.json
```

Expected: No results (both should be at `1.2.0`).

- [ ] **Step 2: Verify all new files are committed**

```bash
git status
```

Expected: Clean working tree. All changes committed.

- [ ] **Step 3: Review the full diff**

```bash
git log --oneline main..HEAD
```

Expected commits (newest first):
1. `chore: add initial changeset for first automated release`
2. `docs: add publishing guide for changesets workflow`
3. `ci: add GitHub Actions workflow for automated npm publishing`
4. `chore: add @changesets/cli for automated versioning and publishing`
5. `chore: align core and CLI versions to 1.2.0 to match wrapper`
