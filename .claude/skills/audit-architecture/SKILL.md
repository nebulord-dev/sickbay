---
name: audit-architecture
description: Use when auditing Sickbay's monorepo architecture for boundary violations, dependency order problems, bundled-deps drift, or cross-package import issues. Run before merging large feature branches or after adding new packages.
---

# Audit: Monorepo Architecture

Dispatch the `monorepo-architect` agent to review structural integrity across all Sickbay packages.

## Checklist

### 1. Package Boundary Violations

**Critical rule:** `apps/web` must NEVER import values from `sickbay-core`. Only `import type` is allowed — value imports would bundle Node.js modules (execa, fs, etc.) into the browser build.

- Search `apps/web/src/` for any `from 'sickbay-core'` that is NOT `import type`
- Search for any `require('sickbay-core')` in web
- Check `apps/web/src/lib/constants.ts` — constants that needed core values should be duplicated here (not imported)

### 2. Dependency Order

The enforced build order is: `packages/core` → `apps/cli` → `apps/web`

- `packages/core` must not import from `apps/cli` or `apps/web`
- `apps/cli` must not import from `apps/web`
- Check `turbo.json` pipeline — `dependsOn` must reflect this order
- Check `pnpm-workspace.yaml` — no circular workspace references

### 3. Bundled-Deps Mirror Invariant

`apps/cli` bundles `sickbay-core` inline via tsup `noExternal`. Every runtime dep of core must also appear in `apps/cli/package.json` dependencies with matching version ranges.

- Run `pnpm check:bundled-deps` — must pass with zero drift
- Compare `packages/core/package.json` dependencies vs `apps/cli/package.json` dependencies manually
- Check `apps/cli/knip.config.ts` `ignoreDependencies` list matches core's deps exactly

### 4. Circular Dependencies Within Packages

- Run `pnpm --filter sickbay-core exec madge --circular src/` — must return no cycles
- Run `pnpm --filter sickbay exec madge --circular src/` — same
- Pay attention to `src/integrations/` — runners must not import from each other

### 5. Type Export Discipline

- `packages/core/src/index.ts` — check what's exported. Types should be exported; internal implementation should not leak
- `apps/cli` imports from `sickbay-core` — verify these are workspace imports, not relative path hacks

### 6. New Package Registration

If any new package was added since last audit:
- Is it in `pnpm-workspace.yaml`?
- Is it in `turbo.json` with correct `dependsOn`?
- Does it have its own `tsconfig.json` extending `tsconfig.base.json`?
- Does `scripts/check-bundled-deps.mjs` need updating?

## How to Run

```
Use the monorepo-architect agent. Provide it this checklist and the current
state of: turbo.json, pnpm-workspace.yaml, packages/core/package.json,
apps/cli/package.json, apps/cli/knip.config.ts, apps/web/src/lib/constants.ts
```

## Known Historical Issues

- Web constants: `apps/web/src/lib/constants.ts` was created specifically to avoid importing values from core. If you see score thresholds or category weights duplicated there, that's intentional — not a bug.
- Windows path handling: any code computing relative paths must use `relativeFromRoot()` from `core/src/utils/file-helpers.ts`, never string replace with `/`.
- The bundled-deps mirror is structural and unavoidable while core is private and sickbay ships as one package. Don't "fix" it by making core public.
