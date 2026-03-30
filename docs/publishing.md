# Publishing Guide

This is an internal reference for maintainers. It covers how changesets work, the day-to-day workflow, and what to do when things go sideways.

---

## What are changesets?

A changeset is a small markdown file that describes a pending change. It captures two things:

1. **Which packages are affected** and what kind of version bump each one needs (patch, minor, or major)
2. **A human-readable summary** that gets written into the CHANGELOG

You create a changeset when you make a change worth shipping. It lives in the `.changeset/` folder alongside your code. When it's time to release, the changesets tool reads all the accumulated files, figures out the right version numbers, updates `CHANGELOG.md` files, and deletes the changeset files.

The key idea: **changeset files travel with the code changes that prompted them**. By the time you merge a PR, the intent to bump the version is already in the repo.

---

## Day-to-day workflow

### 1. Make your code changes

Normal development. Nothing special here.

### 2. Add a changeset

```bash
pnpm changeset
```

This launches an interactive prompt:

- **Select packages** — use spacebar to toggle. For most changes you'll select `@nebulord/sickbay-core` and `@nebulord/sickbay`. You almost never need to select anything else (the wrapper syncs automatically; the web app is excluded from publishing).
- **Pick a bump type** for each selected package
- **Write a summary** — one or two sentences describing what changed from a user's perspective

This creates a file in `.changeset/` with a random name like `fuzzy-lions-dance.md`. Commit it with your code.

### 3. Commit the changeset with your changes

```bash
git add .changeset/fuzzy-lions-dance.md
git commit -m "feat: add new check for X"
```

Or include it in your existing commit — either way is fine.

---

### Patch, minor, or major?

| Type | When to use |
|------|------------|
| **patch** | Bug fixes, internal refactors, performance improvements — nothing changes for users in terms of behavior |
| **minor** | New features, new CLI flags, new checks added — backwards compatible |
| **major** | Breaking changes — removed flags, renamed commands, changed output format, dropped Node version support |

When in doubt, use **patch** for fixes and **minor** for additions. Reserve major for things that would break someone's CI pipeline if they upgraded without reading the release notes.

---

## How releases work

This is fully automated once a changeset lands on `main`.

### The "Version Packages" PR

Every push to `main` triggers the `publish.yml` workflow. The `changesets/action` step inspects `.changeset/` and does one of two things:

- **If there are pending changesets** — it opens (or updates) a PR titled "chore: version packages". That PR bumps all the affected package versions, rewrites the CHANGELOG files, and deletes the consumed changeset files.
- **If there are no pending changesets** — it does nothing.

### Triggering the actual publish

**Merge the "Version Packages" PR.** That merge is itself a push to `main`, which re-runs the workflow. This time there are no changeset files (they were deleted in the PR), so the action publishes to npm instead.

### What publishes

The publish step runs `pnpm changeset publish`, which handles:

1. `@nebulord/sickbay-core`
2. `@nebulord/sickbay` (the CLI — what most users install)

After that succeeds, a separate step in the workflow publishes the **`sickbay` wrapper** package automatically. It reads the version that was just published, updates `packages/sickbay-wrapper/package.json` to match, publishes it to npm, and commits the version bump back to `main`.

Users who run `npx sickbay` hit the wrapper, which just delegates to `@nebulord/sickbay`. The wrapper always ends up at the same version as everything else.

**Publish order:** `@nebulord/sickbay-core` → `@nebulord/sickbay` → `sickbay` wrapper

---

## Common scenarios

### Forgot to add a changeset

No problem. Add one in a follow-up commit on the same branch before merging, or add one directly on `main` after the fact. The "Version Packages" PR will pick it up on the next push.

```bash
pnpm changeset
git add .changeset/
git commit -m "chore: add missing changeset"
```

### Multiple PRs, one release

Just let changesets accumulate. Each PR adds its own changeset file. The "Version Packages" PR collects all of them. Merge that PR whenever you're ready — there's no pressure to release after every single changeset.

### Need to delay a release

Don't merge the "Version Packages" PR. It will sit open indefinitely and keep updating itself as more changesets land. Merge it whenever you're ready to ship.

### Multiple changesets with different bump types

The highest bump type wins for each package. If you have three changesets — two patches and one minor — the release will be a minor. This is handled automatically; you don't need to do anything.

### Changeset only touches one package

That's fine. Because `@nebulord/sickbay-core` and `@nebulord/sickbay` are in a `fixed` group in `.changeset/config.json`, they always move together regardless. If you select only one of them during `pnpm changeset`, they'll both get bumped to the same version at release time.

---

## Manual / emergency publish

If the GitHub Action is broken and you need to ship something:

```bash
# Build everything first
pnpm build

# Publish core and CLI via changesets
pnpm changeset publish
```

Then manually sync the wrapper:

```bash
VERSION=$(node -p "require('./apps/cli/package.json').version")
cd packages/sickbay-wrapper
# Update version and dependency in package.json, then:
npm publish
```

After a manual publish, make sure to push any version bump commits so `main` reflects the published state.

---

## One-time setup (NPM_TOKEN)

The workflow needs an npm token with publish access. This is a one-time setup per repo.

1. Go to [npmjs.com](https://npmjs.com) and log in
2. Click your avatar → **Access Tokens** → **Generate New Token**
3. Choose **Automation** type (not Publish — Automation bypasses 2FA, which is required for CI)
4. Copy the token
5. Go to the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**
6. Name: `NPM_TOKEN`, value: the token you copied

The `GITHUB_TOKEN` needed for opening PRs is provided automatically by GitHub Actions — no setup required.

---

## Packages at a glance

| Package | npm name | Managed by |
|---------|----------|-----------|
| `packages/core` | `@nebulord/sickbay-core` | changesets |
| `apps/cli` | `@nebulord/sickbay` | changesets |
| `packages/sickbay-wrapper` | `sickbay` | workflow auto-sync |
| `apps/web` | not published | excluded from changesets |
