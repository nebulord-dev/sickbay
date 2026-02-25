---
description: Prime agent with codebase understanding
---

# Prime: Load Project Context

## Objective

Build comprehensive understanding of the Vitals monorepo before starting work. This is a pnpm workspace with three packages (`core`, `cli`, `web`) and strict build dependency order.

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
- `docs/vitals-monorepo-design.md` — architecture decisions for Phase 3 work
- `packages/core/README.md`, `packages/cli/README.md`, `packages/web/README.md` — per-package implementation details

### 3. Identify Key Files

Read based on the task at hand:

**If working on checks/scoring:**
- `packages/core/src/types.ts` — core interfaces (`VitalsReport`, `CheckResult`, `Issue`)
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

### 4. Understand Current State

Check recent activity:
!`git log -10 --oneline`

Check current branch and status:
!`git status`

## Output Report

Provide a concise summary covering:

### Project Overview

- Purpose and current phase of development
- What's actively being worked on (from kanban In Progress)
- What's coming next (from kanban + roadmap)

### Architecture

- Monorepo package dependency order (`core` → `cli` → `web`)
- Key architectural patterns in each package
- Any hardcoded assumptions to be aware of (single-project vs monorepo)

### Tech Stack

- TypeScript throughout; Ink (React for terminals) in CLI; Vite + React + Tailwind in web
- pnpm workspaces + Turbo for build orchestration
- Vitest for testing; tsup for bundling core/cli; Vite for web

### Current State

- Active branch and recent commits
- What phase of the roadmap we're in
- Any blocked tasks or open architectural decisions
- Immediate next actions

**Make this summary easy to scan — use bullet points and clear headers.**
