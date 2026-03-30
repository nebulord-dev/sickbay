# Plan: Resolve Transitive Security Vulnerabilities

## Spec

Read the lightweight spec at `docs/superpowers/specs/2026-03-28-resolve-transitive-vulnerabilities-design.md`.

## Kanban Task

Move this task to Done when complete (update the description to reflect the actual vulnerabilities fixed):

```
- `[Security]` `[Auto]` Resolve transitive `minimatch` ReDoS vulnerabilities before publishing
```

The current description references `minimatch` and `rollup` which are already resolved via existing overrides. Update the Done entry to reflect the actual vulnerabilities fixed (picomatch, brace-expansion).

## Steps

### 1. Add pnpm overrides

**Edit:** `package.json` (root)

Add to the existing `pnpm.overrides` object:

```json
"picomatch": ">=4.0.4",
"brace-expansion": ">=5.0.5"
```

These go alongside the existing `minimatch`, `@types/minimatch`, `rollup`, and `prismjs` overrides.

### 2. Install updated dependencies

```bash
pnpm install
```

### 3. Verify audit passes

```bash
pnpm audit
```

Should show 0 vulnerabilities.

### 4. Verify build and tests pass

```bash
pnpm build
pnpm test
```

Fix any failures (unlikely — these are transitive dep version bumps).

### 5. Dispatch monorepo-architect agent

Run the monorepo-architect agent to review changes.

### 6. Update kanban and commit

Move the security task to Done in `.claude/kanban.md`. Update the Done entry description to say: "Resolved transitive picomatch ReDoS and brace-expansion DoS vulnerabilities via pnpm.overrides; also includes previously resolved minimatch, rollup, and prismjs overrides."

Commit with a descriptive message.
