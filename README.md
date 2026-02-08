# Vitals

A zero-config health check CLI for React projects. Run `vitals` in any project to get an instant report on dependencies, security, code quality, performance, and git health — with a web dashboard for deep dives.

```
┌─────────────────────────────────────────────────────┐
│  ██╗   ██╗██╗████████╗ █████╗ ██╗     ███████╗     │
│  ██║   ██║██║╚══██╔══╝██╔══██╗██║     ██╔════╝     │
│  ██║   ██║██║   ██║   ███████║██║     ███████╗     │
│  ╚██╗ ██╔╝██║   ██║   ██╔══██║██║     ╚════██║     │
│   ╚████╔╝ ██║   ██║   ██║  ██║███████╗███████║     │
│    ╚═══╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝     │
└─────────────────────────────────────────────────────┘
```

## Features

- **10 integrated checks** across 5 categories (dependencies, security, code quality, performance, git)
- **Animated terminal UI** built with Ink (React for terminals)
- **Web dashboard** served locally — opens automatically with `--web`
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
  --verbose             Show verbose output during checks
  -V, --version         Show version
  -h, --help            Show help
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
```

---

## Available Checks

| Check | Category | What it does |
|-------|----------|--------------|
| `knip` | dependencies | Unused files, dependencies, and exports |
| `depcheck` | dependencies | Missing/unused package.json dependencies |
| `npm-check-updates` | dependencies | Outdated package versions |
| `npm-audit` | security | Known vulnerability scan |
| `license-checker` | security | Flags problematic licenses (GPL, AGPL, etc.) |
| `madge` | code-quality | Circular module dependencies |
| `jscpd` | code-quality | Copy-paste duplication detection |
| `coverage` | code-quality | Auto-runs vitest/jest, reports test counts + coverage % |
| `source-map-explorer` | performance | Bundle size breakdown |
| `git` | git | Commit history, staleness, contributor count |

---

## Scoring

Each check produces a score from 0–100. The overall score is a weighted average:

| Category | Weight |
|----------|--------|
| Security | 30% |
| Dependencies | 25% |
| Code Quality | 25% |
| Performance | 15% |
| Git | 5% |

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
     KnipRunner    AuditRunner    GitRunner ...  (10 total)
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
