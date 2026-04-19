---
name: prime
description: Prime agent with codebase understanding
---

# Prime: Load Project Context

## Objective

Build comprehensive understanding of the Sickbay monorepo before starting work. This is a pnpm workspace with one foundation package (`core`), three apps (`cli`, `web`, `docs`), and strict build dependency order.

## Process

### 1. Analyze Project Structure

List all tracked files:
!`git ls-files`

Show directory structure:
!`find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/coverage/*' -not -path '*/.turbo/*' | sort`

### 2. Read Core Documentation

Read in this order — each builds on the previous:

- `CLAUDE.md` — project rules, architecture overview, file navigation guide
- Jira board ([KAN project](https://nebulord.atlassian.net/jira/software/projects/KAN/boards/1), epic KAN-5) — current tasks, roadmap phases, what's blocked. Use Atlassian Rovo MCP tools to query.
- `packages/core/README.md`, `apps/cli/README.md`, `apps/web/README.md` — per-package implementation details

### 3. Identify Key Files

Read based on the task at hand:

**If working on checks/scoring:**

- `packages/core/src/types.ts` — core interfaces (`SickbayReport`, `CheckResult`, `Issue`)
- `packages/core/src/runner.ts` — main orchestrator
- `packages/core/src/scoring.ts` — weighted scoring logic
- `packages/core/src/config.ts` — user config (`sickbay.config.ts`) loading and validation
- `packages/core/src/integrations/` — individual check runners (pass/fail signals)
- `packages/core/src/advisors/` — best-practice advisors (recommendations, parallel to runners)
- `packages/core/src/utils/suppress.ts` — suppress rule evaluation (affects which issues reach the report)

**If working on terminal UI:**

- `apps/cli/src/index.ts` — CLI entry, Commander setup
- `apps/cli/src/components/App.tsx` — root Ink component, UI phases
- `apps/cli/src/components/tui/` — TUI dashboard components + hooks

**If working on a specific subcommand:**

- `apps/cli/src/commands/fix.ts` — **modifies user files** (highest-risk)
- `apps/cli/src/commands/init.ts` — writes `sickbay.config.ts`
- `apps/cli/src/commands/web.ts` — HTTP server for the `--web` dashboard
- `apps/cli/src/commands/claude.ts` + `apps/cli/src/services/ai.ts` — CLI AI integration
- `apps/cli/src/commands/doctor.ts` — environment diagnostics (largest subcommand)
- `apps/cli/src/commands/{diff,stats,trend,badge}.ts` — report comparison and output formats

**If working on web dashboard:**

- `apps/web/src/App.tsx` — root component, report loading
- `apps/web/src/components/Dashboard.tsx` — main layout
- `apps/web/src/lib/load-report.ts` — report loading priority logic

**If working on tests:**

- Tests are colocated with source files (e.g. `scoring.test.ts` sits next to `scoring.ts`)
- `packages/core/src/integrations/knip.test.ts` — pattern for testing a runner
- `packages/core/src/integrations/base.test.ts` — pattern for testing base class
- `apps/cli/src/components/QuickWins.test.tsx` — pattern for testing Ink components
- `tests/snapshots/fixture-regression.test.ts` — cross-package snapshot regression suite; run via `pnpm test:snapshots` after any runner / advisor / scoring change

**If working on documentation site:**

- `apps/docs/` — VitePress site deployed to nebulord-dev.github.io/sickbay

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

### 5. Before Merging

Match the work to an audit skill and run it before committing:

- `/audit-core` — any change under `packages/core/` (runners, advisors, scoring, config, suppress, dep-tree)
- `/audit-cli` — any change under `apps/cli/` (subcommands — especially `fix`, TUI hooks, Commander setup, web server)
- `/audit-web` — any change under `apps/web/` (components rendering report data, AI integration, constants drift)
- `/audit-architecture` — cross-package changes, new packages, workspace / build-pipeline / release-config changes

See `CLAUDE.md` → "Code Quality Audits" for the full trigger matrix.

<!-- ## Output Report

Provide a concise summary covering:

### Current State

- Active branch and recent commits
- What phase of the roadmap we're in
- Any blocked tasks or open architectural decisions
- Immediate next actions

**Make this summary easy to scan — use bullet points and clear headers.** -->
