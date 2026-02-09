# Vitals Monorepo - Claude Code Guide

This document helps Claude Code understand the Vitals codebase structure and where to look when making updates.

## Project Overview

**Vitals** is a zero-config health check CLI for React projects that provides:

- 15 integrated checks across 5 categories (dependencies, security, code quality, performance, git)
- Animated terminal UI built with Ink (React for terminals)
- Web dashboard with AI-powered insights using Claude
- Structured JSON output for CI/CD integration

## Monorepo Architecture

This is a **pnpm workspace** monorepo managed with **Turbo**. The packages have strict dependency order:

```
@vitals/core (foundation)
    ↓
@vitals/cli (depends on core)
    ↓
@vitals/web (independent, but served by CLI)
```

### Build System

- **Package Manager**: pnpm (workspace mode)
- **Build Tool**: Turbo (respects dependency order)
- **TypeScript**: Shared `tsconfig.base.json` at root
- **Bundler**: tsup for core/cli, Vite for web

## Package Breakdown

> **Note**: Each package has its own detailed README with current implementation specifics:
>
> - `packages/core/README.md` - Analysis engine API, check runners, scoring details
> - `packages/cli/README.md` - CLI flags, Ink UI architecture, web server details
> - `packages/web/README.md` - Dashboard components, report loading, AI integration
>
> The sections below provide high-level navigation guidance. Refer to package READMEs for up-to-date implementation details.

### 1. `packages/core/` - Analysis Engine

**Purpose**: Orchestrates all health checks and produces structured reports.

**Key Files**:

- `src/runner.ts` - Main orchestrator, runs checks in parallel via `Promise.allSettled`
- `src/types.ts` - Core TypeScript interfaces (`VitalsReport`, `CheckResult`, `Issue`)
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

### 2. `packages/cli/` - Terminal Interface

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

### 3. `packages/web/` - Web Dashboard

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

1. `/vitals-report.json` (served by CLI HTTP server)
2. `?report=<base64>` (URL query param for sharing)
3. LocalStorage key `vitals-report`

**When to modify**:

- Adding dashboard features → Edit components in `src/components/`
- Changing AI integration → Edit `AIInsights.tsx` or `ChatBot.tsx`
- Modifying report loading → Edit `src/lib/load-report.ts`
- Styling changes → Edit `src/index.css` or Tailwind config

**Important**: Only use `import type` from `@vitals/core` to avoid bundling Node.js modules into browser build.

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

2. **Register** in `packages/core/src/runner.ts` → `ALL_RUNNERS` array

3. **Rebuild**: `pnpm build` (or `pnpm --filter @vitals/core build`)

### Modifying the Terminal UI

1. Edit components in `packages/cli/src/components/`
2. Use Ink hooks (`useEffect`, `useState`) and components (`<Box>`, `<Text>`)
3. Test with: `pnpm --filter @vitals/cli dev` + `node packages/cli/dist/index.js --path <test-project>`

### Updating the Web Dashboard

1. Edit components in `packages/web/src/components/`
2. Use TailwindCSS for styling
3. Test with: `pnpm --filter @vitals/web dev`
4. Generate test report: `node packages/cli/dist/index.js --path <project> --json > packages/web/public/vitals-report.json`

### Changing Scoring Logic

1. Edit `packages/core/src/scoring.ts`
2. Adjust `CATEGORY_WEIGHTS` or scoring formulas
3. Rebuild core: `pnpm --filter @vitals/core build`

### Adding CLI Flags

1. Edit `packages/cli/src/index.ts` (Commander config)
2. Pass new options to `runVitals()` or UI components
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
packages/cli/src/
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
packages/web/src/
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

1. **Core** runs checks → produces `VitalsReport`
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
pnpm --filter @vitals/core build
pnpm --filter @vitals/cli build
pnpm --filter @vitals/web build

# Development
pnpm --filter @vitals/core dev      # Watch mode
pnpm --filter @vitals/cli dev       # Watch mode
pnpm --filter @vitals/web dev       # Vite dev server :3030
```

---

## Testing Locally

```bash
# Link CLI globally
cd packages/cli && pnpm link --global

# Run against a test project
vitals --path ~/Desktop/test-app
vitals --path ~/Desktop/test-app --web
vitals --path ~/Desktop/test-app --json

# Or use node directly (during development)
node packages/cli/dist/index.js --path ~/Desktop/test-app
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

→ Look in `packages/cli/src/components/`

### If updating web dashboard:

→ Look in `packages/web/src/components/`

### If adding new data to reports:

→ Update `packages/core/src/types.ts` first, then consumers

### If changing scoring:

→ Edit `packages/core/src/scoring.ts`

### If adding CLI options:

→ Edit `packages/cli/src/index.ts`
