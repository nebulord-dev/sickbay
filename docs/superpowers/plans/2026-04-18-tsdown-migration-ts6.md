# tsdown Migration & TypeScript 6 Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unmaintained tsup with tsdown and upgrade TypeScript from 5.9 to 6.

**Architecture:** Two sequential changes — build tool swap first (tsdown), then compiler upgrade (TS 6). Each gets its own commit so regressions are isolated.

**Tech Stack:** tsdown 0.21.x (Rolldown-based bundler), TypeScript 6.0.x

**Spec:** `docs/superpowers/specs/2026-04-18-tsdown-migration-ts6-design.md`

---

### Task 1: Swap tsup for tsdown in the catalog and all package.json files

**Files:**
- Modify: `pnpm-workspace.yaml:10`
- Modify: `package.json:42`
- Modify: `packages/core/package.json:24-25,46`
- Modify: `apps/cli/package.json:28-29,63,67`

- [ ] **Step 1: Update pnpm-workspace.yaml catalog**

Replace:
```yaml
  tsup: ^8.5.1
```
With:
```yaml
  tsdown: ^0.21.9
```

- [ ] **Step 2: Update root package.json**

In `devDependencies`, replace:
```json
"tsup": "catalog:",
```
With:
```json
"tsdown": "catalog:",
```

- [ ] **Step 3: Update packages/core/package.json**

In `scripts`, replace:
```json
"build": "tsup",
"dev": "tsup --watch",
```
With:
```json
"build": "tsdown",
"dev": "tsdown --watch",
```

In `devDependencies`, replace:
```json
"tsup": "catalog:",
```
With:
```json
"tsdown": "catalog:",
```

- [ ] **Step 4: Update apps/cli/package.json**

In `scripts`, replace:
```json
"build": "tsup",
"dev": "tsup --watch",
```
With:
```json
"build": "tsdown",
"dev": "tsdown --watch",
```

In `devDependencies`, replace:
```json
"tsup": "catalog:",
```
With:
```json
"tsdown": "catalog:",
```

Update `_bundleNote`:
```json
"_bundleNote": "tsdown bundles sickbay-core inline (see tsdown.config.ts deps.alwaysBundle). Core's runtime deps are mirrored in `dependencies` below so the bundled require() calls resolve at runtime. Do NOT delete entries that look unused from cli source — they are needed by core's bundled code. Drift is enforced by `pnpm check:bundled-deps` (scripts/check-bundled-deps.mjs)."
```

- [ ] **Step 5: Install dependencies**

Run: `pnpm install`
Expected: lockfile updates, no errors.

---

### Task 2: Migrate config files from tsup to tsdown

**Files:**
- Delete: `packages/core/tsup.config.ts`
- Create: `packages/core/tsdown.config.ts`
- Delete: `apps/cli/tsup.config.ts`
- Create: `apps/cli/tsdown.config.ts`

- [ ] **Step 1: Create packages/core/tsdown.config.ts**

```ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
});
```

- [ ] **Step 2: Delete packages/core/tsup.config.ts**

Run: `rm packages/core/tsup.config.ts`

- [ ] **Step 3: Create apps/cli/tsdown.config.ts**

```ts
import { cpSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { defineConfig } from 'tsdown';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  entry: ['src/index.ts', 'src/config.ts'],
  dts: true,
  deps: {
    alwaysBundle: ['sickbay-core'],
    neverBundle: ['jiti'],
  },
  define: {
    __VERSION__: JSON.stringify(version),
  },
  async onSuccess() {
    const webDist = join(process.cwd(), '..', 'web', 'dist');
    const targetDir = join(process.cwd(), 'dist', 'web');
    if (existsSync(webDist)) {
      cpSync(webDist, targetDir, { recursive: true });
    }
  },
});
```

- [ ] **Step 4: Delete apps/cli/tsup.config.ts**

Run: `rm apps/cli/tsup.config.ts`

---

### Task 3: Update supporting files (comments, docs, knip config)

**Files:**
- Modify: `scripts/check-bundled-deps.mjs:9-10,79-80`
- Modify: `apps/cli/knip.config.ts:3-6`
- Modify: `knip.json:15,27`

- [ ] **Step 1: Update scripts/check-bundled-deps.mjs comments**

Line 9-10, replace:
```
 * `apps/cli` bundles `packages/core` inline at build time via tsup's
 * `noExternal: ['sickbay-core']` (see apps/cli/tsup.config.ts).
```
With:
```
 * `apps/cli` bundles `packages/core` inline at build time via tsdown's
 * `deps.alwaysBundle: ['sickbay-core']` (see apps/cli/tsdown.config.ts).
```

Line 79-80, replace:
```
console.error("  Why this matters: tsup bundles core inline into cli, so core's");
```
With:
```
console.error("  Why this matters: tsdown bundles core inline into cli, so core's");
```

- [ ] **Step 2: Update apps/cli/knip.config.ts comment**

Replace:
```ts
// These deps are declared in package.json because tsup bundles sickbay-core
// inline (noExternal), so core's require() calls resolve against cli's
// node_modules at runtime. Knip can't see this from src/ imports alone.
// Source of truth: scripts/check-bundled-deps.mjs (runs in CI).
```
With:
```ts
// These deps are declared in package.json because tsdown bundles sickbay-core
// inline (deps.alwaysBundle), so core's require() calls resolve against cli's
// node_modules at runtime. Knip can't see this from src/ imports alone.
// Source of truth: scripts/check-bundled-deps.mjs (runs in CI).
```

- [ ] **Step 3: Update knip.json**

Replace all `"tsup"` entries in `ignoreDependencies` arrays with `"tsdown"` (appears at lines 15 and 27).

---

### Task 4: Update documentation references

**Files:**
- Modify: `CLAUDE.md` (tsup references)
- Modify: `apps/cli/README.md` (build tool reference)
- Modify: `packages/core/README.md` (build tool reference)
- Modify: `apps/docs/guide/credits.md` (credit entry)
- Modify: `.claude/skills/review-project/SKILL.md`
- Modify: `.claude/skills/audit-architecture/SKILL.md`

- [ ] **Step 1: Update CLAUDE.md**

Replace all references to `tsup` with `tsdown` throughout the file. Key locations:
- Build system section: "tsup for core/cli" → "tsdown for core/cli"
- Bundling section: references to `tsup.config.ts`, `noExternal` → `tsdown.config.ts`, `deps.alwaysBundle`
- Any mentions of `tsup` in code examples or file listings

- [ ] **Step 2: Update apps/cli/README.md**

Replace `tsup` with `tsdown` in build tool references (e.g. `pnpm build   # tsup → dist/` becomes `pnpm build   # tsdown → dist/`).

- [ ] **Step 3: Update packages/core/README.md**

Replace `tsup` with `tsdown` in build tool references (e.g. `pnpm build   # tsup → dist/` becomes `pnpm build   # tsdown → dist/`).

- [ ] **Step 4: Update apps/docs/guide/credits.md**

Replace the tsup credit entry:
```markdown
| [tsup](https://github.com/egoist/tsup)          | EGOIST                           | TypeScript bundling for core and CLI |
```
With:
```markdown
| [tsdown](https://tsdown.dev/)                    | EGOIST                           | TypeScript bundling for core and CLI |
```

- [ ] **Step 5: Update .claude/skills/review-project/SKILL.md**

Replace `tsup` with `tsdown`.

- [ ] **Step 6: Update .claude/skills/audit-architecture/SKILL.md**

Replace `tsup` → `tsdown` and `noExternal` → `deps.alwaysBundle`.

---

### Task 5: Build, test, and verify the tsdown migration

- [ ] **Step 1: Build all packages**

Run: `pnpm build`
Expected: clean build, no errors. Both `packages/core/dist/` and `apps/cli/dist/` produce output.

- [ ] **Step 2: Run bundled-deps check**

Run: `pnpm check:bundled-deps`
Expected: `✓ apps/cli mirrors all N runtime deps from packages/core`

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 4: Spot-check CLI**

Run: `node apps/cli/dist/index.js --help`
Expected: CLI help output displays correctly.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: migrate tsup to tsdown

tsup is unmaintained; the author recommends tsdown (Rolldown-based).
Configs are minimal so migration is straightforward:
- noExternal → deps.alwaysBundle
- external → deps.neverBundle
- format/dts/clean are tsdown defaults"
```

---

### Task 6: Upgrade TypeScript to 6

**Files:**
- Modify: `pnpm-workspace.yaml:11`
- Modify: `tsconfig.base.json:8`

- [ ] **Step 1: Update tsconfig.base.json**

Add `"types": ["node"]` and remove `"esModuleInterop": true`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["node"]
  }
}
```

- [ ] **Step 2: Update catalog**

In `pnpm-workspace.yaml`, replace:
```yaml
  typescript: ^5.9.3
```
With:
```yaml
  typescript: ^6.0.3
```

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: TypeScript 6.0.x resolves, lockfile updates.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: clean build. If new type errors surface, fix them before proceeding.

- [ ] **Step 5: Run tests**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: upgrade TypeScript to 6

- Add explicit types: ['node'] (TS 6 defaults types to [])
- Remove esModuleInterop (always-on in TS 6)
- Bump catalog from ^5.9.3 to ^6.0.3"
```

---

### Task 7: Monorepo architect review

- [ ] **Step 1: Dispatch monorepo-architect agent**

Run the `monorepo-architect` agent to verify no boundary violations or dependency order issues were introduced by the migration.

- [ ] **Step 2: Fix any findings**

Address issues before finalizing the branch.
