# Vitals

A zero-config health check CLI for React projects. Run `vitals` in any project to get an instant report on dependencies, security, code quality, performance, and git health — with a web dashboard for deep dives.

```
┌──────────────────────────────────────────────────────────────────┐
│ ░██    ░██ ░██████░██████████   ░███    ░██           ░██████    │
│ ░██    ░██   ░██      ░██      ░██░██   ░██          ░██   ░██   │
│ ░██    ░██   ░██      ░██     ░██  ░██  ░██         ░██          │
│ ░██    ░██   ░██      ░██    ░█████████ ░██          ░████████   │
│  ░██  ░██    ░██      ░██    ░██    ░██ ░██                 ░██  │
│   ░██░██     ░██      ░██    ░██    ░██ ░██          ░██   ░██   │
│    ░███    ░██████    ░██    ░██    ░██ ░██████████   ░██████    │
└──────────────────────────────────────────────────────────────────┘
```

## Features

- **17 integrated checks** across 5 categories (dependencies, security, code quality, performance, git)
- **Animated terminal UI** built with Ink (React for terminals)
- **TUI dashboard** — persistent live TUI with real-time file watching, git status, trends, and activity log
- **Web dashboard** served locally — opens automatically with `--web`
- **AI-powered insights** with Claude — automated analysis and interactive chat (requires `ANTHROPIC_API_KEY`)
- **Zero config** — all tools are bundled; no global installs required
- **Structured JSON output** for CI/CD integration

---

## Monorepo Structure

```
vitals/
├── packages/
│   ├── core/        # Analysis engine — all check runners & scoring
│   ├── cli/         # Terminal UI (Ink + Commander)
│   └── web/         # Web dashboard (Vite + React)
├── fixtures/        # Test fixtures (pnpm monorepo with react-app + node-api)
├── package.json     # Root workspace config
├── pnpm-workspace.yaml
├── turbo.json       # Build pipeline
└── tsconfig.base.json
```

---

## Local Setup

### Prerequisites

- **Node.js** >= 18
- **pnpm** >= 8 (`npm install -g pnpm`)

### Install & Build

```bash
git clone <repo-url>
cd vitals

# Install all workspace dependencies
pnpm install

# Build everything (core → cli → web, in dependency order)
pnpm build
```

### Link CLI globally

```bash
cd packages/cli
pnpm link --global
```

Now you can run `vitals` from anywhere:

```bash
vitals --path ~/my-react-app
vitals --path ~/my-react-app --web
```

All check tools (knip, depcheck, madge, etc.) are bundled as dependencies — no separate global installs needed.

---

## CLI Usage

```
vitals [options]

Options:
  -p, --path <path>     Path to the project to analyze (default: current directory)
  -c, --checks <names>  Comma-separated list of checks to run (default: all)
  --json                Output raw JSON report to stdout
  --web                 Open web dashboard after scan completes
  --no-ai               Disable AI features (even if ANTHROPIC_API_KEY is set)
  --verbose             Show verbose output during checks
  -V, --version         Show version
  -h, --help            Show help

Commands:
  fix [options]          Interactively fix issues found by vitals scan
  trend [options]        Show score history and trends over time
  stats [options]        Show a quick codebase overview and project summary
  doctor [options]       Diagnose project setup and configuration issues
  tui [options]      Persistent live dashboard with file watching and activity tracking
```

### Examples

```bash
# Analyze current directory
vitals

# Analyze a specific project
vitals --path ~/projects/my-app

# Run only security and dependency checks
vitals --path ~/projects/my-app --checks npm-audit,knip,depcheck

# Output JSON for CI/CD
vitals --path ~/projects/my-app --json > vitals-report.json

# Open interactive web dashboard
vitals --path ~/projects/my-app --web

# Enable AI features (requires ANTHROPIC_API_KEY)
export ANTHROPIC_API_KEY=sk-ant-...
vitals --path ~/projects/my-app --web

# Launch persistent tui dashboard (watches for file changes, auto-rescans)
vitals tui --path ~/projects/my-app

# TUI with AI web dashboard on demand (press W inside tui)
export ANTHROPIC_API_KEY=sk-ant-...
vitals tui --path ~/projects/my-app
```

> **Note:** See [packages/cli/README.md](packages/cli/README.md) for detailed documentation on the `fix`, `trend`, `stats`, `doctor`, and `tui` commands.

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
vitals --path ~/projects/my-app --web
```

Without the API key, the dashboard still works — you just won't see the AI insights drawer or chat bot.

---

## Available Checks

### Dependencies (3 checks)

| Check      | What it does                                           |
| ---------- | ------------------------------------------------------ |
| `knip`     | Unused files, dependencies, and exports                |
| `depcheck` | Missing dependencies (cross-refs with knip for unused) |
| `outdated` | Outdated package versions (uses pnpm/npm/yarn)         |

### Security (3 checks)

| Check             | What it does                                      |
| ----------------- | ------------------------------------------------- |
| `npm-audit`       | Known vulnerability scan                          |
| `license-checker` | Flags problematic licenses (GPL, AGPL, etc.)      |
| `secrets`         | Detects exposed API keys, tokens, and credentials |

### Code Quality (7 checks)

| Check          | What it does                                  |
| -------------- | --------------------------------------------- |
| `eslint`       | Linting errors and warnings                   |
| `typescript`   | Type errors and issues                        |
| `madge`        | Circular module dependencies                  |
| `jscpd`        | Copy-paste duplication detection              |
| `coverage`     | Test coverage % and test counts (vitest/jest) |
| `todo-scanner` | TODO/FIXME comments (technical debt tracker)  |
| `complexity`   | High cyclomatic complexity files              |

### Performance (3 checks)

| Check        | What it does                                      |
| ------------ | ------------------------------------------------- |
| `heavy-deps` | Detects heavy dependencies (moment, lodash, etc.) |
| `react-perf` | React performance anti-patterns                   |
| `asset-size` | Oversized images, fonts, and static assets        |

### Git (1 check)

| Check | What it does                                 |
| ----- | -------------------------------------------- |
| `git` | Commit history, staleness, contributor count |

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

---

## Development

### Root Scripts

```bash
pnpm build        # Build all packages (turbo, respects dependency order)
pnpm dev          # Watch mode for all packages in parallel
pnpm clean        # Remove all dist/ directories and node_modules
```

### Per-Package Scripts

```bash
# Core
pnpm --filter @vitals/core build
pnpm --filter @vitals/core dev     # Watch mode

# CLI
pnpm --filter @vitals/cli build
pnpm --filter @vitals/cli dev      # Watch mode

# Web
pnpm --filter @vitals/web build
pnpm --filter @vitals/web dev      # Vite dev server on :3030
```

### Iterating on the CLI

```bash
# Terminal 1 — watch rebuild
pnpm --filter @vitals/cli dev

# Terminal 2 — test against a project
node packages/cli/dist/index.js --path ~/Desktop/vitals-test-app
```

### Test Fixtures

The `fixtures/` directory is a pnpm monorepo with two intentionally broken packages for testing Vitals locally:

```bash
vitals --path fixtures/packages/react-app   # moderately healthy React app
vitals --path fixtures/packages/node-api    # deliberately broken Node API
vitals --path fixtures/                     # full monorepo (tests monorepo detection)
```

See [`fixtures/README.md`](fixtures/README.md) for the full list of intentional issues and how to add new fixtures.

### Iterating on the Web Dashboard

```bash
# Start Vite dev server (auto-opens browser)
pnpm --filter @vitals/web dev

# Generate a sample report for the dashboard to load
node packages/cli/dist/index.js --path ~/Desktop/vitals-test-app --json > packages/web/public/vitals-report.json
```

---

## Architecture

```
                  ┌─────────────┐
                  │   vitals    │  ← CLI entry (Commander)
                  │  (CLI pkg)  │
                  └──────┬──────┘
                         │ runVitals()
                  ┌──────▼──────┐
                  │    core     │  ← Orchestrates all runners in parallel
                  │   runner    │
                  └──────┬──────┘
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     KnipRunner    AuditRunner    GitRunner ...  (17 total)
          │              │              │
          └──────────────┼──────────────┘
                         │ VitalsReport JSON
                  ┌──────▼──────┐
                  │  Terminal   │  ← Ink UI with scores + quick wins
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
- [`packages/cli`](packages/cli/README.md) — Terminal interface
- [`packages/web`](packages/web/README.md) — Web dashboard
