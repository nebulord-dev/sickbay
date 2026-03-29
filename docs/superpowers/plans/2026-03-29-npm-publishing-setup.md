# npm Publishing Setup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename packages from `@sickbay/*` to `@nebulord/*`, create an unscoped `sickbay` wrapper, and publish to npm at version `0.1.0`.

**Architecture:** Fold `@sickbay/constants` into core, rename all package names and imports across the monorepo, add npm publishing metadata, create a thin wrapper package for the unscoped `sickbay` name. Publish in dependency order: core → cli → wrapper.

**Tech Stack:** pnpm workspaces, tsup, npm registry

**Spec:** `docs/superpowers/specs/2026-03-29-npm-publishing-setup-design.md`

---

### Task 1: Fold constants into core

**Files:**
- Create: `packages/core/src/constants.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/scoring.ts`
- Modify: `packages/core/src/integrations/complexity.ts`
- Modify: `packages/core/src/utils/file-helpers.ts`
- Modify: `packages/core/src/integrations/complexity.test.ts`
- Modify: `packages/core/src/integrations/heavy-deps.test.ts`
- Modify: `packages/core/src/integrations/react-perf.test.ts`
- Modify: `packages/core/src/integrations/secrets.test.ts`
- Modify: `packages/core/src/integrations/todo-scanner.test.ts`
- Modify: `packages/core/package.json` (remove `@sickbay/constants` dependency)
- Modify: `packages/core/tsup.config.ts` (remove `noExternal`)
- Delete: `packages/constants/` directory

- [ ] **Step 1: Create `packages/core/src/constants.ts`**

```typescript
// File complexity thresholds
export const WARN_LINES = 400;
export const CRITICAL_LINES = 600;

// Score thresholds
export const SCORE_EXCELLENT = 90;
export const SCORE_GOOD = 80;
export const SCORE_FAIR = 60;
```

- [ ] **Step 2: Add re-export in `packages/core/src/index.ts`**

Add at the end of the file:
```typescript
export { WARN_LINES, CRITICAL_LINES, SCORE_EXCELLENT, SCORE_GOOD, SCORE_FAIR } from './constants.js';
```

- [ ] **Step 3: Update core source imports**

In `packages/core/src/scoring.ts`, change:
```typescript
// from: import { SCORE_EXCELLENT, SCORE_GOOD, SCORE_FAIR } from '@sickbay/constants';
// to:
import { SCORE_EXCELLENT, SCORE_GOOD, SCORE_FAIR } from './constants.js';
```

In `packages/core/src/integrations/complexity.ts`, change:
```typescript
// from: import { WARN_LINES, CRITICAL_LINES } from '@sickbay/constants';
// to:
import { WARN_LINES, CRITICAL_LINES } from '../constants.js';
```

In `packages/core/src/utils/file-helpers.ts`, change:
```typescript
// from: import { ... } from '@sickbay/constants';
// to:
import { ... } from '../constants.js';
```

(Preserve the exact imported names from each file.)

- [ ] **Step 4: Update core test imports**

In each of these test files, replace `from '@sickbay/constants'` with the appropriate relative import:

- `packages/core/src/integrations/complexity.test.ts` → `from '../constants.js'`
- `packages/core/src/integrations/heavy-deps.test.ts` → `from '../constants.js'`
- `packages/core/src/integrations/react-perf.test.ts` → `from '../constants.js'`
- `packages/core/src/integrations/secrets.test.ts` → `from '../constants.js'`
- `packages/core/src/integrations/todo-scanner.test.ts` → `from '../constants.js'`

- [ ] **Step 5: Remove constants from core's package.json and tsup config**

In `packages/core/package.json`, remove from `dependencies`:
```json
"@sickbay/constants": "workspace:*",
```

In `apps/web/package.json`, remove from `dependencies`:
```json
"@sickbay/constants": "workspace:*",
```

In `packages/core/tsup.config.ts`, remove:
```typescript
noExternal: ['@sickbay/constants'],
```

- [ ] **Step 6: Delete the constants package**

```bash
rm -rf packages/constants
```

- [ ] **Step 7: Run core tests to verify**

```bash
pnpm --filter @sickbay/core build && pnpm --filter @sickbay/core test
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/constants.ts packages/core/src/index.ts packages/core/src/scoring.ts packages/core/src/integrations/complexity.ts packages/core/src/utils/file-helpers.ts packages/core/src/integrations/complexity.test.ts packages/core/src/integrations/heavy-deps.test.ts packages/core/src/integrations/react-perf.test.ts packages/core/src/integrations/secrets.test.ts packages/core/src/integrations/todo-scanner.test.ts packages/core/package.json packages/core/tsup.config.ts apps/web/package.json
git rm -r packages/constants
git commit -m "refactor: fold @sickbay/constants into core"
```

---

### Task 2: Rename package names in package.json files

**Files:**
- Modify: `packages/core/package.json`
- Modify: `apps/cli/package.json`
- Modify: `apps/web/package.json`
- Modify: `package.json` (root)
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Rename core package**

In `packages/core/package.json`:
- Change `"name"` from `"@sickbay/core"` to `"@nebulord/sickbay-core"`
- Change `"version"` from `"0.0.1"` to `"0.1.0"`
- Add `"description": "Analysis engine for the Sickbay health check CLI"`
- Add `"license": "MIT"`
- Add `"repository": { "type": "git", "url": "https://github.com/nebulord-dev/sickbay" }`
- Add `"publishConfig": { "access": "public" }`

- [ ] **Step 2: Rename CLI package**

In `apps/cli/package.json`:
- Change `"name"` from `"@sickbay/cli"` to `"@nebulord/sickbay"`
- Change `"version"` from `"0.0.1"` to `"0.1.0"`
- Change dependency `"@sickbay/core": "workspace:*"` to `"@nebulord/sickbay-core": "workspace:*"`
- Add `"description": "Zero-config health check CLI for JavaScript and TypeScript projects"`
- Add `"license": "MIT"`
- Add `"repository": { "type": "git", "url": "https://github.com/nebulord-dev/sickbay" }`
- Add `"publishConfig": { "access": "public" }`
- Add `"exports"` field:
```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
  }
}
```

- [ ] **Step 3: Rename web package**

In `apps/web/package.json`:
- Change `"name"` from `"@sickbay/web"` to `"@nebulord/sickbay-web"`
- Change `"version"` from `"0.0.1"` to `"0.1.0"`
- Change dependency `"@sickbay/core": "workspace:*"` to `"@nebulord/sickbay-core": "workspace:*"`
- Remove dependency `"@sickbay/constants": "workspace:*"`
- Add `"private": true`

- [ ] **Step 4: Update root package.json**

In `package.json` (root):
- Change `"version"` from `"0.0.1"` to `"0.1.0"`
- Remove the `"workspaces"` field (pnpm uses `pnpm-workspace.yaml`, this npm-style field is stale and incomplete)
- Update all 9 filter scripts:
  - `"cli"` → `"pnpm --filter @nebulord/sickbay dev"`
  - `"web"` → `"pnpm --filter @nebulord/sickbay-web dev"`
  - `"test:web"` → `"pnpm --filter @nebulord/sickbay-web test"`
  - `"test:web:ui"` → `"pnpm --filter @nebulord/sickbay-web test:ui"`
  - `"test:cli"` → `"pnpm --filter @nebulord/sickbay test"`
  - `"test:cli:ui"` → `"pnpm --filter @nebulord/sickbay test:ui"`
  - `"test:core"` → `"pnpm --filter @nebulord/sickbay-core test"`
  - `"test:core:ui"` → `"pnpm --filter @nebulord/sickbay-core test:ui"`

- [ ] **Step 5: Update pnpm-workspace.yaml**

Add workspace exclusion for the wrapper package (created in Task 5):
```yaml
packages:
  - apps/*
  - packages/*
  - '!packages/sickbay-wrapper'
```

- [ ] **Step 6: Run pnpm install to regenerate lockfile**

```bash
pnpm install
```

Expected: Lockfile regenerates with new package names.

- [ ] **Step 7: Commit**

```bash
git add packages/core/package.json apps/cli/package.json apps/web/package.json package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore: rename packages to @nebulord scope and bump to 0.1.0"
```

---

### Task 3: Update source code imports (core → CLI)

All CLI source files that import from `@sickbay/core` must change to `@nebulord/sickbay-core`.

**Files:**
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/components/App.tsx`
- Modify: `apps/cli/src/components/FixApp.tsx`
- Modify: `apps/cli/src/components/Summary.tsx`
- Modify: `apps/cli/src/components/CheckResult.tsx`
- Modify: `apps/cli/src/components/QuickWins.tsx`
- Modify: `apps/cli/src/components/DiffApp.tsx`
- Modify: `apps/cli/src/components/tui/TuiApp.tsx`
- Modify: `apps/cli/src/components/tui/ScorePanel.tsx`
- Modify: `apps/cli/src/components/tui/HealthPanel.tsx`
- Modify: `apps/cli/src/components/tui/QuickWinsPanel.tsx`
- Modify: `apps/cli/src/components/tui/MonorepoPanel.tsx`
- Modify: `apps/cli/src/components/tui/hooks/useSickbayRunner.ts`
- Modify: `apps/cli/src/commands/web.ts`
- Modify: `apps/cli/src/commands/fix.ts`
- Modify: `apps/cli/src/commands/diff.ts`
- Modify: `apps/cli/src/commands/stats.ts`
- Modify: `apps/cli/src/commands/doctor.ts`
- Modify: `apps/cli/src/commands/init.ts`
- Modify: `apps/cli/src/services/ai.ts`
- Modify: `apps/cli/src/lib/history.ts`
- Modify: `apps/cli/src/lib/resolve-package.ts`

- [ ] **Step 1: Replace all `@sickbay/core` imports in CLI source files**

In every file listed above, replace:
```typescript
from "@sickbay/core"
// or
from '@sickbay/core'
```
with:
```typescript
from "@nebulord/sickbay-core"
// or
from '@nebulord/sickbay-core'
```

Use find-and-replace across the `apps/cli/src/` directory. Preserve the existing quote style in each file.

- [ ] **Step 2: Replace all `@sickbay/core` imports in CLI test files**

Same replacement in all `.test.ts` and `.test.tsx` files under `apps/cli/src/`:
- `apps/cli/src/components/App.test.tsx`
- `apps/cli/src/components/FixApp.test.tsx`
- `apps/cli/src/components/Summary.test.tsx`
- `apps/cli/src/components/CheckResult.test.tsx`
- `apps/cli/src/components/QuickWins.test.tsx`
- `apps/cli/src/components/DiffApp.test.tsx`
- `apps/cli/src/components/tui/TuiApp.test.tsx`
- `apps/cli/src/components/tui/ScorePanel.test.tsx`
- `apps/cli/src/components/tui/HealthPanel.test.tsx`
- `apps/cli/src/components/tui/QuickWinsPanel.test.tsx`
- `apps/cli/src/components/tui/hooks/useSickbayRunner.test.ts`
- `apps/cli/src/commands/web.test.ts`
- `apps/cli/src/commands/fix.test.ts`
- `apps/cli/src/commands/diff.test.ts`
- `apps/cli/src/commands/stats.test.ts`
- `apps/cli/src/commands/doctor.test.ts`
- `apps/cli/src/lib/history.test.ts`
- `apps/cli/src/lib/resolve-package.test.ts`

- [ ] **Step 3: Build and test CLI**

```bash
pnpm --filter @nebulord/sickbay-core build && pnpm --filter @nebulord/sickbay build && pnpm --filter @nebulord/sickbay test
```

Expected: All CLI tests pass.

- [ ] **Step 4: Commit**

```bash
cd apps/cli && git add -A && cd ../..
git commit -m "refactor: update CLI imports from @sickbay/core to @nebulord/sickbay-core"
```

---

### Task 4: Update source code imports (core + constants → web)

Web source files import from `@sickbay/core` (types) and `@sickbay/constants` (values). Both need updating.

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx`
- Modify: `apps/web/src/components/ScoreCard.tsx`
- Modify: `apps/web/src/components/IssuesList.tsx`
- Modify: `apps/web/src/components/CriticalIssues.tsx`
- Modify: `apps/web/src/components/CodebaseStats.tsx`
- Modify: `apps/web/src/components/ChatDrawer.tsx`
- Modify: `apps/web/src/components/About.tsx`
- Modify: `apps/web/src/components/AISummary.tsx`
- Modify: `apps/web/src/components/HistoryChart.tsx`
- Modify: `apps/web/src/components/MonorepoOverview.tsx`
- Modify: `apps/web/src/components/DependencyList.tsx`
- Modify: `apps/web/src/lib/load-report.ts`
- Modify: all corresponding `.test.tsx` / `.test.ts` files in `apps/web/src/`

- [ ] **Step 1: Replace `@sickbay/core` imports in web source files**

In every web source file, replace `@sickbay/core` with `@nebulord/sickbay-core`. These should all be `import type` (the "no Node.js in browser" rule).

- [ ] **Step 2: Replace `@sickbay/constants` imports in web source files**

In the 6 web components that import from `@sickbay/constants`, change to value imports from `@nebulord/sickbay-core`:

```typescript
// from: import { SCORE_EXCELLENT, SCORE_GOOD, SCORE_FAIR } from '@sickbay/constants';
// to:
import { SCORE_EXCELLENT, SCORE_GOOD, SCORE_FAIR } from '@nebulord/sickbay-core';
```

These are plain number constants — no Node.js APIs involved. Vite will tree-shake them.

Files: `Dashboard.tsx`, `ScoreCard.tsx`, `HistoryChart.tsx`, `CodebaseStats.tsx`, `About.tsx`, `MonorepoOverview.tsx`

- [ ] **Step 3: Replace imports in web test files**

Same replacements in all `.test.tsx` / `.test.ts` files under `apps/web/src/`.

- [ ] **Step 4: Update web knip.json**

In `apps/web/knip.json`, change:
```json
"ignoreDependencies": ["@sickbay/core"]
```
to:
```json
"ignoreDependencies": ["@nebulord/sickbay-core"]
```

- [ ] **Step 5: Build and test web**

```bash
pnpm --filter @nebulord/sickbay-core build && pnpm --filter @nebulord/sickbay-web build && pnpm --filter @nebulord/sickbay-web test
```

Expected: All web tests pass. Build succeeds without Node.js module errors.

- [ ] **Step 6: Commit**

```bash
cd apps/web && git add -A && cd ../..
git commit -m "refactor: update web imports from @sickbay/* to @nebulord/*"
```

---

### Task 5: Update config files and knip

**Files:**
- Modify: `knip.json` (root)
- Modify: `tests/snapshots/fixture-regression.test.ts`
- Modify: `tests/snapshots/vitest.config.ts`

- [ ] **Step 1: Update root knip.json**

Replace all `@sickbay/core`, `@sickbay/cli`, `@sickbay/web` with `@nebulord/sickbay-core`, `@nebulord/sickbay`, `@nebulord/sickbay-web` in `ignoreDependencies`.

- [ ] **Step 2: Update snapshot test config**

In `tests/snapshots/vitest.config.ts`, check for any `@sickbay/*` references and update.

In `tests/snapshots/fixture-regression.test.ts`, replace `@sickbay/core` with `@nebulord/sickbay-core`.

- [ ] **Step 3: Update internal core reference in knip runner**

In `packages/core/src/integrations/knip.ts`, check if `@sickbay/cli` is referenced (it is — used to filter workspace siblings). Update to `@nebulord/sickbay`.

- [ ] **Step 4: Run snapshot tests**

```bash
pnpm build && pnpm test:snapshots -- -u
```

Note: Snapshots will need to be updated since report output may include package names. Use `-u` to update them.

- [ ] **Step 5: Commit**

```bash
git add knip.json apps/web/knip.json tests/ packages/core/src/integrations/knip.ts
git commit -m "chore: update config files and snapshots for @nebulord scope"
```

---

### Task 6: Update documentation

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `CLAUDE.md`
- Modify: `packages/core/README.md`
- Modify: `apps/cli/README.md`
- Modify: `apps/web/README.md`
- Modify: `docs/scoring.md`

- [ ] **Step 1: Update README.md**

Replace all `@sickbay/core`, `@sickbay/cli`, `@sickbay/web` with `@nebulord/sickbay-core`, `@nebulord/sickbay`, `@nebulord/sickbay-web`. Add installation section:

```markdown
## Installation

```bash
# Run without installing
npx sickbay --path ~/my-project

# Install globally
npm install -g sickbay

# Or install the scoped package directly
npm install -g @nebulord/sickbay
```
```

Update the clone URL to `https://github.com/nebulord-dev/sickbay`.

- [ ] **Step 2: Update CONTRIBUTING.md**

Replace all `@sickbay/*` references with `@nebulord/*` equivalents.

- [ ] **Step 3: Update CLAUDE.md**

Replace all `@sickbay/*` references with `@nebulord/*` equivalents. This affects build commands, filter examples, and package descriptions.

- [ ] **Step 4: Update per-package READMEs**

In `packages/core/README.md`, `apps/cli/README.md`, `apps/web/README.md`: replace package name references.

- [ ] **Step 5: Update docs/scoring.md**

Replace `@sickbay/constants` reference with note that constants are in `@nebulord/sickbay-core`.

- [ ] **Step 6: Commit**

```bash
git add README.md CONTRIBUTING.md CLAUDE.md packages/core/README.md apps/cli/README.md apps/web/README.md docs/scoring.md
git commit -m "docs: update all references from @sickbay to @nebulord scope"
```

---

### Task 7: Create wrapper package

**Files:**
- Create: `packages/sickbay-wrapper/package.json`
- Create: `packages/sickbay-wrapper/bin.js`

- [ ] **Step 1: Create wrapper directory and package.json**

Create `packages/sickbay-wrapper/package.json`:
```json
{
  "name": "sickbay",
  "version": "0.1.0",
  "description": "Zero-config health check CLI for JavaScript and TypeScript projects",
  "bin": {
    "sickbay": "./bin.js"
  },
  "files": [
    "bin.js"
  ],
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
  },
  "keywords": [
    "health-check",
    "code-quality",
    "security",
    "dependencies",
    "cli",
    "react",
    "node",
    "typescript"
  ]
}
```

- [ ] **Step 2: Create bin.js**

Create `packages/sickbay-wrapper/bin.js`:
```js
#!/usr/bin/env node
import("@nebulord/sickbay");
```

- [ ] **Step 3: Commit**

```bash
git add packages/sickbay-wrapper/
git commit -m "feat: add unscoped sickbay wrapper package for npx sickbay"
```

---

### Task 8: Final verification and full test run

- [ ] **Step 1: Clean install**

```bash
pnpm install
```

- [ ] **Step 2: Full build**

```bash
pnpm build
```

Expected: All 3 packages build successfully.

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: All tests pass across core, cli, and web.

- [ ] **Step 4: Run snapshot tests**

```bash
pnpm test:snapshots
```

Expected: Snapshots up to date and passing.

- [ ] **Step 5: Run lint**

```bash
pnpm lint
```

Expected: No lint errors.

- [ ] **Step 6: Verify no stale @sickbay references in source code**

```bash
grep -r "@sickbay/" --include="*.ts" --include="*.tsx" --include="*.json" packages/ apps/ --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.sickbay | grep -v "last-report\|dep-tree\|history.json\|pnpm-lock"
```

Expected: No results (all references updated). Files in `.sickbay/` cache directories are generated and will update on next scan — ignore those.

- [ ] **Step 7: Commit any remaining fixes**

If any issues found in steps 1-6, fix and commit.

---

### Task 9: Publish to npm

**This task must be done by the user or with user confirmation at each step.**

- [ ] **Step 1: Verify npm login**

```bash
npm whoami
```

Expected: Your npm username.

- [ ] **Step 2: Dry-run publish core**

```bash
pnpm --filter @nebulord/sickbay-core publish --no-git-checks --dry-run
```

Review the output — check package name, version, files included.

- [ ] **Step 3: Publish core**

```bash
pnpm --filter @nebulord/sickbay-core publish --no-git-checks
```

- [ ] **Step 4: Dry-run publish CLI**

```bash
pnpm --filter @nebulord/sickbay publish --no-git-checks --dry-run
```

Review the output.

- [ ] **Step 5: Publish CLI**

```bash
pnpm --filter @nebulord/sickbay publish --no-git-checks
```

- [ ] **Step 6: Publish wrapper**

```bash
cd packages/sickbay-wrapper && npm publish
```

- [ ] **Step 7: Verify published packages**

```bash
npm view @nebulord/sickbay-core version
npm view @nebulord/sickbay version
npm view sickbay version
```

Expected: All show `0.1.0`.

- [ ] **Step 8: Test end-to-end**

```bash
npx sickbay --version
```

Expected: Shows `0.1.0`.

- [ ] **Step 9: Tag the release**

```bash
git tag v0.1.0
git push origin main --tags
```
