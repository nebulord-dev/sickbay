---
description: Prime agent with codebase understanding
---

# Prime: Load Project Context

## Objective

Build comprehensive understanding of the Sickbay monorepo before starting work. This is a pnpm workspace with three packages (`core`, `cli`, `web`) and strict build dependency order.

## Process

### 1. Analyze Project Structure

List all tracked files:
!`git ls-files`

Show directory structure:
!`find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/coverage/*' -not -path '*/.turbo/*' | sort`

### 2. Read Core Documentation

Read in this order — each builds on the previous:

- `CLAUDE.md` — project rules, architecture overview, file navigation guide
- `.claude/kanban.md` — current task board and **roadmap** (phases, what's blocked, what's next)
- `docs/sickbay-monorepo-design.md` — architecture decisions for Phase 3 work
- `packages/core/README.md`, `packages/cli/README.md`, `packages/web/README.md` — per-package implementation details

List available design docs:
!`ls docs/plans/`

Read any plan docs relevant to the current task or phase. At minimum, read any doc whose subject overlaps with what's In Progress or coming next on the roadmap.

### 3. Identify Key Files

Read based on the task at hand:

**If working on checks/scoring:**
- `packages/core/src/types.ts` — core interfaces (`SickbayReport`, `CheckResult`, `Issue`)
- `packages/core/src/runner.ts` — main orchestrator
- `packages/core/src/scoring.ts` — weighted scoring logic
- `packages/core/src/integrations/` — individual check runners

**If working on terminal UI:**
- `packages/cli/src/index.ts` — CLI entry, Commander setup
- `packages/cli/src/components/App.tsx` — root Ink component, UI phases
- `packages/cli/src/components/tui/` — TUI dashboard components

**If working on web dashboard:**
- `packages/web/src/App.tsx` — root component, report loading
- `packages/web/src/components/Dashboard.tsx` — main layout
- `packages/web/src/lib/load-report.ts` — report loading priority logic

**If working on tests:**
- Tests are colocated with source files (e.g. `scoring.test.ts` sits next to `scoring.ts`)
- `packages/core/src/integrations/knip.test.ts` — pattern for testing a runner
- `packages/core/src/integrations/base.test.ts` — pattern for testing base class
- `packages/cli/src/components/QuickWins.test.tsx` — pattern for testing Ink components

**If working on test fixtures:**
- `fixtures/README.md` — fixture structure, intentional issues per package, how to add new fixtures
- `fixtures/packages/react-app/` — moderately healthy React + Vite + TypeScript app
- `fixtures/packages/node-api/` — intentionally broken Node API (secrets, circular deps, outdated deps, no tests, duplicate code)
- Run `sickbay --path fixtures/packages/node-api` to verify checks catch real issues
- Run `sickbay --path fixtures/` to test monorepo detection (Phase 3)

### 4. Understand Current State

Check recent activity:
!`git log -10 --oneline`

Check current branch and status:
!`git status`

## Output Report

Provide a concise summary covering:

### Current State

- Active branch and recent commits
- What phase of the roadmap we're in
- Any blocked tasks or open architectural decisions
- Immediate next actions
- Available design docs in `docs/plans/` and which are relevant to current work

**Make this summary easy to scan — use bullet points and clear headers.**
