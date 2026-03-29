# Resolve Transitive Security Vulnerabilities

## What

Add `pnpm.overrides` for two transitive vulnerabilities found by `pnpm audit`:

| Package | Severity | Patched Version | Path |
|---------|----------|-----------------|------|
| picomatch | high + moderate | `>=4.0.4` | `@typescript-eslint` → `tinyglobby` → `picomatch` |
| brace-expansion | moderate | `>=5.0.5` | `@typescript-eslint` → `minimatch` → `brace-expansion` |

## Steps

1. Add to `pnpm.overrides` in root `package.json`:
   - `"picomatch": ">=4.0.4"`
   - `"brace-expansion": ">=5.0.5"`
2. Run `pnpm install` to update lockfile
3. Run `pnpm audit` — should show 0 vulnerabilities
4. Run `pnpm build` to verify nothing broke
5. Run `pnpm test` to verify nothing broke
6. Update the kanban task description to reflect the actual vulnerabilities fixed (the original description references minimatch/rollup which are already resolved)
7. Dispatch monorepo-architect agent for a final review
