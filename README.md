# Sickbay

A zero-config health check CLI for JavaScript and TypeScript projects. Run `sickbay` in any project to get an instant report on dependencies, security, code quality, performance, and git health — with a web dashboard for deep dives.

> [!IMPORTANT]
> `sickbay` is currently in alpha

```
┌──────────────────────────────────────────────────────┐
│  ███████ ██  ██████ ██   ██ ██████   █████  ██    ██ │
│  ██      ██ ██      ██  ██  ██   ██ ██   ██  ██  ██  │
│  ███████ ██ ██      █████   ██████  ███████   ████   │
│       ██ ██ ██      ██  ██  ██   ██ ██   ██    ██    │
│  ███████ ██  ██████ ██   ██ ██████  ██   ██    ██    │
└──────────────────────────────────────────────────────┘
```

## Features

- **30 integrated checks** across 5 categories (dependencies, security, code quality, performance, git)
- **Framework-aware** — automatically detects React, Next, Express, Fastify, Koa, Hapi, and more; runs only relevant checks
- **Monorepo support** — auto-detects pnpm/npm/yarn/turbo/nx/lerna workspaces; per-package scoring and reporting
- **Animated terminal UI** built with Ink (React for terminals)
- **TUI dashboard** — persistent live dashboard with real-time file watching, git status, trends, and activity log
- **Web dashboard** served locally — opens automatically with `--web`
- **AI-powered insights** with Claude — automated analysis and interactive chat (requires `ANTHROPIC_API_KEY`)
- **Zero config** — all tools are bundled; no global installs required
- **Structured JSON output** for CI/CD integration
- **Star Trek doctor quotes** — severity-based personality quotes from Trek's finest medical officers

---

## Framework Support

| Framework / Runtime | Status | Framework-specific checks |
| ------------------- | ------ | ------------------------- |
| **React** | ✅ Supported | `react-perf`, `asset-size` |
| **Next.js** | ✅ Supported | `next-images`, `next-link`, `next-fonts`, `next-missing-boundaries`, `next-security-headers`, `next-client-components` |
| **Angular** | ✅ Supported | `angular-change-detection`, `angular-lazy-routes`, `angular-strict`, `angular-subscriptions` |
| **Node.js** | ✅ Supported | `node-security`, `node-input-validation`, `node-async-errors` |
| **TypeScript** | ✅ Supported | `typescript` (type error reporting) |
| **Vue** | 🔜 Coming Soon | — |
| **Remix** | 🔜 Coming Soon | — |

All projects also get the full suite of universal checks regardless of framework: dependencies, security, code quality, git, and complexity.

---

## Installation

```bash
# Run without installing
npx sickbay --path ~/my-project

# Install globally
npm install -g sickbay

# Or install the scoped package directly
npm install -g @nebulord/sickbay
```

---

## Monorepo Structure

```
sickbay/
├── packages/
│   └── core/           # Analysis engine — all check runners & scoring
├── apps/
│   ├── cli/            # Terminal UI (Ink + Commander)
│   └── web/            # Web dashboard (Vite + React + Tailwind)
├── fixtures/           # Test fixtures (separate pnpm workspace with react-app + node-api)
├── tests/snapshots/    # Snapshot regression tests against fixtures
├── package.json        # Root workspace config
├── pnpm-workspace.yaml
├── turbo.json          # Build pipeline
└── tsconfig.base.json
```

---

## Local Setup

### Prerequisites

- **Node.js** >= 18
- **pnpm** >= 8 (`npm install -g pnpm`)

### Install & Build

```bash
git clone https://github.com/nebulord-dev/sickbay.git
cd sickbay

# Install all workspace dependencies
pnpm install

# Build everything (core → cli → web, in dependency order)
pnpm build
```

### Link CLI globally

```bash
cd apps/cli
pnpm link --global
```

Now you can run `sickbay` from anywhere:

```bash
sickbay --path ~/my-project
sickbay --path ~/my-project --web
```

All check tools (knip, depcheck, madge, etc.) are bundled as dependencies — no separate global installs needed.

---

## CLI Usage

```
sickbay [options]

Options:
  -p, --path <path>       Path to the project to analyze (default: current directory)
  -c, --checks <names>    Comma-separated list of checks to run (default: all)
  --package <name>        Scope to a single named package (monorepo only)
  --json                  Output raw JSON report to stdout
  --web                   Open web dashboard after scan completes
  --no-ai                 Disable AI features (even if ANTHROPIC_API_KEY is set)
  --no-quotes             Suppress personality quotes in output
  --verbose               Show verbose output during checks
  -V, --version           Show version
  -h, --help              Show help

Commands:
  init                    Initialize .sickbay/ folder and run an initial baseline scan
  fix [options]           Interactively fix issues found by sickbay scan
  trend [options]         Show score history and trends over time
  stats [options]         Show a quick codebase overview and project summary
  doctor [options]        Diagnose project setup and configuration issues
  tui [options]           Persistent live dashboard with file watching and activity tracking
  badge [options]         Generate a health score badge for your README
  diff <branch>           Compare health score against another branch
```

### Examples

```bash
# Analyze current directory
sickbay

# Analyze a specific project
sickbay --path ~/projects/my-app

# Run only security and dependency checks
sickbay --checks npm-audit,knip,depcheck

# Output JSON for CI/CD
sickbay --json > sickbay-report.json

# Open interactive web dashboard
sickbay --web

# Scan a monorepo (auto-detected)
sickbay --path ~/projects/my-monorepo

# Scope to a single package in a monorepo
sickbay --package my-app

# Compare health against another branch
sickbay diff main

# Generate a README badge from last scan
sickbay badge

# Run a fresh scan and generate badge
sickbay badge --scan

# Launch persistent TUI dashboard (watches for file changes, auto-rescans)
sickbay tui

# Fix issues interactively
sickbay fix

# Preview fixes without applying
sickbay fix --dry-run

# Apply all auto-fixable issues at once
sickbay fix --all
```

> **Note:** See [apps/cli/README.md](apps/cli/README.md) for detailed documentation on each command.

---

## AI Features

The web dashboard includes **AI-powered insights** using Claude (Anthropic API):

- **Automatic Analysis** — Generates a structured health assessment when the dashboard opens
- **Interactive Chat** — Ask questions about your report ("What should I fix first?", "Explain the security issues")
- **Collapsible Critical Issues Panel** — Surfaces the most important problems upfront

### Enable AI Features

Set the `ANTHROPIC_API_KEY` environment variable:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
sickbay --web
```

You can also place it in `~/.sickbay/.env` or the project's `.env` file — both are loaded automatically.

Without the API key, the dashboard still works — you just won't see the AI insights drawer or chat bot.

---

## Available Checks

Sickbay automatically detects your project type and runs only applicable checks. Framework-specific checks are silently skipped when not relevant.

### Universal Checks (15)

Run on every project regardless of framework or runtime.

#### Dependencies

| Check        | What it does                                           |
| ------------ | ------------------------------------------------------ |
| `knip`       | Unused files, dependencies, and exports                |
| `depcheck`   | Missing dependencies (cross-refs with knip for unused) |
| `outdated`   | Outdated package versions (uses pnpm/npm/yarn)         |
| `heavy-deps` | Detects heavy dependencies (moment, lodash, etc.)      |

#### Security

| Check             | What it does                                      |
| ----------------- | ------------------------------------------------- |
| `npm-audit`       | Known vulnerability scan                          |
| `license-checker` | Flags problematic licenses (GPL, AGPL, etc.)      |
| `secrets`         | Detects exposed API keys, tokens, and credentials |

#### Code Quality

| Check          | What it does                                  |
| -------------- | --------------------------------------------- |
| `eslint`       | Linting errors and warnings                   |
| `typescript`   | Type errors and issues                        |
| `madge`        | Circular module dependencies                  |
| `jscpd`        | Copy-paste duplication detection              |
| `coverage`     | Test coverage % and test counts (vitest/jest) |
| `todo-scanner` | TODO/FIXME comments (technical debt tracker)  |
| `complexity`   | Oversized files and high line counts          |

#### Git

| Check | What it does                                 |
| ----- | -------------------------------------------- |
| `git` | Commit history, staleness, contributor count |

---

### Framework-Specific Checks (15)

Only run when the relevant framework is detected.

#### React

| Check        | What it does                               |
| ------------ | ------------------------------------------ |
| `react-perf` | React performance anti-patterns            |
| `asset-size` | Oversized images, fonts, and static assets |

#### Angular

| Check                        | What it does                                              |
| ---------------------------- | --------------------------------------------------------- |
| `angular-change-detection`   | Components missing `ChangeDetectionStrategy.OnPush`       |
| `angular-lazy-routes`        | Routes using static `component:` instead of `loadComponent:` |
| `angular-strict`             | TypeScript strict mode and Angular compiler options       |
| `angular-subscriptions`      | Subscriptions without `takeUntil` or `async` pipe cleanup |

#### Next.js

| Check                       | What it does                                                  |
| --------------------------- | ------------------------------------------------------------- |
| `next-images`               | Raw `<img>` tags instead of `next/image`                      |
| `next-link`                 | Raw `<a>` tags for internal navigation instead of `next/link` |
| `next-fonts`                | Google Fonts loaded via external stylesheet instead of `next/font` |
| `next-missing-boundaries`   | Route segments missing `loading.tsx` or `error.tsx`           |
| `next-security-headers`     | Missing security headers in `next.config.js`                  |
| `next-client-components`    | Unnecessary `"use client"` directives                         |

#### Node.js (server)

| Check                   | What it does                                    |
| ----------------------- | ----------------------------------------------- |
| `node-security`         | Helmet, CORS, rate limiting checks              |
| `node-input-validation` | Input validation library usage (zod, joi, etc.) |
| `node-async-errors`     | Async error handling in route handlers          |

---

## Scoring

Each check produces a score from 0–100. The overall score is a weighted average:

| Category     | Weight |
| ------------ | ------ |
| Security     | 30%    |
| Dependencies | 25%    |
| Code Quality | 25%    |
| Performance  | 15%    |
| Git          | 5%     |

Score thresholds: **80+** = green, **60–79** = yellow, **< 60** = red.

See [docs/scoring.md](docs/scoring.md) for the full scoring breakdown including per-check formulas.

---

## Monorepo Support

Sickbay auto-detects monorepo setups (pnpm, npm, yarn workspaces, Turborepo, Nx, Lerna) and runs checks per-package in parallel.

```bash
# Scan entire monorepo
sickbay --path ~/my-monorepo

# Scope to one package
sickbay --package @myorg/api

# Monorepo-aware subcommands
sickbay fix --package @myorg/api
sickbay trend --package @myorg/api
sickbay stats --package @myorg/api
sickbay doctor --package @myorg/api
sickbay badge --package @myorg/api
```

The web dashboard shows a package sidebar with per-package drill-in, cross-package quick wins, and an aggregate overview.

---

## Development

### Root Scripts

```bash
pnpm build        # Build all packages (turbo, respects dependency order)
pnpm dev          # Watch mode for all packages in parallel
pnpm test         # Run all tests across all packages
pnpm test:snapshots  # Run snapshot regression tests against fixtures
pnpm lint         # Lint all packages
pnpm clean        # Remove all dist/ directories and node_modules
```

### Per-Package Scripts

```bash
# Core
pnpm --filter @nebulord/sickbay-core build
pnpm --filter @nebulord/sickbay-core dev     # Watch mode

# CLI
pnpm --filter @nebulord/sickbay build
pnpm --filter @nebulord/sickbay dev      # Watch mode

# Web
pnpm --filter @nebulord/sickbay-web build
pnpm --filter @nebulord/sickbay-web dev      # Vite dev server on :3030
```

### Test Fixtures

The `fixtures/` directory is a separate pnpm workspace with two packages for testing Sickbay locally:

```bash
sickbay --path fixtures/packages/react-app    # moderately healthy React app
sickbay --path fixtures/packages/node-api     # deliberately broken Node API
sickbay --path fixtures/packages/angular-app  # Angular app with intentional issues
sickbay --path fixtures/packages/next-app     # Next.js app with intentional issues
sickbay --path fixtures/                      # full monorepo (tests monorepo detection)
```

See [`fixtures/README.md`](fixtures/README.md) for the full list of intentional issues and how to add new fixtures.

---

## Architecture

```
                  ┌─────────────┐
                  │   sickbay    │  ← CLI entry (Commander)
                  │   (CLI)     │
                  └──────┬──────┘
                         │ runSickbay() / runSickbayMonorepo()
                  ┌──────▼──────┐
                  │    core     │  ← Orchestrates runners in parallel
                  │   runner    │     Filters by ProjectContext first
                  └──────┬──────┘
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     KnipRunner    AuditRunner    GitRunner ...  (21 total)
          │              │              │
          └──────────────┼──────────────┘
                         │ SickbayReport / MonorepoReport JSON
                  ┌──────▼──────┐
                  │  Terminal   │  ← Ink UI with scores, quick wins, quotes
                  │    UI       │
                  └─────────────┘
                         │ --web flag
                  ┌──────▼──────┐
                  │  HTTP server│  ← Serves web/dist + report JSON
                  │  + browser  │
                  └─────────────┘
```

---

## Packages

- [`packages/core`](packages/core/README.md) — Analysis engine
- [`apps/cli`](apps/cli/README.md) — Terminal interface
- [`apps/web`](apps/web/README.md) — Web dashboard
