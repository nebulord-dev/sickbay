# Plan: Audit `sickbay fix` Executable Commands

## Spec

Read the full design spec at `docs/superpowers/specs/2026-03-28-audit-sickbay-fix-commands-design.md` before starting. It contains the complete runner classification, type changes, confirmation flow, and file-by-file modification list.

## Kanban Task

Move this task to Done when complete:

```
- `[Quality]` `[Auto]` Audit `sickbay fix` executable commands
```

## Steps

### 1. Read the spec and all affected files

Read the spec thoroughly. Then read every file listed in the "Files to Modify" section to understand the current code before making changes.

### 2. Update `FixSuggestion` type in core

**File:** `packages/core/src/types.ts`

Add two new optional fields to the `FixSuggestion` interface:

- `modifiesSource?: boolean`
- `nextSteps?: string`

### 3. Strip commands from guidance-only runners

For each runner listed under "Strip `command`" in the spec:

- **`packages/core/src/integrations/knip.ts`** — remove `command` from unused file, unused dep, and unused devDep issues. Keep `description`.
- **`packages/core/src/integrations/depcheck.ts`** — remove `command` from missing dep issues. Keep `description`.
- **`packages/core/src/integrations/npm-audit.ts`** — remove `command` from both `npm audit fix` and `npm audit fix --force` issues. Keep descriptions.
- **`packages/core/src/integrations/node-async-errors.ts`** — remove `command` from the unprotected-handlers issue (the one with `command: 'npm install express-async-errors'`). The error-middleware suggestion is already guidance-only.
- **`packages/core/src/integrations/source-map-explorer.ts`** — remove the `command` ternary from both fix objects entirely. Merge the source-map hint into `description` for the no-source-maps case.

### 4. Add `modifiesSource` and `nextSteps` to kept runners

- **`packages/core/src/integrations/eslint.ts`** — add `modifiesSource: true` to all `eslint --fix` fix objects.
- **`packages/core/src/integrations/node-security.ts`** — add `nextSteps` to each of the three commands (helmet, cors, rate-limit) with the manual wiring instructions from the spec.
- **`packages/core/src/integrations/node-input-validation.ts`** — add `nextSteps: "Add input validation schemas to all incoming request data"`.
- **`packages/core/src/integrations/outdated.ts`** — add `nextSteps: "Run tests to verify nothing broke"`.

### 5. Update `FixableIssue` and `collectFixableIssues` in CLI

**File:** `apps/cli/src/commands/fix.ts`

- Make `command` optional in `FixableIssue` interface (`command?: string`)
- Update `collectFixableIssues()` to include guidance-only issues (issues with `fix.description` but no `fix.command`)
- Use `fix.command ?? fix.description` as the deduplication key
- Add early-return guard in `executeFix()` if `fix.command` is undefined

### 6. Update `FixApp.tsx` with confirmations and guidance display

**File:** `apps/cli/src/components/FixApp.tsx`

- Add confirmation prompt state that gates execution of each selected fix
- All commands get a Y/n prompt before execution
- Use tier-2 warning wording ("This will modify source files") when `issue.fix.modifiesSource` is true
- `--apply-all` skips Tier 1 confirmations but still shows Tier 2
- Print `nextSteps` after successful execution
- Render guidance-only items (no command) as non-actionable info items — no checkbox, dimmed, info icon
- Guard all `.command` references:
  - Line ~329: conditionally render `({fix.command})` text only when defined
  - Lines ~367, ~416: change React keys to use `r.fixable.command ?? r.fixable.issue.fix?.description`

### 7. Update tests

- **`apps/cli/src/commands/fix.test.ts`** — update for new `collectFixableIssues` logic (guidance-only inclusion, dedup key change)
- **`apps/cli/src/components/FixApp.test.tsx`** — add tests for:
  - Confirmation prompt rendering and acceptance/rejection
  - Tier-2 warning display when `modifiesSource` is true
  - `nextSteps` display after successful execution
  - Guidance-only item rendering (no command, dimmed, non-interactive)
- Update integration tests for runners whose fix objects changed

### 8. Build and test

```bash
pnpm build
pnpm test
pnpm lint
```

Fix any failures.

### 9. Dispatch monorepo-architect agent

Run the monorepo-architect agent to review all changes for boundary violations before committing.

### 10. Update kanban and commit

Move the kanban task to Done in `.claude/kanban.md`. Commit all changes with a descriptive message.
