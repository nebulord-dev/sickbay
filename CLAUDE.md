# Sickbay Monorepo - Claude Code Guide

## Kanban Board

Project tasks are tracked in `.claude/kanban.md`. When the user mentions tasks, the board, or asks to add/move/update/list tasks, always read that file first, then edit it. Columns: Backlog → In Progress → Done.

When a task is completed, move it from In Progress to Done immediately — do not wait to be asked. If work was done that matches a backlog task (even one not explicitly pulled into In Progress), move it to Done.

This document helps Claude Code understand the Sickbay codebase structure and where to look when making updates.

## Project Overview

**Sickbay** is a zero-config health check CLI for React projects that provides:

- 15 integrated checks across 5 categories (dependencies, security, code quality, performance, git)
- Animated terminal UI built with Ink (React for terminals)
- Web dashboard with AI-powered insights using Claude
- Structured JSON output for CI/CD integration

## Monorepo Architecture

This is a **pnpm workspace** monorepo managed with **Turbo**. The packages have strict dependency order:

```
@sickbay/core (foundation)
    ↓
@sickbay/cli (depends on core)
    ↓
@sickbay/web (independent, but served by CLI)
```

The `fixtures/` directory is a **separate pnpm workspace** (not part of the Turbo build pipeline) used for testing Sickbay against real project types. It contains two packages: `fixtures/packages/react-app` (moderately healthy React app) and `fixtures/packages/node-api` (intentionally broken Node API with hardcoded secrets, circular deps, outdated packages, duplicate code, no tests, etc.). See `fixtures/README.md` for the full breakdown of intentional issues and how to add new fixtures.

### Build System

- **Package Manager**: pnpm (workspace mode)
- **Build Tool**: Turbo (respects dependency order)
- **TypeScript**: Shared `tsconfig.base.json` at root
- **Bundler**: tsup for core/cli, Vite for web

## Package Breakdown

> **Note**: Each package has its own detailed README with current implementation specifics:
>
> - `packages/core/README.md` - Analysis engine API, check runners, scoring details
> - `apps/cli/README.md` - CLI flags, Ink UI architecture, web server details
> - `apps/web/README.md` - Dashboard components, report loading, AI integration
>
> The sections below provide high-level navigation guidance. Refer to package READMEs for up-to-date implementation details.

### 1. `packages/core/` - Analysis Engine

**Purpose**: Orchestrates all health checks and produces structured reports.

**Key Files**:

- `src/runner.ts` - Main orchestrator, runs checks in parallel via `Promise.allSettled`
- `src/types.ts` - Core TypeScript interfaces (`Sickbay`, `CheckResult`, `Issue`)
- `src/scoring.ts` - Weighted scoring logic (security 30%, dependencies 25%, etc.)
- `src/integrations/` - Individual check runners (15 total)
  - Each extends `BaseRunner` and implements `run()` method
  - Examples: `knip.ts`, `npm-audit.ts`, `eslint.ts`, `git.ts`
- `src/utils/` - Shared utilities (file detection, command execution)

**When to modify**:

- Adding new health checks → Create new runner in `src/integrations/`, register in `runner.ts`
- Changing scoring weights → Edit `src/scoring.ts`
- Modifying report structure → Update `src/types.ts` (affects CLI and web)
- Fixing check logic → Edit specific integration file

**Dependencies**: All external tools (knip, depcheck, madge, etc.) are bundled here.

---

### 2. `apps/cli/` - Terminal Interface

**Purpose**: Commander-based CLI with Ink UI for terminal rendering.

**Key Files**:

- `src/index.ts` - Entry point, Commander setup, flag parsing
- `src/components/App.tsx` - Root Ink component, manages UI phases
- `src/components/ProgressList.tsx` - Animated check progress with spinners
- `src/components/CheckResult.tsx` - Individual check display (score bars, issues)
- `src/components/Summary.tsx` - Overall score + issue counts
- `src/components/QuickWins.tsx` - Top actionable fixes
- `src/commands/web.ts` - HTTP server for `--web` flag (serves web dashboard)

**UI Phases**:

1. `loading` - Progress spinners while checks run
2. `results` - Display all results + summary
3. `opening-web` - Start server, open browser (if `--web` flag)
4. `error` - Show error and exit

**When to modify**:

- Adding CLI flags → Edit `src/index.ts` (Commander config)
- Changing terminal UI → Edit components in `src/components/`
- Modifying web server → Edit `src/commands/web.ts`
- Adjusting output format → Edit relevant component or add `--json` logic

**Note**: Uses Ink (React for terminals), so components use JSX/hooks.

---

### 3. `apps/web/` - Web Dashboard

**Purpose**: Vite + React + TailwindCSS dashboard with AI chat integration.

**Key Files**:

- `src/App.tsx` - Root component, loads report from multiple sources
- `src/components/Dashboard.tsx` - Main layout (sidebar + tabbed content)
- `src/components/ScoreCard.tsx` - Circular score displays per category
- `src/components/IssuesList.tsx` - Filterable/sortable issues table
- `src/components/AIInsights.tsx` - Claude-powered analysis drawer (if API key present)
- `src/components/ChatBot.tsx` - Interactive AI chat interface
- `src/lib/load-report.ts` - Report loading logic (HTTP, query params, localStorage)

**Report Loading Priority**:

1. `/sickbay-report.json` (served by CLI HTTP server)
2. `?report=<base64>` (URL query param for sharing)
3. LocalStorage key `sickbay-report`

**When to modify**:

- Adding dashboard features → Edit components in `src/components/`
- Changing AI integration → Edit `AIInsights.tsx` or `ChatBot.tsx`
- Modifying report loading → Edit `src/lib/load-report.ts`
- Styling changes → Edit `src/index.css` or Tailwind config

**Important**: Only use `import type` from `@sickbay/core` to avoid bundling Node.js modules into browser build.

---

## Common Development Tasks

### Adding a New Health Check

1. **Create runner** in `packages/core/src/integrations/my-check.ts`:

   ```typescript
   export class MyCheckRunner extends BaseRunner {
     name = "my-check";
     category = "code-quality" as const;

     async run(projectPath: string): Promise<CheckResult> {
       // Implementation
     }
   }
   ```

2. **Scope it to the right runtime/framework** (skip if the check applies universally):

   Use declarative fields on `BaseRunner` — checked synchronously before any I/O:

   ```typescript
   // Only runs on Node projects (no React/Vue/etc. in deps)
   applicableRuntimes = ["node"] as const;

   // Only runs on React/Next/Remix projects
   applicableFrameworks = ["react", "next", "remix"] as const;
   ```

   Runtime is derived automatically: projects with no recognised UI framework get
   `runtime: 'node'`; projects with React/Vue/Angular/etc. get `runtime: 'browser'`.
   Projects without a `package.json` get `runtime: 'unknown'` and all scoped runners
   are silently skipped.

   For checks that need additional I/O-based filtering (e.g. "only if a config file
   exists"), override `isApplicable()` too — but still set the declarative fields for
   the cheap pre-filter:

   ```typescript
   applicableRuntimes = ['node'] as const;

   async isApplicable(projectPath: string, context: ProjectContext): Promise<boolean> {
     return fileExists(projectPath, 'some-config.json');
   }
   ```

3. **Register** in `packages/core/src/runner.ts` → `ALL_RUNNERS` array

4. **Rebuild**: `pnpm build` (or `pnpm --filter @sickbay/core build`)

### Modifying the Terminal UI

1. Edit components in `apps/cli/src/components/`
2. Use Ink hooks (`useEffect`, `useState`) and components (`<Box>`, `<Text>`)
3. Test with: `pnpm --filter @sickbay/cli dev` + `node apps/cli/dist/index.js --path <test-project>`

### Updating the Web Dashboard

1. Edit components in `apps/web/src/components/`
2. Use TailwindCSS for styling
3. Test with: `pnpm --filter @sickbay/web dev`
4. Generate test report: `node apps/cli/dist/index.js --path <project> --json > apps/web/public/sickbay-report.json`

### Changing Scoring Logic

1. Edit `packages/core/src/scoring.ts`
2. Adjust `CATEGORY_WEIGHTS` or scoring formulas
3. Rebuild core: `pnpm --filter @sickbay/core build`

### Adding CLI Flags

1. Edit `apps/cli/src/index.ts` (Commander config)
2. Pass new options to `runSickbay()` or UI components
3. Update help text and README

---

## File Organization Patterns

### Core Package Structure

```
packages/core/src/
├── index.ts              # Public API exports
├── runner.ts             # Main orchestrator
├── scoring.ts            # Weighted scoring
├── types.ts              # TypeScript interfaces
├── integrations/         # 15 check runners
│   ├── knip.ts
│   ├── npm-audit.ts
│   ├── eslint.ts
│   └── ...
└── utils/                # Shared helpers
    ├── exec.ts           # Command execution
    └── detect.ts         # Project detection
```

### CLI Package Structure

```
apps/cli/src/
├── index.ts              # Commander entry
├── components/           # Ink UI components
│   ├── App.tsx
│   ├── ProgressList.tsx
│   ├── CheckResult.tsx
│   └── ...
├── commands/
│   └── web.ts            # HTTP server
└── services/
    └── ai.ts             # AI integration (if applicable)
```

### Web Package Structure

```
apps/web/src/
├── main.tsx              # Vite entry
├── App.tsx               # Root component
├── index.css             # Global styles + Tailwind
├── components/           # React components
│   ├── Dashboard.tsx
│   ├── ScoreCard.tsx
│   ├── IssuesList.tsx
│   ├── AIInsights.tsx
│   └── ...
└── lib/
    └── load-report.ts    # Report fetching
```

---

## Key Concepts

### Check Result Flow

1. **Core** runs checks → produces `SickbayReport`
2. **CLI** receives report → renders Ink UI or outputs JSON
3. **Web** loads report → displays interactive dashboard

### Scoring System

- Each check returns score 0-100
- Category scores = average of checks in that category
- Overall score = weighted average using `CATEGORY_WEIGHTS`
- Thresholds: 80+ green, 60-79 yellow, <60 red

### AI Features

- Requires `ANTHROPIC_API_KEY` environment variable
- Auto-analysis on dashboard load
- Interactive chat for report questions
- Collapsible critical issues panel

---

## Dependencies to Know

### Core

- `execa` - Command execution
- `knip`, `depcheck`, `madge`, `jscpd` - Analysis tools
- All tools bundled as dependencies (no global installs)

### CLI

- `commander` - CLI framework
- `ink` - React for terminals
- `open` - Browser launching for `--web`

### Web

- `vite` - Build tool
- `react` - UI framework
- `tailwindcss` - Styling
- `@anthropic-ai/sdk` - Claude API (optional)

---

## Build Commands

```bash
# Root level (builds all packages in order)
pnpm build        # Turbo build
pnpm dev          # Watch all packages
pnpm clean        # Remove dist/ and node_modules

# Per-package
pnpm --filter @sickbay/core build
pnpm --filter @sickbay/cli build
pnpm --filter @sickbay/web build

# Development
pnpm --filter @sickbay/core dev      # Watch mode
pnpm --filter @sickbay/cli dev       # Watch mode
pnpm --filter @sickbay/web dev       # Vite dev server :3030
```

---

## Testing Locally

```bash
# Link CLI globally
cd apps/cli && pnpm link --global

# Run against a test project
sickbay --path ~/Desktop/test-app
sickbay --path ~/Desktop/test-app --web
sickbay --path ~/Desktop/test-app --json

# Or use node directly (during development)
node apps/cli/dist/index.js --path ~/Desktop/test-app
```

---

## Important Notes

1. **Dependency Order**: Always build `core` before `cli`, as CLI depends on core
2. **Type Safety**: Changes to `packages/core/src/types.ts` affect both CLI and web
3. **No Node.js in Browser**: Web package must only use `import type` from core
4. **Bundled Tools**: All analysis tools are npm dependencies in core, not global installs
5. **AI Optional**: Dashboard works without `ANTHROPIC_API_KEY`, just hides AI features

---

## When Making Changes

### If modifying check logic:

→ Look in `packages/core/src/integrations/`

### If changing terminal output:

→ Look in `apps/cli/src/components/`

### If updating web dashboard:

→ Look in `apps/web/src/components/`

### If adding new data to reports:

→ Update `packages/core/src/types.ts` first, then consumers

### If changing scoring:

→ Edit `packages/core/src/scoring.ts`

### If adding CLI options:

→ Edit `apps/cli/src/index.ts`

Run `/prime` for full project context (stack, architecture, file locations, domain model, gotchas).
