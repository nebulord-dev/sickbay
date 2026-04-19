# Migrate tsup → tsdown and upgrade TypeScript to 6

## Context

Sickbay uses tsup to bundle `packages/core` and `apps/cli`. tsup is unmaintained — the author recommends tsdown, which is Rolldown-based and supports TypeScript 6. We're on TypeScript 5.9.3 and want to upgrade to 6, but tsup blocks that. Migrating the build tool unblocks the TS upgrade.

## Scope

Two commits on the current branch (`claude-cleanup`), in order:

1. **tsup → tsdown** — build tool swap
2. **TypeScript 5.9 → 6** — compiler upgrade

Splitting them keeps build tool issues isolated from type-checking issues.

## Part 1: tsup → tsdown

### Config files

**`packages/core/tsup.config.ts` → `tsdown.config.ts`**

Current config sets `entry`, `format: ['esm']`, `dts: true`, `clean: true`. These are all tsdown defaults, but we keep `dts: true` explicit for resilience against future default changes:

```ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
});
```

**`apps/cli/tsup.config.ts` → `tsdown.config.ts`**

Option mapping:

| tsup | tsdown |
|------|--------|
| `noExternal: ['sickbay-core']` | `deps: { alwaysBundle: ['sickbay-core'] }` |
| `external: ['jiti']` | `deps: { neverBundle: ['jiti'] }` |
| `format: ['esm']` | default |
| `dts: true` | keep explicit — CLI has no top-level `types` field in package.json, only inside `exports`, so tsdown's auto-detection may not trigger |
| `clean: true` | default |
| `entry`, `define` | unchanged |
| `onSuccess(fn)` | keep as-is — tsdown's `onSuccess` passes `(config, signal)` args but the existing zero-arg function safely ignores them |

### Package manifest changes

- **`pnpm-workspace.yaml` catalog**: replace `tsup: ^8.5.1` with `tsdown: ^<latest>`
- **`packages/core/package.json`**: swap `tsup` → `tsdown` in devDependencies, update build/dev scripts
- **`apps/cli/package.json`**: swap `tsup` → `tsdown` in devDependencies, update build/dev scripts, update `_bundleNote` comment
- **Root `package.json`**: swap `tsup` → `tsdown` in devDependencies

### Supporting file updates

All are comment/doc changes, no logic changes:

- `scripts/check-bundled-deps.mjs` — update comments referencing tsup/noExternal → tsdown/alwaysBundle
- `apps/cli/knip.config.ts` — update comment
- `knip.json` — change `tsup` → `tsdown` in `ignoreDependencies`
- `CLAUDE.md` — update build tool references
- `apps/cli/README.md` — update build tool references
- `packages/core/README.md` — update build tool references
- `apps/docs/guide/credits.md` — update credit entry
- `.claude/skills/review-project/SKILL.md` — update tsup reference
- `.claude/skills/audit-architecture/SKILL.md` — update tsup reference

### Verification

- `pnpm install` succeeds
- `pnpm build` produces correct output in `dist/` for both packages
- `pnpm check:bundled-deps` passes
- `pnpm test` passes

## Part 2: TypeScript 6

### tsconfig changes

**`tsconfig.base.json`:**
- Add `"types": ["node"]` — TS 6 defaults `types` to `[]`, so ambient `@types/*` packages no longer auto-discover
- Remove `"esModuleInterop": true` — always-on in TS 6, now redundant

### Catalog bump

- `pnpm-workspace.yaml`: change `typescript: ^5.9.3` to `typescript: ^6.0.0`

### What's already compatible

- **Vite**: TS 6 support merged
- **Vitest**: uses esbuild/SWC for transpilation, not tsc
- **React 19 / Ink**: runtime libraries, unaffected
- **Fixture packages**: pin their own TS versions independently (`~5.4.0`, `~5.9.3`)

### Verification

- `pnpm install` succeeds
- `pnpm build` succeeds (no new type errors)
- `pnpm test` passes
- `pnpm test:snapshots` passes (if applicable)

## Extension handling

tsdown defaults to `.mjs`/`.d.mts` extensions for ESM output, unlike tsup which used `.js`/`.d.ts`. Since both packages have `"type": "module"` in package.json and existing exports point to `.js`/`.d.ts` files, both configs need `outExtensions: () => ({ js: '.js', dts: '.d.ts' })` to preserve the existing file extensions.

## Risk assessment

**Low risk.** Both tsup configs are minimal with no exotic features. The tsdown migration guide covers all options we use. TS 6's breaking changes (types default, esModuleInterop removal) are well-documented and our codebase is already aligned with the new defaults.

The main thing to watch: `deps.alwaysBundle` must replicate `noExternal` behavior for the CLI's inline-bundling of sickbay-core. The `check:bundled-deps` script validates this invariant.

## Follow-ups

- Update parent `CLAUDE.md` at `/Users/tracericochet/Desktop/nebulord/CLAUDE.md` — shared stack table references tsup. This is outside the sickbay git repo so it's a separate change.
