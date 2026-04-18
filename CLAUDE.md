# Sickbay Monorepo - Claude Code Guide

## Task Tracking

Project tasks are tracked in **Jira** — project [Ricochet Devs (KAN)](https://nebulord.atlassian.net/jira/software/projects/KAN/boards/1), epic [KAN-5 — Sickbay](https://nebulord.atlassian.net/browse/KAN-5). Use the Atlassian Rovo MCP tools (cloud ID `00fce82c-0eef-4c5b-8d2a-1c101e580369`) to read, create, and update tasks.

### Label Reference

| Label             | Meaning                                                  |
| ----------------- | -------------------------------------------------------- |
| `auto`            | Can be executed headless from a written plan             |
| `collab`          | Needs user in the loop for design/UX/product decisions   |
| `plan-auto`       | Needs a planning session, then execution can be headless |
| `blocked`         | Explicitly blocked by prerequisite work                  |
| `tui-enhancement` | TUI-specific feature or improvement                      |
| `icebox`          | Low priority / deferred                                  |
| `phase-N`         | Roadmap phase the task belongs to                        |

## Code Quality Audits

Four targeted audit skills cover the package boundaries. Run them when you ship meaningful work to a package — not on a schedule, but before merging.

| Skill | When to run |
| ----- | ----------- |
| `/audit-core` | After adding/modifying a runner in `integrations/`, changing `runner.ts`, `scoring.ts`, or `types.ts`, or after a dependency update in core |
| `/audit-cli` | After touching CLI flags, TUI hooks, or `commands/web.ts` |
| `/audit-web` | After adding components that render report data, or modifying `load-report.ts` |
| `/audit-architecture` | After merging a large cross-package branch, adding a new package, or before a major release |

Each skill dispatches a `feature-dev:code-reviewer` agent with a package-specific checklist. Fix findings before committing.

This document helps Claude Code understand the Sickbay codebase structure and where to look when making updates.

## Project Overview

**Sickbay** is a zero-config health check CLI for JavaScript/TypeScript projects that provides:

- 34 checks across 5 categories (dependencies, security, code quality, performance, git)
- Framework-aware: React, Next.js, Angular, Node.js — only relevant checks run per project
- Monorepo support: auto-detects pnpm/npm/yarn/turbo/nx/lerna workspaces, per-package reporting
- Animated terminal UI built with Ink (React for terminals) + persistent TUI dashboard
- Web dashboard with AI-powered insights using Claude
- Structured JSON output for CI/CD integration

## Monorepo Architecture

This is a **pnpm workspace** monorepo managed with **Turbo**. The packages have strict dependency order:

```
sickbay-core (foundation)
    ↓
sickbay (depends on core)
    ↓
sickbay-web (independent, but served by CLI)

apps/docs — VitePress documentation site (nebulord-dev.github.io/sickbay)
```

The `fixtures/` directory is a **separate pnpm workspace** (not part of the Turbo build pipeline) used for testing Sickbay against real project types. It contains four packages: `fixtures/packages/react-app` (moderately healthy React app), `fixtures/packages/node-api` (intentionally broken Node API), `fixtures/packages/next-app` (Next.js app with intentional issues), and `fixtures/packages/angular-app` (Angular app with intentional issues). See `fixtures/README.md` for the full breakdown of intentional issues and how to add new fixtures.

### Build System

- **Package Manager**: pnpm (workspace mode)
- **Build Tool**: Turbo (respects dependency order)
- **TypeScript**: Shared `tsconfig.base.json` at root
- **Bundler**: tsup for core/cli, Vite for web

### Tooling & Quality

- **Linter**: oxlint (Rust-based, from oxc project) — NOT ESLint. Config at root.
- **Formatter**: oxfmt (from oxc) — NOT prettier.
- **Pre-commit**: husky + lint-staged runs oxlint + oxfmt on staged files
- **Testing**: Vitest across all packages (`pnpm test`, `pnpm test:snapshots`)
- **PR titles**: Must follow conventional commit format (enforced by CI)

### CI/CD

- **GitHub Actions** handles CI
- **Semantic-release** for automated versioning and NPM publishing (replaced changesets)
- pnpm quirks: use `--filter` not `-F` for scripting; lockfile changes require `pnpm install --no-frozen-lockfile` in CI if deps changed
- The `fixtures/` workspace is separate from the Turbo pipeline — it has its own `pnpm-lock.yaml` and won't be built by `pnpm build` at root

#### Test matrix: Linux + Windows

The `test` job in `.github/workflows/ci.yml` runs on both `ubuntu-latest` AND `windows-latest` via a strategy matrix with `fail-fast: false`. Sickbay supports Windows users, so cross-platform regressions must be caught at PR time, not by users. The other CI jobs (`build`, `lint`, `test-snapshots`) stay on `ubuntu-latest` only — build is OS-independent, oxlint/oxfmt are platform-independent, and snapshot fixtures use POSIX paths that would need separate Windows snapshot files.

**The cross-platform path-handling rule:** Never use string manipulation on paths. Specifically, **never write `fullPath.replace(projectRoot + '/', '')`** to compute relative paths — that pattern silently produces wrong output on Windows because the literal `/` doesn't match the actual `\` separator. Use `relativeFromRoot(projectRoot, fullPath)` from `core/src/utils/file-helpers.ts`, which handles the cross-platform normalization (always returns forward-slash output on every OS). This pattern was introduced after discovering 19 sites in 16 files were silently producing wrong output on Windows for the entire project's history because tests only ran on Linux.

**Test mock convention for path handling:** Test files that mock `fs` and compare paths against forward-slash literals (e.g. `String(p).endsWith('/src')`) need to also mock `path` to use POSIX semantics, otherwise they fail on the Windows CI runner because `path.join('/project', 'src')` returns `\project\src` on Windows. The pattern:

```ts
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return { ...actual.posix, default: actual.posix };
});
```

`packages/core/src/utils/file-helpers.test.ts` deliberately does NOT mock `path` so its `relativeFromRoot` unit tests exercise the real cross-platform behavior on whichever OS the test is running on.

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
- `src/types.ts` - Core TypeScript interfaces (`SickbayReport`, `CheckResult`, `Issue`, `MonorepoReport`)
- `src/scoring.ts` - Weighted scoring logic (security 30%, dependencies 25%, etc.)
- `src/config.ts` - Config loading and validation (`sickbay.config.ts`)
- `src/integrations/` - Individual check runners (34 total, framework-scoped)
  - Each extends `BaseRunner` and implements `run()` method
  - Universal: `knip.ts`, `npm-audit.ts`, `eslint.ts` (detects ESLint in the analyzed user project — distinct from sickbay's own oxlint tooling), `git.ts`, etc.
  - Framework-specific: `react-perf.ts`, `next-*.ts`, `angular-*.ts`, `node-*.ts`
- `src/utils/` - Shared utilities (file detection, command execution, monorepo detection)

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

**Bundling and the dependency mirror**: `apps/cli` bundles `sickbay-core`'s source inline at build time via tsup's `noExternal` (see `apps/cli/tsup.config.ts`). Core is private and never published, so this is the only way users get the analysis engine. The consequence: every runtime dependency of `core` MUST also appear in `apps/cli/package.json` `dependencies`, because the bundled code does `require('depcheck')`, `require('madge')`, etc. against cli's own `node_modules` at runtime. Auditors who grep `apps/cli/src/` for these imports will find none — that does NOT mean they're unused. The drift is enforced by `pnpm check:bundled-deps` (`scripts/check-bundled-deps.mjs`), which runs in CI and fails the build if cli's runtime deps don't mirror core's.

---

### 3. `apps/web/` - Web Dashboard

**Purpose**: Vite + React + TailwindCSS dashboard with AI chat integration.

**Key Files**:

- `src/App.tsx` - Root component, loads report from multiple sources
- `src/components/Dashboard.tsx` - Main layout (sidebar + tabbed content)
- `src/components/ScoreCard.tsx` - Circular score displays per category
- `src/components/IssuesList.tsx` - Filterable/sortable issues table
- `src/components/AISummary.tsx` - Claude-powered analysis drawer (if API key present)
- `src/components/ChatDrawer.tsx` - Interactive AI chat interface
- `src/lib/load-report.ts` - Report loading logic (HTTP, query params, localStorage)

**Report Loading Priority**:

1. `?report=<base64>` (URL query param for sharing)
2. `/sickbay-report.json` (served by CLI HTTP server)
3. LocalStorage key `sickbay-report`

**When to modify**:

- Adding dashboard features → Edit components in `src/components/`
- Changing AI integration → Edit `AISummary.tsx` or `ChatDrawer.tsx`
- Modifying report loading → Edit `src/lib/load-report.ts`
- Styling changes → Edit `src/index.css` or Tailwind config

**Important**: Only use `import type` from `sickbay-core` to avoid bundling Node.js modules into browser build.

---

## Common Development Tasks

### Adding a New Health Check

1. **Create runner** in `packages/core/src/integrations/my-check.ts`:

   ```typescript
   export class MyCheckRunner extends BaseRunner {
     name = 'my-check';
     category = 'code-quality' as const;

     async run(projectPath: string): Promise<CheckResult> {
       // Implementation
     }
   }
   ```

2. **Scope it to the right runtime/framework** (skip if the check applies universally):

   Use declarative fields on `BaseRunner` — checked synchronously before any I/O:

   ```typescript
   // Only runs on Node projects (no React/Vue/etc. in deps)
   applicableRuntimes = ['node'] as const;

   // Only runs on React/Next/Remix projects
   applicableFrameworks = ['react', 'next', 'remix'] as const;
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

4. **Rebuild**: `pnpm build` (or `pnpm --filter sickbay-core build`)

### Modifying the Terminal UI

1. Edit components in `apps/cli/src/components/`
2. Use Ink hooks (`useEffect`, `useState`) and components (`<Box>`, `<Text>`)
3. Test with: `pnpm --filter sickbay dev` + `node apps/cli/dist/index.js --path <test-project>`

### Updating the Web Dashboard

1. Edit components in `apps/web/src/components/`
2. Use TailwindCSS for styling
3. Test with: `pnpm --filter sickbay-web dev`
4. Generate test report: `node apps/cli/dist/index.js --path <project> --json > apps/web/public/sickbay-report.json`

### Changing Scoring Logic

1. Edit `packages/core/src/scoring.ts`
2. Adjust `CATEGORY_WEIGHTS` or scoring formulas
3. Rebuild core: `pnpm --filter sickbay-core build`

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
├── config.ts             # Config loading (sickbay.config.ts)
├── constants.ts          # Shared constants
├── quotes/               # Star Trek doctor quotes
├── integrations/         # 34 check runners (framework-scoped)
│   ├── base.ts           # BaseRunner abstract class
│   ├── knip.ts, depcheck.ts, npm-audit.ts, ...  # Universal
│   ├── react-perf.ts     # React-specific
│   ├── next-*.ts         # Next.js-specific (6 runners)
│   ├── angular-*.ts      # Angular-specific (7 runners)
│   ├── node-*.ts         # Node.js-specific (3 runners)
│   └── ...
└── utils/                # Shared helpers
    ├── detect-project.ts # Framework/runtime detection
    ├── detect-monorepo.ts # Monorepo detection
    ├── file-helpers.ts   # File utilities
    └── ...
```

### CLI Package Structure

```
apps/cli/src/
├── index.ts              # Commander entry — all subcommands registered here
├── components/           # Ink UI components
│   ├── App.tsx           # Root component (scan + results phases)
│   ├── ProgressList.tsx, CheckResult.tsx, Summary.tsx, QuickWins.tsx, ...
│   └── tui/              # Persistent TUI dashboard
│       ├── TuiApp.tsx    # TUI root — layout, keyboard input, state
│       ├── HealthPanel.tsx, ScorePanel.tsx, TrendPanel.tsx, ...
│       └── hooks/        # useFileWatcher, useGitStatus, useSickbayRunner, ...
├── commands/             # Subcommand implementations
│   ├── web.ts, fix.ts, diff.ts, badge.ts, trend.ts, stats.ts, doctor.ts, init.ts
└── lib/                  # Shared utilities
    ├── history.ts        # Trend history read/write
    └── update-check.ts   # npm update notifications
```

### Web Package Structure

```
apps/web/src/
├── main.tsx              # Vite entry
├── App.tsx               # Root component
├── index.css             # Global styles + Tailwind
├── components/           # React components
│   ├── Dashboard.tsx     # Main layout (sidebar + tabbed content)
│   ├── ScoreCard.tsx, IssuesList.tsx, DependencyList.tsx, CodebaseStats.tsx
│   ├── AISummary.tsx     # AI insights drawer
│   ├── ChatDrawer.tsx    # Interactive AI chat
│   ├── HistoryChart.tsx  # Score trend visualization
│   ├── MonorepoOverview.tsx  # Monorepo scoreboard + cross-package view
│   ├── ConfigTab.tsx     # Read-only config display
│   └── ...
└── lib/
    ├── load-report.ts    # Report fetching
    └── constants.ts      # Duplicated core constants (browser-safe)
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
- Thresholds: 90+ excellent (green), 80–89 good (green), 60–79 fair (yellow), <60 poor (red)

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
pnpm --filter sickbay-core build
pnpm --filter sickbay build
pnpm --filter sickbay-web build

# Development
pnpm --filter sickbay-core dev      # Watch mode
pnpm --filter sickbay dev           # Watch mode
pnpm --filter sickbay-web dev       # Vite dev server :3030
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
