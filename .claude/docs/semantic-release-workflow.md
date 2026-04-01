# Semantic Release — Day-to-Day Workflow

## The One Rule

**Your commit messages control everything.** There are no manual steps, no changeset files, no bot PRs. You write code, push to `main`, and the pipeline handles the rest.

---

## Commit Message Prefixes

| Prefix             | What it does                       | Example                                       |
| ------------------ | ---------------------------------- | --------------------------------------------- |
| `feat:`            | Minor version bump (1.3.0 → 1.4.0) | `feat: add Vue.js health checks`              |
| `fix:`             | Patch version bump (1.3.0 → 1.3.1) | `fix: resolve false positives in knip runner` |
| `chore:`           | No release                         | `chore: update dependencies`                  |
| `ci:`              | No release                         | `ci: update publish workflow`                 |
| `docs:`            | No release                         | `docs: update installation guide`             |
| `test:`            | No release                         | `test: add coverage for scoring module`       |
| `refactor:`        | No release                         | `refactor: simplify runner base class`        |
| `BREAKING CHANGE:` | Major version bump (1.3.0 → 2.0.0) | Footer in commit body                         |

---

## Day-to-Day Flow

### Scenario A — Squash Merge (one commit per PR)

1. Work on a branch however you like — commit messages don't matter during development
2. Open a PR
3. When merging: choose **Squash and merge**
4. GitHub shows a text box for the squash commit message — **this is the important one**
5. Set it to `fix: what you fixed` or `feat: what you added`
6. Merge → release fires automatically

**Best for**: small, focused PRs where one label describes the whole thing.

### Scenario B — Regular Merge (all commits land individually)

1. Write commits with the right prefixes as you go: `feat:`, `fix:`, etc.
2. Open a PR
3. Merge normally (no squash)
4. All commits land on `main` — semantic-release reads each one
5. The highest-impact prefix determines the version bump (`feat:` beats `fix:`)
6. Every `feat:` and `fix:` commit gets its own line in the changelog

**Best for**: PRs with multiple distinct changes (bug fix + new feature + refactor).

---

## What Happens After Merging

When any `fix:` or `feat:` commit lands on `main`:

1. **CI runs** — builds, tests pass
2. **Semantic-release analyzes commits** since the last git tag
3. **Version is calculated** — patch for `fix:`, minor for `feat:`, major for breaking
4. **`sickbay` publishes to NPM** — single package, no dependency-order orchestration needed
5. **`CHANGELOG.md` is updated** with the new release notes
6. **GitHub Release is created** with the same notes
7. **Git tag is created** — e.g. `v1.1.0`

Total time: ~2-3 minutes.

---

## The Changelog

`CHANGELOG.md` in `apps/cli/` is auto-generated and looks like this:

```markdown
## [1.4.0] - 2026-04-15

### Features

- add Vue.js health checks
- add Svelte framework detection

### Bug Fixes

- resolve false positives in knip runner
```

Only `feat:` and `fix:` commits appear. Everything else (`chore:`, `ci:`, `docs:`) is excluded.

The same content appears on the **GitHub Releases page**.

---

## Breaking Changes

For a major version bump, add `BREAKING CHANGE:` in the **footer** of any commit body:

```
feat: redesign health check API

BREAKING CHANGE: runSickbay() now returns a Promise<SickbayReport>
instead of accepting a callback. Update all callers.
```

The footer must be separated from the subject by a blank line.

---

## When Nothing Releases

If you push to `main` and no release fires, it means all commits since the last tag were `chore:`, `ci:`, `docs:`, `test:`, or `refactor:`. That's intentional — not every push needs a release.

You can check what semantic-release sees locally:

```bash
pnpm exec semantic-release --dry-run
```

---

## What Gets Published

| Package          | NPM name                 | Published?    |
| ---------------- | ------------------------ | ------------- |
| `apps/cli/`      | `sickbay`                | ✅            |
| `packages/core/` | `@nebulord/sickbay-core` | ❌ private    |
| `apps/web/`      | `@nebulord/sickbay-web`  | ❌ private    |
| `apps/docs/`     | `@nebulord/sickbay-docs` | ❌ not on npm |

Core is bundled into the CLI at build time — users install `sickbay` and get everything they need.

---

## Secrets Required

Both of these must be set in GitHub → Settings → Secrets and variables → Actions:

| Secret      | Purpose                                                                      |
| ----------- | ---------------------------------------------------------------------------- |
| `GH_TOKEN`  | Fine-grained PAT — pushes changelogs back to `main`, creates GitHub releases |
| `NPM_TOKEN` | Publishes packages to npm registry                                           |

The `GH_TOKEN` expires **April 1, 2027** — calendar a reminder to rotate it before then.

---

## Quick Reference

```
# Triggers a patch release (1.3.0 → 1.3.1)
fix: what you fixed

# Triggers a minor release (1.3.0 → 1.4.0)
feat: what you added

# Triggers a major release (1.3.0 → 2.0.0)
feat: redesign something

BREAKING CHANGE: what broke and how to migrate

# Does NOT trigger a release
chore: / ci: / docs: / test: / refactor:
```
