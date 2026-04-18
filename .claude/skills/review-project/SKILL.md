---
name: review-project
description: Review the Sickbay application for issues
---

Review ${0:-all packages} for bugs, security issues, and code quality problems. Focus on practical issues, not style nitpicks.

1. Check the monorepo structure (`packages/core`, `apps/cli`, `apps/web`)
2. Verify build configuration (Turbo, tsdown, Vite, pnpm workspaces)
3. Review the three main packages:
   - **core**: Health check engine — 34 check runners in `src/integrations/` (extending `BaseRunner`), runner orchestration, weighted scoring, framework/runtime detection
   - **cli**: Terminal interface with Ink — Commander flags, `--web` server, `--json` output, persistent TUI dashboard
   - **web**: React + Tailwind dashboard — scorecards, filterable issues, AI chat/summary (Claude), monorepo overview, trend history
4. Analyze data flow: project detection → `runSickbay()` → check runners (parallel via `Promise.allSettled`) → `SickbayReport` → CLI/Web rendering
5. Check for:
   - Scoring logic issues (category weights, threshold boundaries at 60/80, edge cases with zero checks)
   - Framework scoping bugs (`applicableRuntimes`/`applicableFrameworks` mismatches, `isApplicable()` false negatives)
   - Monorepo edge cases (mixed workspace managers, nested workspaces, packages without `package.json`)
   - Type safety between `SickbayReport` shape and web/CLI consumers
   - `import type` discipline in `apps/web` (must not import values from `sickbay-core`)
   - Performance concerns in check runners (spawning too many child processes, redundant file traversals)
   - AI integration issues in web dashboard (missing API key handling, prompt injection via report data)
6. Suggest architectural improvements
