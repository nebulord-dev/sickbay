# Simplify Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace multi-semantic-release with single semantic-release, publishing one package (`sickbay`) to npm.

**Architecture:** Rename CLI package from `@nebulord/sickbay` to `sickbay`, bundle core into CLI via tsup `noExternal`, delete the wrapper package, switch to root-level `semantic-release`. Internal monorepo structure unchanged.

**Tech Stack:** semantic-release, tsup, pnpm workspaces, Turbo, GitHub Actions

**Spec:** `.claude/docs/simplify-publishing-design.md`

---

### Task 1: Delete the wrapper package and per-package release configs

**Files:**
- Delete: `packages/sickbay-wrapper/` (entire directory)
- Delete: `packages/core/.releaserc.json`
- Delete: `apps/cli/.releaserc.json`

- [ ] **Step 1: Delete the wrapper package directory**

```bash
rm -rf packages/sickbay-wrapper
```

- [ ] **Step 2: Delete per-package release configs**

```bash
rm packages/core/.releaserc.json
rm apps/cli/.releaserc.json
```

- [ ] **Step 3: Verify the build still works**

```bash
pnpm build
```

Expected: All packages build successfully. The wrapper was never part of the Turbo build pipeline, so nothing breaks.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete wrapper package and per-package releaserc files"
```

---

### Task 2: Rename CLI package and update internal references

**Files:**
- Modify: `apps/cli/package.json` (name, publishConfig, dependencies)
- Modify: `apps/web/package.json` (devDependencies)
- Modify: `packages/core/package.json` (private, publishConfig)
- Modify: `package.json` (root — filter scripts, devDependencies)
- Modify: `turbo.json` (package-specific build task)

- [ ] **Step 1: Rename CLI package and restructure dependencies**

In `apps/cli/package.json`:
- Change `"name"` from `"@nebulord/sickbay"` to `"sickbay"`
- Remove the `"publishConfig"` block entirely
- Move `"@nebulord/sickbay-core": "1.3.0"` from `dependencies` to `devDependencies` as `"@nebulord/sickbay-core": "workspace:*"`
- Add core's runtime dependencies to `dependencies`:

```json
"depcheck": "^1.4.7",
"execa": "^9.6.1",
"globby": "^16.2.0",
"jscpd": "^4.0.8",
"knip": "^6.1.0",
"license-checker": "^25.0.1",
"madge": "^8.0.0",
"source-map-explorer": "^2.5.3"
```

- [ ] **Step 2: Mark core as private**

In `packages/core/package.json`:
- Add `"private": true` (after `"version"`)
- Remove the `"publishConfig"` block

- [ ] **Step 3: Update web package core dependency**

In `apps/web/package.json`:
- Change `"@nebulord/sickbay-core": "1.3.0"` to `"@nebulord/sickbay-core": "workspace:*"` (in devDependencies)

- [ ] **Step 4: Update root package.json**

In `package.json`:
- Remove `"multi-semantic-release": "^3.1.0"` from `devDependencies`
- Remove `"@semantic-release/exec": "^7.1.0"` from `devDependencies`
- Update filter scripts:
  - `"cli"`: change `@nebulord/sickbay` to `sickbay`
  - `"test:cli"`: change `@nebulord/sickbay` to `sickbay`
  - `"test:cli:ui"`: change `@nebulord/sickbay` to `sickbay`

- [ ] **Step 5: Update knip.json**

In `knip.json`, update both `ignoreDependencies` arrays:
- Change `"@nebulord/sickbay"` to `"sickbay"` (line 13 and line 25)

- [ ] **Step 6: Update turbo.json**

In `turbo.json`, rename the CLI-specific build task key:

```json
"sickbay#build": {
  "dependsOn": ["@nebulord/sickbay-web#build", "^build"],
  "outputs": ["dist/**"]
}
```

(Change only the key from `"@nebulord/sickbay#build"` to `"sickbay#build"`. The `dependsOn` reference to `@nebulord/sickbay-web#build` stays — that package name isn't changing.)

- [ ] **Step 7: Regenerate lockfile**

```bash
pnpm install
```

This updates `pnpm-lock.yaml` to reflect the workspace protocol changes and removed packages.

- [ ] **Step 8: Verify build and tests**

```bash
pnpm build && pnpm test
```

Expected: All packages build and all tests pass. Internal imports from `@nebulord/sickbay-core` still resolve via pnpm workspace.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: rename CLI package to sickbay, mark core as private"
```

---

### Task 3: Bundle core into CLI via tsup

**Files:**
- Modify: `apps/cli/tsup.config.ts`

- [ ] **Step 1: Add noExternal to tsup config**

In `apps/cli/tsup.config.ts`, add `noExternal` to the defineConfig:

```typescript
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  noExternal: ['@nebulord/sickbay-core'],
  define: {
    __VERSION__: JSON.stringify(version),
  },
  async onSuccess() {
    // ... existing web dist copy logic unchanged
  },
});
```

- [ ] **Step 2: Rebuild and verify core is bundled**

```bash
pnpm --filter sickbay build
```

Expected: Build succeeds. Verify core code is inlined by checking the output:

```bash
grep -l "runSickbay" apps/cli/dist/index.js
```

Expected: Match found — core's `runSickbay` function is now in the CLI bundle.

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/cli/tsup.config.ts
git commit -m "chore: bundle core into CLI via tsup noExternal"
```

---

### Task 4: Fix hardcoded CLI version

**Files:**
- Modify: `apps/cli/src/index.ts:35`

- [ ] **Step 1: Add __VERSION__ declaration and use it**

In `apps/cli/src/index.ts`, add the declare statement after the imports (before the `.env` loading block):

```typescript
declare const __VERSION__: string;
```

Then change line 35 from:

```typescript
  .version('0.0.1')
```

to:

```typescript
  .version(__VERSION__)
```

- [ ] **Step 2: Rebuild and verify**

```bash
pnpm --filter sickbay build
node apps/cli/dist/index.js --version
```

Expected: Prints the version from `apps/cli/package.json` (e.g. `1.3.1`), not `0.0.1`.

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/cli/src/index.ts
git commit -m "fix: use build-time version instead of hardcoded 0.0.1"
```

---

### Task 5: Update release configuration and CI workflow

**Files:**
- Modify: `.releaserc.json`
- Modify: `.github/workflows/publish.yml:42`

- [ ] **Step 1: Replace root .releaserc.json**

Replace the entire contents of `.releaserc.json` with:

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

- [ ] **Step 2: Update publish workflow**

In `.github/workflows/publish.yml`, change line 42 from:

```yaml
        run: pnpm exec multi-semantic-release
```

to:

```yaml
        run: pnpm exec semantic-release
```

- [ ] **Step 3: Commit**

```bash
git add .releaserc.json .github/workflows/publish.yml
git commit -m "ci: switch from multi-semantic-release to single semantic-release"
```

---

### Task 6: Clean up stale changelogs

**Files:**
- Delete: `packages/core/CHANGELOG.md`
- Delete: `apps/cli/CHANGELOG.md`

- [ ] **Step 1: Delete stale changelogs**

```bash
rm packages/core/CHANGELOG.md
rm apps/cli/CHANGELOG.md
```

(The wrapper's CHANGELOG was already deleted in Task 1. `apps/web/CHANGELOG.md` and `apps/docs/CHANGELOG.md` can stay — they're historical and harmless.)

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove stale per-package changelogs"
```

---

### Task 7: Update documentation

**Files:**
- Modify: `.claude/docs/semantic-release-workflow.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rewrite semantic-release-workflow.md**

Rewrite `.claude/docs/semantic-release-workflow.md` to reflect the new single-package setup:
- Remove all references to `multi-semantic-release`
- Remove the wrapper package from the "What Gets Published" table
- Update the table to show only `sickbay` as the published package
- Update the "What Happens After Merging" section — step 4 should say packages publish as `sickbay` only (not dependency-order multi-publish)
- Update tag format examples to `v1.1.0` instead of `@nebulord/sickbay@1.3.2`
- Update the dry-run command from `pnpm exec multi-semantic-release --dry-run` to `pnpm exec semantic-release --dry-run`

- [ ] **Step 2: Update CLAUDE.md if needed**

Search `CLAUDE.md` for any references to:
- `@nebulord/sickbay` (the old CLI package name) — should now say `sickbay`
- `multi-semantic-release` — should now say `semantic-release`
- The wrapper package — references should be removed
- `sickbay-wrapper` — references should be removed

Update any matches. If no references exist, skip this step.

- [ ] **Step 3: Commit**

```bash
git add .claude/docs/semantic-release-workflow.md CLAUDE.md
git commit -m "docs: update release workflow docs for single-package publishing"
```

---

### Task 8: Create version baseline tag and verify

- [ ] **Step 1: Build and run all checks**

```bash
pnpm build && pnpm test && pnpm test:snapshots && pnpm lint
```

Expected: Everything passes.

- [ ] **Step 2: Create the baseline git tag**

This gives semantic-release the correct starting point. The tag must match the current npm version of `sickbay` (1.0.1) and use the new tag format (`v${version}`):

```bash
git tag v1.0.1
git push origin v1.0.1
```

- [ ] **Step 3: Verify semantic-release dry run**

```bash
pnpm exec semantic-release --dry-run
```

Expected: semantic-release finds the `v1.0.1` tag, analyzes commits since that tag, and reports what version it would publish. With the `feat:` commits from earlier tasks, it should report `1.1.0`.

- [ ] **Step 4: Push to main to trigger the first release**

The commits from Tasks 1-7 are already on the branch. Push to trigger the publish workflow:

```bash
git push origin main
```

Expected: GitHub Actions runs → builds → `semantic-release` publishes `sickbay@1.1.0` to npm.

- [ ] **Step 5: Verify the publish**

After CI completes, check:

```bash
npm view sickbay version
```

Expected: `1.1.0`

---

### Task 9: Deprecate old npm packages (manual, post-publish)

This task runs only after Task 8 confirms a successful publish.

- [ ] **Step 1: Deprecate old packages**

```bash
npm deprecate @nebulord/sickbay@"*" "Moved to 'sickbay' — run npx sickbay"
npm deprecate @nebulord/sickbay-core@"*" "Internal package — use 'sickbay' instead"
```

- [ ] **Step 2: Verify deprecation**

```bash
npm view @nebulord/sickbay
```

Expected: Shows deprecation warning in output.
