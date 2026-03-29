# Audit `sickbay fix` Executable Commands

## Goal

Classify every fix command across all runners as safe-to-automate or guidance-only. Strip commands from guidance-only fixes, add confirmation prompts before execution, and add "Next steps" hints where an install alone doesn't fully resolve the issue.

## Problem

`sickbay fix` currently runs all fix commands without distinguishing between safe operations (installing a package) and risky ones (deleting files based on static analysis with known false-positive rates). Some commands are guidance-only text strings masquerading as shell commands. There are no confirmation prompts before execution.

## Runner Classification

### Keep `command` (genuinely auto-applicable)

| Runner | Command | `modifiesSource` | `nextSteps` |
|--------|---------|-------------------|-------------|
| **coverage** | `${pm} add -D @vitest/coverage-v8` | `false` | — |
| **git** | `git remote prune origin` | `false` | — |
| **eslint** | `eslint ${file} --fix` | `true` | — |
| **outdated** | `${pm} update ${pkg}` | `false` | `Run tests to verify nothing broke` (note: for major-version-behind packages, `update` stays within semver range and may be a no-op — this is acceptable; forcing major upgrades is out of scope) |
| **node-security** | `npm install helmet` | `false` | `Add app.use(helmet()) before your routes` |
| **node-security** | `npm install cors` | `false` | `Configure allowed origins explicitly with cors({ origin: [...] })` |
| **node-security** | `npm install express-rate-limit` | `false` | `Configure rate limits per route or globally` |
| **node-input-validation** | `npm install zod` | `false` | `Add input validation schemas to all incoming request data` |

### Strip `command` (guidance-only — keep `fix.description`)

| Runner | Current Command | Why |
|--------|----------------|-----|
| **knip** | `rm ${filePath}` | False positives common — deleting files is irreversible |
| **knip** | `${pm} remove ${dep}` | False positives in monorepos — removing deps can break builds |
| **depcheck** | `npm install ${dep}` | High false positive rate, especially in monorepos |
| **npm-audit** | `npm audit fix` | Can break builds by upgrading transitive deps unexpectedly |
| **npm-audit** | `npm audit fix --force` | Forces major version bumps on transitive deps |
| **node-async-errors** | `npm install express-async-errors` | Changes Express error handling fundamentally — needs deliberate adoption |
| **source-map-explorer** | Conditional description strings (not shell commands) | In the fallback branch (no source maps), `command` is set to a description string like `"Enable source maps..."` rather than a shell command. Remove `command` from both fix objects in the fallback branch. Incorporate the source-map hint into `description` instead. |

### Already guidance-only (no changes needed)

These runners already produce `fix.description` without a `command`. No modifications required, but they will appear in the guidance-only section of the `sickbay fix` UI.

| Runner | Fix Description |
|--------|----------------|
| **jscpd** | "Extract duplicated code into shared utilities or components" |
| **complexity** | "Extract concerns into smaller, focused files" |
| **secrets** | "Move secrets to environment variables" (has `codeChange`) |
| **react-perf** | Various pattern-specific descriptions |
| **madge** | "Refactor to break the circular dependency cycle" |
| **license-checker** | "Review or replace ${pkg}" |
| **heavy-deps** | "Consider replacing with ${alternative}" |
| **asset-size** | Multiple compression/optimization descriptions |

## Type Changes

In `packages/core/src/types.ts`, update the `FixSuggestion` interface (note: the type is called `FixSuggestion`, not `Fix`):

```typescript
export interface FixSuggestion {
  command?: string;          // already optional — no change
  description: string;
  modifiesSource?: boolean;  // NEW — true for commands that modify source files (e.g. eslint --fix)
  nextSteps?: string;        // NEW — shown after successful execution
  codeChange?: {             // existing — no change
    before: string;
    after: string;
  };
}
```

## CLI Changes

### `FixableIssue` interface in `apps/cli/src/commands/fix.ts`

Update to support guidance-only issues:

```typescript
export interface FixableIssue {
  issue: Issue;
  checkId: string;
  checkName: string;
  command?: string;  // was required `string`, now optional
}
```

### `collectFixableIssues()` in `apps/cli/src/commands/fix.ts`

Change the filter logic to include issues with `fix.description` but no `fix.command`:

```typescript
// Before:
if (issue.fix?.command && !seen.has(issue.fix.command)) {
  seen.add(issue.fix.command);
  ...
}

// After:
if (issue.fix) {
  const dedupeKey = issue.fix.command ?? issue.fix.description;
  if (!seen.has(dedupeKey)) {
    seen.add(dedupeKey);
    fixable.push({
      issue,
      checkId: check.id,
      checkName: check.name,
      command: issue.fix.command,  // undefined for guidance-only
    });
  }
}
```

### Confirmation flow in `FixApp.tsx`

**Two-tier confirmation prompts** — all commands get a Y/n confirmation before execution:

**Tier 1 — Package/git operations** (`modifiesSource` is `false` or absent):
```
Install helmet (npm install helmet)
→ Proceed? (Y/n)
```

**Tier 2 — Source code modifications** (`modifiesSource` is `true`):
```
Fix ESLint issues in src/App.tsx (eslint src/App.tsx --fix)
⚠ This will modify source files. Proceed? (Y/n)
```

**Implementation:** Add a confirmation state to `FixApp.tsx` that gates execution. After the user selects fixes to apply (existing checkbox flow), each selected fix gets a sequential confirmation prompt before execution. Use the existing `useInput` handler pattern already in `FixApp.tsx`.

**`--apply-all` interaction:** When `--apply-all` is passed, skip Tier 1 confirmations but still show Tier 2 confirmations (source-modifying commands). This keeps the fast-path useful while protecting against unintended source changes.

### After successful execution

If `fix.nextSteps` is present on the issue's fix object, print it:
```
✔ Installed helmet
  → Next: Add app.use(helmet()) before your routes
```

### Guidance-only issues in the UI

Issues with `fix.description` but no `fix.command` appear in the interactive list but are visually distinct — no checkbox, dimmed text, prefixed with an info icon. They are displayed as non-actionable guidance to inform the user what they could do manually.

## Files to Modify

### `packages/core/src/types.ts`
- Add `modifiesSource?: boolean` and `nextSteps?: string` to `FixSuggestion` interface

### `packages/core/src/integrations/knip.ts`
- Remove `command` from unused file issues (keep `description: "Remove ${filePath}"`)
- Remove `command` from unused dep/devDep issues (keep `description: "Remove ${dep}"`)

### `packages/core/src/integrations/depcheck.ts`
- Remove `command` from missing dep issues (keep `description: "Install ${dep}"`)

### `packages/core/src/integrations/npm-audit.ts`
- Remove `command` from both `npm audit fix` and `npm audit fix --force` issues
- Keep descriptions as guidance

### `packages/core/src/integrations/node-async-errors.ts`
- Remove `command` from the unprotected-handlers issue (line ~122-124, the one with `command: 'npm install express-async-errors'`)
- The error-middleware suggestion (line ~133-135) is already guidance-only — no changes needed
- Keep descriptions on both

### `packages/core/src/integrations/source-map-explorer.ts`
- Remove the `command` ternary from both fix objects (lines ~199 and ~212) entirely — when source maps exist it's already `undefined`, when they don't it's a description string, not a shell command
- For the no-source-maps case, merge the hint ("Enable source maps...") into the `description` field

### `packages/core/src/integrations/node-security.ts`
- Keep all three commands (helmet, cors, rate-limit)
- Add `nextSteps` to each with the manual wiring instructions

### `packages/core/src/integrations/node-input-validation.ts`
- Keep command (`npm install zod`)
- Add `nextSteps: "Add input validation schemas to all incoming request data"`

### `packages/core/src/integrations/outdated.ts`
- Keep command (`${pm} update ${pkg}`)
- Add `nextSteps: "Run tests to verify nothing broke"`

### `packages/core/src/integrations/eslint.ts`
- Add `modifiesSource: true` to all `eslint --fix` fix objects

### Runners with no fix objects (no changes needed)
- `typescript.ts` and `todo-scanner.ts` produce no fix suggestions — no modifications required

### `apps/cli/src/commands/fix.ts`
- Make `command` optional in `FixableIssue` interface
- Update `collectFixableIssues()` to include guidance-only issues (fix with description but no command)
- Use `fix.command ?? fix.description` as deduplication key
- Add early-return guard in `executeFix()` if `fix.command` is undefined — callers should filter guidance-only issues before calling, but defend against it at this level too

### `apps/cli/src/components/FixApp.tsx`
- Add confirmation prompt state that gates execution of each selected fix
- Use tier-2 warning wording when `issue.fix.modifiesSource` is true
- Print `nextSteps` after successful execution
- Render guidance-only items (no command) as non-actionable info items — no checkbox, dimmed, info icon
- Guard all `.command` references for the now-optional field, specifically:
  - **Line ~329**: conditionally render the `({fix.command})` text only when `command` is defined
  - **Lines ~367, ~416**: React `key` props use `r.fixable.command` — change to `r.fixable.command ?? r.fixable.issue.fix?.description` to avoid duplicate `"checkId-undefined"` keys

### Web dashboard — no changes required
- `apps/web/src/components/IssuesList.tsx` already conditionally renders `fix.command` — it will simply not show a command button for guidance-only fixes. `nextSteps` display in web is a follow-up, not part of this task.
- `apps/web/src/components/MonorepoOverview.tsx` already uses `fix.command ?? fix.description` for deduplication — no changes needed.

### TUI — `QuickWinsPanel.tsx`
- `apps/cli/src/components/tui/QuickWinsPanel.tsx` filters on `issue.fix?.command` (line 66). This means guidance-only issues won't appear in quick wins. **This is intentional** — quick wins should only show actionable fixes. No changes needed.
- `apps/cli/src/components/QuickWins.tsx` — same logic, same conclusion. No changes needed.

### Tests

- `apps/cli/src/commands/fix.test.ts` — update for new `collectFixableIssues` logic (guidance-only inclusion, deduplication key change)
- `apps/cli/src/components/FixApp.test.tsx` — add tests for:
  - Confirmation prompt rendering and acceptance/rejection
  - Tier-2 warning display when `modifiesSource` is true
  - `nextSteps` display after successful execution
  - Guidance-only item rendering (no command, dimmed, non-interactive)
- Update existing integration tests for runners whose fix objects changed (stripped commands, added `modifiesSource`/`nextSteps`)
