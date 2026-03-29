# VitePress Documentation Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a VitePress documentation site at `apps/docs/` that documents all Sickbay CLI commands, health checks, scoring, and features, deployed automatically to GitHub Pages.

**Architecture:** New `apps/docs/` package with VitePress, dark-mode-first theme matching Nebulord brand (teal/cyan `#00e5a0`), 3-section content structure (Guide, Commands, Advanced). GitHub Actions workflow deploys on push to `main`.

**Tech Stack:** VitePress 1.6+, GitHub Actions, pnpm workspace

**Spec:** `docs/superpowers/specs/2026-03-29-vitepress-docs-site-design.md`

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `apps/docs/package.json` | Package config — `@nebulord/sickbay-docs`, private, vitepress dep |
| `apps/docs/.gitignore` | Ignore `.vitepress/cache/` and `.vitepress/dist/` |
| `apps/docs/.vitepress/config.ts` | VitePress config — nav, sidebar, base, theme, social links |
| `apps/docs/.vitepress/theme/index.ts` | Extend default theme with custom CSS |
| `apps/docs/.vitepress/theme/custom.css` | CSS variable overrides for dark/teal theme + monospace headings |
| `apps/docs/index.md` | Hero landing page |
| `apps/docs/guide/introduction.md` | What is Sickbay, philosophy |
| `apps/docs/guide/installation.md` | npx, global install, scoped package |
| `apps/docs/guide/quick-start.md` | First scan walkthrough |
| `apps/docs/guide/scoring.md` | Scoring system deep dive |
| `apps/docs/guide/health-checks.md` | All 21 checks by category |
| `apps/docs/guide/monorepo.md` | Monorepo detection and usage |
| `apps/docs/commands/scan.md` | Default scan command + `--web` flag |
| `apps/docs/commands/init.md` | `sickbay init` |
| `apps/docs/commands/fix.md` | `sickbay fix` |
| `apps/docs/commands/tui.md` | `sickbay tui` |
| `apps/docs/commands/doctor.md` | `sickbay doctor` |
| `apps/docs/commands/trend.md` | `sickbay trend` |
| `apps/docs/commands/stats.md` | `sickbay stats` |
| `apps/docs/commands/badge.md` | `sickbay badge` |
| `apps/docs/commands/diff.md` | `sickbay diff` |
| `apps/docs/advanced/ci-cd.md` | CI/CD integration guide |
| `apps/docs/advanced/json-output.md` | JSON report structure |
| `apps/docs/advanced/ai-features.md` | AI insights and chat |
| `.github/workflows/docs.yml` | GitHub Actions deploy workflow |

### Modified Files

| File | Change |
|------|--------|
| `package.json` (root) | Add `docs:dev` and `docs:build` scripts |

---

## Task 1: Scaffold VitePress Package

**Files:**
- Create: `apps/docs/package.json`
- Create: `apps/docs/.gitignore`
- Modify: `package.json` (root)

- [ ] **Step 1: Create `apps/docs/package.json`**

```json
{
  "name": "@nebulord/sickbay-docs",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "docs:dev": "vitepress dev",
    "docs:build": "vitepress build",
    "docs:preview": "vitepress preview"
  },
  "devDependencies": {
    "vitepress": "^1.6.4"
  }
}
```

- [ ] **Step 2: Create `apps/docs/.gitignore`**

```
.vitepress/cache/
.vitepress/dist/
node_modules/
```

- [ ] **Step 2b: Exclude docs from Turbo build pipeline**

The docs package must not participate in the Turbo `build` pipeline (it has no code deps and VitePress outputs to `.vitepress/dist/`, not `dist/`). The `package.json` scripts intentionally use `docs:dev`, `docs:build`, `docs:preview` instead of `dev`, `build`, `preview` — since Turbo's `build` task only runs packages that have a `build` script, the docs package is automatically excluded.

- [ ] **Step 3: Add root-level scripts to `package.json`**

Add these two scripts to the root `package.json` `scripts` object:

```json
"docs:dev": "pnpm --filter @nebulord/sickbay-docs docs:dev",
"docs:build": "pnpm --filter @nebulord/sickbay-docs docs:build"
```

- [ ] **Step 4: Install dependencies**

Run: `pnpm install`

Expected: VitePress installed in `apps/docs/node_modules`, lockfile updated.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/package.json apps/docs/.gitignore package.json pnpm-lock.yaml
git commit -m "feat(docs): scaffold VitePress package at apps/docs"
```

---

## Task 2: VitePress Config and Theme

**Files:**
- Create: `apps/docs/.vitepress/config.ts`
- Create: `apps/docs/.vitepress/theme/index.ts`
- Create: `apps/docs/.vitepress/theme/custom.css`

- [ ] **Step 1: Create VitePress config**

Create `apps/docs/.vitepress/config.ts`:

```ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Sickbay',
  description: 'Zero-config health checks for TypeScript, React, and Node projects',
  base: '/sickbay/',
  appearance: 'dark',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/sickbay/favicon.svg' }],
  ],

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Commands', link: '/commands/scan' },
      { text: 'Advanced', link: '/advanced/ci-cd' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Scoring System', link: '/guide/scoring' },
            { text: 'Health Checks', link: '/guide/health-checks' },
            { text: 'Monorepo Support', link: '/guide/monorepo' },
          ],
        },
      ],
      '/commands/': [
        {
          text: 'Commands',
          items: [
            { text: 'sickbay (scan)', link: '/commands/scan' },
            { text: 'sickbay init', link: '/commands/init' },
            { text: 'sickbay fix', link: '/commands/fix' },
            { text: 'sickbay tui', link: '/commands/tui' },
            { text: 'sickbay doctor', link: '/commands/doctor' },
            { text: 'sickbay trend', link: '/commands/trend' },
            { text: 'sickbay stats', link: '/commands/stats' },
            { text: 'sickbay badge', link: '/commands/badge' },
            { text: 'sickbay diff', link: '/commands/diff' },
          ],
        },
      ],
      '/advanced/': [
        {
          text: 'Advanced',
          items: [
            { text: 'CI/CD Integration', link: '/advanced/ci-cd' },
            { text: 'JSON Output', link: '/advanced/json-output' },
            { text: 'AI Features', link: '/advanced/ai-features' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/nebulord/sickbay' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/sickbay' },
    ],

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/nebulord/sickbay/edit/main/apps/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2025-present Nebulord',
    },
  },
})
```

- [ ] **Step 2: Create theme extension**

Create `apps/docs/.vitepress/theme/index.ts`:

```ts
import DefaultTheme from 'vitepress/theme'
import './custom.css'

export default DefaultTheme
```

- [ ] **Step 3: Create custom CSS**

Create `apps/docs/.vitepress/theme/custom.css`:

```css
/* Teal/cyan brand — matches Sickbay dashboard score rings */
:root {
  --vp-c-brand-1: #00e5a0;
  --vp-c-brand-2: #00cc8e;
  --vp-c-brand-3: #00b37d;
  --vp-c-brand-soft: rgba(0, 229, 160, 0.14);
}

.dark {
  --vp-c-brand-1: #00e5a0;
  --vp-c-brand-2: #33eab3;
  --vp-c-brand-3: #66f0c6;
  --vp-c-brand-soft: rgba(0, 229, 160, 0.16);
}

/* Monospace headings — terminal/hacker aesthetic */
h1, h2, h3, h4, h5, h6,
.VPHero .name,
.VPHero .text,
.VPHero .tagline {
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', ui-monospace, monospace !important;
}

/* Hero name gradient — teal to match brand */
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: linear-gradient(135deg, #00e5a0 0%, #00b37d 100%);
}

/* Hero image glow — scoped to hero only */
.VPHero .image-bg {
  background-image: linear-gradient(-45deg, #00e5a0 50%, #00b37d 50%);
  filter: blur(44px);
  opacity: 0.8;
}
```

- [ ] **Step 4: Verify dev server starts**

Run: `pnpm docs:dev`

Expected: VitePress dev server starts on port 5173, shows empty site with dark theme and teal accent color. Kill with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/.vitepress/
git commit -m "feat(docs): add VitePress config with dark teal theme"
```

---

## Task 3: Hero Landing Page

**Files:**
- Create: `apps/docs/index.md`

- [ ] **Step 1: Create hero page**

Create `apps/docs/index.md`:

```md
---
layout: home

hero:
  name: Sickbay
  text: Project Health Checks
  tagline: Zero-config health checks for TypeScript, React, and Node projects. 21 checks, interactive TUI, web dashboard, AI insights.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/nebulord/sickbay

features:
  - title: 21 Health Checks
    details: Dependencies, security, code quality, performance, and git health — all in one scan. Framework-aware, runs only relevant checks.
  - title: Interactive TUI
    details: Persistent live dashboard with real-time file watching, git status, trend charts, quick wins, and keyboard shortcuts.
  - title: Web Dashboard
    details: Rich browser UI with score cards, filterable issues, dependency graphs, and AI-powered insights via Claude.
  - title: Monorepo Support
    details: Auto-detects pnpm, npm, yarn, Turbo, Nx, and Lerna workspaces. Per-package scoring and reporting out of the box.
---
```

- [ ] **Step 2: Verify hero renders**

Run: `pnpm docs:dev`

Expected: Landing page shows hero with "Sickbay" name in teal gradient, tagline, two action buttons, and four feature cards. Kill with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add apps/docs/index.md
git commit -m "feat(docs): add hero landing page"
```

---

## Task 4: Guide Section — Introduction, Installation, Quick Start

**Files:**
- Create: `apps/docs/guide/introduction.md`
- Create: `apps/docs/guide/installation.md`
- Create: `apps/docs/guide/quick-start.md`

- [ ] **Step 1: Create introduction page**

Create `apps/docs/guide/introduction.md`:

```md
# Introduction

Sickbay is a zero-config health check CLI for JavaScript and TypeScript projects. Run it in any project to get an instant report across five categories:

- **Dependencies** — unused packages, outdated versions, missing deps, heavy dependencies
- **Security** — npm audit vulnerabilities, hardcoded secrets, license compliance
- **Code Quality** — ESLint issues, code duplication, type safety, technical debt, file complexity
- **Performance** — bundle size analysis, React performance patterns, asset sizes
- **Git** — commit hygiene, test coverage

## Philosophy

**Zero config.** All 21 analysis tools are bundled as npm dependencies — no global installs, no configuration files, no setup. Run `npx sickbay` and get results.

**Framework-aware.** Sickbay detects your project's framework (React, Next.js, Express, Fastify, Koa, etc.) and only runs checks relevant to it. A Node API server won't be checked for React performance patterns, and a React app won't be checked for Express security issues.

**Opinionated scoring.** Every check produces a 0-100 score. Category scores are weighted averages, with security weighted highest (30%) and git lowest (5%). The overall score gives you a single number to track over time.

## What You Get

- **Terminal UI** — animated progress, color-coded results, quick wins
- **TUI Dashboard** — persistent live dashboard with file watching and keyboard navigation
- **Web Dashboard** — rich browser UI with score cards, dependency graphs, and AI insights
- **JSON Output** — structured reports for CI/CD pipelines
- **Fix Command** — interactively apply suggested fixes
- **Trend Tracking** — score history over time with delta analysis
```

- [ ] **Step 2: Create installation page**

Create `apps/docs/guide/installation.md`:

```md
# Installation

## Quick Start (no install)

```bash
npx sickbay --path ~/my-project
```

This downloads and runs Sickbay without installing it globally. The thin `sickbay` wrapper package on npm delegates to `@nebulord/sickbay`.

## Global Install

```bash
# Via the wrapper (recommended — shorter command)
npm install -g sickbay

# Or install the scoped package directly
npm install -g @nebulord/sickbay
```

Once installed globally, run from any directory:

```bash
sickbay                     # scan current directory
sickbay --path ~/my-app     # scan a specific project
sickbay --web               # open web dashboard after scan
```

## Requirements

- **Node.js** 18.0.0 or later
- **npm**, **pnpm**, **yarn**, or **bun** as your package manager

Sickbay bundles all analysis tools internally — you don't need to install ESLint, knip, madge, or any other tool globally.

## Monorepo Usage

Sickbay auto-detects monorepos. Run from the workspace root to scan all packages:

```bash
cd ~/my-monorepo
sickbay                         # scans all packages
sickbay --package @org/my-app   # scope to one package
```

See [Monorepo Support](/guide/monorepo) for details.
```

- [ ] **Step 3: Create quick start page**

Create `apps/docs/guide/quick-start.md`:

```md
# Quick Start

## Run Your First Scan

```bash
npx sickbay --path ~/my-project
```

Sickbay will:
1. Detect your project type (React, Node, etc.)
2. Run all applicable health checks in parallel
3. Display animated progress in the terminal
4. Show results with color-coded scores

## Read the Output

Each check shows:
- **Score** (0-100) with a color-coded bar (green 80+, yellow 60-79, red below 60)
- **Issue count** by severity (critical, warning, info)
- **Quick wins** — the most impactful fixes you can make right now

The overall score is a weighted average across all categories.

## Open the Web Dashboard

```bash
npx sickbay --path ~/my-project --web
```

The `--web` flag starts a local server and opens a rich browser dashboard with:
- Score cards for every check
- Filterable and sortable issues list
- Dependency graph visualization
- AI-powered insights (requires `ANTHROPIC_API_KEY`)

## Try the TUI

```bash
npx sickbay tui --path ~/my-project
```

The TUI is a persistent live dashboard that watches your files and re-scans automatically. Press `?` for keyboard shortcuts.

## Output JSON for CI

```bash
npx sickbay --path ~/my-project --json
```

Produces a structured `SickbayReport` JSON object suitable for piping to other tools or storing as a CI artifact. See [JSON Output](/advanced/json-output) for the full schema.

## Initialize Trend Tracking

```bash
npx sickbay init --path ~/my-project
```

Creates a `.sickbay/` folder with a baseline scan. Subsequent scans are recorded in `.sickbay/history.json`, enabling the `sickbay trend` command and the History tab in the web dashboard.
```

- [ ] **Step 4: Verify navigation works**

Run: `pnpm docs:dev`

Navigate to Guide > Introduction, Installation, Quick Start. Verify sidebar shows all three pages and content renders correctly.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/guide/introduction.md apps/docs/guide/installation.md apps/docs/guide/quick-start.md
git commit -m "feat(docs): add guide section — introduction, installation, quick start"
```

---

## Task 5: Guide Section — Scoring System

**Files:**
- Create: `apps/docs/guide/scoring.md`

Reference: `docs/scoring.md` in the repo has the full scoring documentation. Adapt it for the public docs site.

- [ ] **Step 1: Create scoring page**

Create `apps/docs/guide/scoring.md`:

```md
# Scoring System

Sickbay produces a single overall health score (0-100) from weighted category scores. Each check within a category produces its own 0-100 score.

## Categories and Weights

| Category | Weight | Checks |
|----------|--------|--------|
| **Security** | 30% | npm-audit, secrets, license-checker |
| **Dependencies** | 25% | knip, depcheck, outdated, heavy-deps |
| **Code Quality** | 25% | eslint, jscpd, typescript, todo-scanner, complexity, node-security, node-input-validation, node-async-errors |
| **Performance** | 15% | source-map-explorer, react-perf, asset-size |
| **Git** | 5% | coverage |

## How Scores Work

1. Each check runner scores 0-100 based on its analysis
2. Checks marked `skipped` (not applicable to the project) are excluded
3. Category score = average of active check scores in that category
4. Overall score = weighted average using the weights above

## Score Thresholds

| Score | Status | Color |
|-------|--------|-------|
| 80-100 | Good | Green |
| 60-79 | Fair | Yellow |
| 0-59 | Needs attention | Red |

## Issue Severity

Each check can report issues at three severity levels:

- **Critical** — security vulnerabilities, hardcoded secrets, failing tests
- **Warning** — outdated dependencies, code duplication, missing types
- **Info** — unused code, TODO comments, style suggestions

## Example

A React project might score:
- Security: 100 (no vulnerabilities, no secrets, all licenses OK)
- Dependencies: 85 (2 unused packages, 1 outdated)
- Code Quality: 72 (some ESLint warnings, 3 complex files)
- Performance: 90 (bundle under threshold, good React patterns)
- Git: 95 (good coverage)

**Overall**: (100 × 0.30) + (85 × 0.25) + (72 × 0.25) + (90 × 0.15) + (95 × 0.05) = **87.0**
```

- [ ] **Step 2: Verify page renders**

Run: `pnpm docs:dev`, navigate to Guide > Scoring System. Verify tables render correctly.

- [ ] **Step 3: Commit**

```bash
git add apps/docs/guide/scoring.md
git commit -m "feat(docs): add scoring system guide"
```

---

## Task 6: Guide Section — Health Checks

**Files:**
- Create: `apps/docs/guide/health-checks.md`

Reference: Read each runner in `packages/core/src/integrations/` for the check name, category, description, and applicability. Also reference `docs/scoring.md` for score formulas.

- [ ] **Step 1: Create health checks page**

Create `apps/docs/guide/health-checks.md`. This is the longest content page. Group checks by category. For each check, document:
- **Name** and underlying tool
- **Category**
- **What it detects**
- **Applicability** (which project types it runs on)
- **Scoring** (how the 0-100 score is calculated)

Read each runner file in `packages/core/src/integrations/` to extract the `name`, `category`, `description`, and `applicableRuntimes`/`applicableFrameworks` fields. Also read `docs/scoring.md` for the score formulas per check.

**Source files to read (one per check):**

| Runner file | Check name |
|-------------|------------|
| `packages/core/src/integrations/knip.ts` | Unused Code |
| `packages/core/src/integrations/depcheck.ts` | Dependency Health |
| `packages/core/src/integrations/outdated.ts` | Outdated Packages |
| `packages/core/src/integrations/heavy-deps.ts` | Heavy Dependencies |
| `packages/core/src/integrations/npm-audit.ts` | Security Vulnerabilities |
| `packages/core/src/integrations/secrets.ts` | Secrets Detection |
| `packages/core/src/integrations/license-checker.ts` | License Compliance |
| `packages/core/src/integrations/eslint.ts` | ESLint |
| `packages/core/src/integrations/jscpd.ts` | Code Duplication |
| `packages/core/src/integrations/typescript.ts` | Type Safety |
| `packages/core/src/integrations/todo-scanner.ts` | Technical Debt |
| `packages/core/src/integrations/complexity.ts` | File Complexity |
| `packages/core/src/integrations/node-security.ts` | Node Security |
| `packages/core/src/integrations/node-input-validation.ts` | Node Input Validation |
| `packages/core/src/integrations/node-async-errors.ts` | Node Async Errors |
| `packages/core/src/integrations/source-map-explorer.ts` | Bundle Size |
| `packages/core/src/integrations/react-perf.ts` | React Performance |
| `packages/core/src/integrations/asset-size.ts` | Asset Sizes |
| `packages/core/src/integrations/coverage.ts` | Tests & Coverage |
| `packages/core/src/integrations/git.ts` | Git Health |
| `packages/core/src/integrations/madge.ts` | Circular Dependencies |

Also read `docs/scoring.md` for score formulas per check.

**Page structure — follow this template for every check:**

```md
# Health Checks

Sickbay includes 21 checks across 5 categories. Each check is framework-aware — only checks relevant to your project type will run.

## Dependencies

### Unused Code

- **Tool:** knip
- **Applies to:** All projects
- **What it detects:** Unused files, exports, dependencies, and type-only imports
- **Scoring:** 100 minus 5 points per unused item (floor 0)

### Dependency Health

- **Tool:** depcheck
- ...

(repeat for all 21 checks, grouped by category: Dependencies, Security, Code Quality, Performance, Git)
```

Extract the `name`, `category`, `description`, `applicableRuntimes`, and `applicableFrameworks` fields from each runner class. Use the `run()` method and `docs/scoring.md` to describe scoring logic.

- [ ] **Step 2: Verify page renders**

Run: `pnpm docs:dev`, navigate to Guide > Health Checks. Verify all 21 checks are listed with correct grouping.

- [ ] **Step 3: Commit**

```bash
git add apps/docs/guide/health-checks.md
git commit -m "feat(docs): add health checks reference"
```

---

## Task 7: Guide Section — Monorepo Support

**Files:**
- Create: `apps/docs/guide/monorepo.md`

- [ ] **Step 1: Create monorepo page**

Create `apps/docs/guide/monorepo.md`:

```md
# Monorepo Support

Sickbay automatically detects monorepo setups and runs health checks per-package.

## Supported Workspace Tools

| Tool | Detection |
|------|-----------|
| pnpm workspaces | `pnpm-workspace.yaml` |
| npm workspaces | `workspaces` field in root `package.json` |
| yarn workspaces | `workspaces` field in root `package.json` |
| Turborepo | `turbo.json` |
| Nx | `nx.json` |
| Lerna | `lerna.json` |

## Running in a Monorepo

From the workspace root, Sickbay discovers all packages and scans each one:

```bash
cd ~/my-monorepo
sickbay
```

Each package gets its own framework detection and score. The terminal output shows a per-package scoreboard.

## Scoping to a Single Package

Use `--package` to focus on one package:

```bash
sickbay --package @org/my-app
```

The package name matches against `package.json` `name` fields. You can use just the short name if it's unambiguous:

```bash
sickbay --package my-app
```

## Monorepo Subcommands

All subcommands support monorepo mode:

```bash
sickbay doctor                    # diagnose all packages
sickbay doctor --package my-app   # diagnose one package
sickbay fix                       # fix issues across all packages
sickbay stats                     # stats for all packages
sickbay trend                     # trends for all packages
sickbay badge --package my-app    # badge for one package
```

## Web Dashboard

The web dashboard (`--web`) shows a sidebar with all packages and their scores. Click a package to drill into its checks, issues, dependencies, and codebase stats.

## TUI Dashboard

The TUI (`sickbay tui`) shows a monorepo banner with a mini scoreboard when a monorepo is detected. For full per-package detail, use `sickbay --web`.
```

- [ ] **Step 2: Commit**

```bash
git add apps/docs/guide/monorepo.md
git commit -m "feat(docs): add monorepo support guide"
```

---

## Task 8: Commands Section — scan, init, fix

**Files:**
- Create: `apps/docs/commands/scan.md`
- Create: `apps/docs/commands/init.md`
- Create: `apps/docs/commands/fix.md`

Reference: `apps/cli/src/index.ts` for exact flag definitions and defaults.

- [ ] **Step 1: Create scan command page**

Create `apps/docs/commands/scan.md`:

```md
# sickbay

The default command. Runs all applicable health checks and displays results.

## Usage

```bash
sickbay [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path to analyze | Current directory |
| `-c, --checks <checks>` | Comma-separated list of checks to run | All applicable |
| `--package <name>` | Scope to a single package (monorepo only) | — |
| `--json` | Output raw JSON report | — |
| `--web` | Open web dashboard after scan | — |
| `--no-ai` | Disable AI features in web dashboard | — |
| `--no-quotes` | Suppress Star Trek doctor quotes | — |
| `--verbose` | Show verbose output | — |

## Examples

```bash
# Scan current directory
sickbay

# Scan a specific project
sickbay --path ~/my-app

# Run only specific checks
sickbay --checks knip,eslint,npm-audit

# Output JSON for CI
sickbay --json > report.json

# Open web dashboard
sickbay --web

# Scan one package in a monorepo
sickbay --package @org/my-app
```

## Web Dashboard

The `--web` flag starts a local HTTP server (default port 3030) and opens the web dashboard in your browser. The dashboard provides:

- Score cards for every check
- Filterable and sortable issues list
- Dependency graph and dependency list with update info
- Codebase statistics
- AI-powered insights and chat (requires `ANTHROPIC_API_KEY`)

The server runs until you close the terminal.

## Auto-Save

Every scan automatically saves the report to `.sickbay/last-report.json` and appends to `.sickbay/history.json` for trend tracking. Run `sickbay init` first to create the `.sickbay/` directory.
```

- [ ] **Step 2: Create init command page**

Create `apps/docs/commands/init.md`:

```md
# sickbay init

Initialize the `.sickbay/` folder and run an initial baseline scan.

## Usage

```bash
sickbay init [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path to initialize | Current directory |

## What It Does

1. Creates a `.sickbay/` directory in your project
2. Adds a `.gitignore` inside it (ignores cache files)
3. Runs a full scan and saves the result as `baseline.json`
4. Creates `history.json` for trend tracking

## When to Use It

Run `sickbay init` once per project to enable:
- **Trend tracking** via `sickbay trend` and the web dashboard History tab
- **Branch diff** via `sickbay diff <branch>`
- **Badge generation** via `sickbay badge` (reads last report)

## Example

```bash
cd ~/my-project
sickbay init
# Creates .sickbay/ with baseline scan
```
```

- [ ] **Step 3: Create fix command page**

Create `apps/docs/commands/fix.md`:

```md
# sickbay fix

Interactively review and apply fixes for issues found during a scan.

## Usage

```bash
sickbay fix [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path to analyze | Current directory |
| `-c, --checks <checks>` | Comma-separated list of checks to run | All applicable |
| `--package <name>` | Scope to a single package (monorepo only) | — |
| `--all` | Apply all available fixes without prompting | — |
| `--dry-run` | Show what would be fixed without executing | — |
| `--verbose` | Show verbose output | — |

## How It Works

Sickbay runs a scan, then presents fixable issues in an interactive terminal UI. You can:
- Browse fixes with arrow keys
- Select/deselect individual fixes
- Apply selected fixes with Enter

## Actionable vs Guidance Fixes

Not all issues have auto-applicable fixes:

- **Actionable** — commands Sickbay can run for you (e.g., `pnpm remove unused-pkg`, `pnpm update outdated-pkg`)
- **Guidance** — suggestions that require human judgment (e.g., "refactor this complex file", "add input validation")

Only actionable fixes appear in `sickbay fix`. Guidance-only suggestions appear in Quick Wins during a regular scan.

## Examples

```bash
# Interactive fix mode
sickbay fix

# Apply all fixes without prompting
sickbay fix --all

# Preview fixes without applying
sickbay fix --dry-run

# Fix issues in a specific monorepo package
sickbay fix --package @org/my-app
```
```

- [ ] **Step 4: Commit**

```bash
git add apps/docs/commands/scan.md apps/docs/commands/init.md apps/docs/commands/fix.md
git commit -m "feat(docs): add command pages — scan, init, fix"
```

---

## Task 9: Commands Section — tui, doctor, trend

**Files:**
- Create: `apps/docs/commands/tui.md`
- Create: `apps/docs/commands/doctor.md`
- Create: `apps/docs/commands/trend.md`

Reference: `apps/cli/src/index.ts` for flags, `apps/cli/src/components/tui/TuiApp.tsx` lines 204-260 for hotkeys.

- [ ] **Step 1: Create TUI command page**

Create `apps/docs/commands/tui.md`:

```md
# sickbay tui

Launch the persistent developer dashboard — a full-screen terminal UI with live updates.

## Usage

```bash
sickbay tui [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path to monitor | Current directory |
| `-c, --checks <checks>` | Comma-separated list of checks to run | All applicable |
| `--no-watch` | Disable file-watching auto-refresh | Watching enabled |
| `--no-quotes` | Suppress Star Trek doctor quotes | — |
| `--refresh <seconds>` | Auto-refresh interval | 300 (5 minutes) |

## Panels

The TUI divides your terminal into panels:

- **Health Checks** — all check scores with color-coded bars
- **Score** — overall score with animated reveal
- **Trend** — sparkline chart of recent scores
- **Git** — current branch, status, recent commits
- **Quick Wins** — top actionable fixes
- **Activity** — log of scan events and actions

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `?` | Toggle help overlay |
| `h` | Focus/unfocus Health panel |
| `g` | Focus/unfocus Git panel |
| `t` | Focus/unfocus Trend panel |
| `q` | Focus/unfocus Quick Wins panel |
| `a` | Focus/unfocus Activity panel |
| `f` | Expand focused panel to full screen |
| `Escape` | Close expanded panel or help |
| `r` | Trigger a manual re-scan |
| `w` | Open web dashboard |
| `W` | Open web dashboard with AI enabled |

## File Watching

By default, the TUI watches your source files and triggers a re-scan when changes are detected. Disable with `--no-watch`.

The refresh interval (`--refresh`) sets the minimum time between automatic re-scans. File changes within the interval are batched.

## Monorepo Mode

When a monorepo is detected, the TUI shows a monorepo banner with a mini scoreboard. For full per-package detail, use `sickbay --web`.
```

- [ ] **Step 2: Create doctor command page**

Create `apps/docs/commands/doctor.md`:

```md
# sickbay doctor

Diagnose project setup and configuration issues.

## Usage

```bash
sickbay doctor [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path to analyze | Current directory |
| `--package <name>` | Scope to a single package (monorepo only) | — |
| `--fix` | Auto-scaffold missing configuration files | — |
| `--json` | Output diagnostic results as JSON | — |

## What It Checks

The doctor command verifies your project has the expected setup:

- `package.json` exists and is valid
- Lock file present (matches detected package manager)
- TypeScript config present
- ESLint config present
- Test framework configured
- `.gitignore` includes common patterns

## Auto-Fix

Use `--fix` to scaffold missing configuration:

```bash
sickbay doctor --fix
```

This creates sensible defaults for any missing configs.

## Examples

```bash
# Check project setup
sickbay doctor

# Auto-fix missing configs
sickbay doctor --fix

# JSON output for CI
sickbay doctor --json

# Check a specific monorepo package
sickbay doctor --package @org/my-app
```
```

- [ ] **Step 3: Create trend command page**

Create `apps/docs/commands/trend.md`:

```md
# sickbay trend

Show score history and trends over time.

## Usage

```bash
sickbay trend [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path to analyze | Current directory |
| `-n, --last <count>` | Number of recent scans to show | 20 |
| `--package <name>` | Scope to a single package (monorepo only) | — |
| `--json` | Output trend data as JSON | — |

## Prerequisites

Run `sickbay init` first to create the `.sickbay/` directory and baseline. Each subsequent `sickbay` scan automatically records history.

## What It Shows

- Score timeline with per-scan entries
- Score delta from previous scan
- Category breakdown over time
- Sparkline visualization in the terminal

## Examples

```bash
# Show last 20 scans
sickbay trend

# Show last 5 scans
sickbay trend --last 5

# JSON output
sickbay trend --json
```
```

- [ ] **Step 4: Commit**

```bash
git add apps/docs/commands/tui.md apps/docs/commands/doctor.md apps/docs/commands/trend.md
git commit -m "feat(docs): add command pages — tui, doctor, trend"
```

---

## Task 10: Commands Section — stats, badge, diff

**Files:**
- Create: `apps/docs/commands/stats.md`
- Create: `apps/docs/commands/badge.md`
- Create: `apps/docs/commands/diff.md`

Reference: `apps/cli/src/index.ts` for flags, `apps/cli/src/commands/badge.ts` for badge details, `apps/cli/src/commands/diff.ts` for diff details.

- [ ] **Step 1: Create stats command page**

Create `apps/docs/commands/stats.md`:

```md
# sickbay stats

Show a quick codebase overview and project summary.

## Usage

```bash
sickbay stats [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path to analyze | Current directory |
| `--package <name>` | Scope to a single package (monorepo only) | — |
| `--json` | Output stats as JSON | — |

## What It Shows

A quick snapshot of your project:
- Detected framework and runtime
- Package manager
- Dependency count
- Source file count and lines of code
- Test file count
- Last scan score (if available)

## Examples

```bash
# Quick project overview
sickbay stats

# JSON output
sickbay stats --json

# Stats for a monorepo package
sickbay stats --package @org/my-app
```
```

- [ ] **Step 2: Create badge command page**

Create `apps/docs/commands/badge.md`:

```md
# sickbay badge

Generate a shields.io health score badge for your README.

## Usage

```bash
sickbay badge [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path | Current directory |
| `--package <name>` | Scope to a single package (monorepo only) | — |
| `--html` | Output HTML `<img>` tag instead of markdown | — |
| `--url` | Output bare badge URL only | — |
| `--label <text>` | Custom badge label | `sickbay` |
| `--scan` | Run a fresh scan instead of using last report | — |

## Output Formats

By default, outputs Markdown:

```bash
$ sickbay badge
![sickbay](https://img.shields.io/badge/sickbay-92%25-brightgreen)
```

HTML:

```bash
$ sickbay badge --html
<img src="https://img.shields.io/badge/sickbay-92%25-brightgreen" alt="sickbay" />
```

URL only:

```bash
$ sickbay badge --url
https://img.shields.io/badge/sickbay-92%25-brightgreen
```

## Badge Colors

- **Green** — score 80+
- **Yellow** — score 60-79
- **Red** — score below 60

## Examples

```bash
# Generate badge from last scan
sickbay badge

# Run fresh scan first
sickbay badge --scan

# Custom label
sickbay badge --label "project health"

# Badge for a monorepo package
sickbay badge --package @org/my-app
```
```

- [ ] **Step 3: Create diff command page**

Create `apps/docs/commands/diff.md`:

```md
# sickbay diff

Compare health scores between the current branch and another branch.

## Usage

```bash
sickbay diff <branch> [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `branch` | Branch to compare against (reads its `.sickbay/last-report.json`) |

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path to analyze | Current directory |
| `-c, --checks <checks>` | Comma-separated list of checks to run | All applicable |
| `--json` | Output diff as JSON | — |
| `--verbose` | Show verbose output | — |

## How It Works

1. Reads the baseline report from the target branch via `git show <branch>:.sickbay/last-report.json`
2. Runs a fresh scan on the current branch
3. Compares per-check scores and displays a table with deltas

## Output

The diff table shows:
- Check name and score on each branch
- Delta with color-coded arrows:
  - Green up arrow — improvement
  - Red down arrow — regression
  - Gray dash — unchanged
  - `NEW` — check added
  - `REMOVED` — check no longer applicable

## Prerequisites

Both branches must have `.sickbay/last-report.json`. Run `sickbay init` and at least one scan on each branch.

## Examples

```bash
# Compare against main
sickbay diff main

# JSON output for CI
sickbay diff main --json

# Compare specific checks
sickbay diff main --checks eslint,coverage
```
```

- [ ] **Step 4: Commit**

```bash
git add apps/docs/commands/stats.md apps/docs/commands/badge.md apps/docs/commands/diff.md
git commit -m "feat(docs): add command pages — stats, badge, diff"
```

---

## Task 11: Advanced Section

**Files:**
- Create: `apps/docs/advanced/ci-cd.md`
- Create: `apps/docs/advanced/json-output.md`
- Create: `apps/docs/advanced/ai-features.md`

Reference: `packages/core/src/types.ts` for `SickbayReport` and `MonorepoReport` interfaces.

- [ ] **Step 1: Create CI/CD page**

Create `apps/docs/advanced/ci-cd.md`:

```md
# CI/CD Integration

Sickbay can run in CI pipelines to enforce health score thresholds.

## Basic Usage

```bash
npx sickbay --json > sickbay-report.json
```

The `--json` flag outputs a structured JSON report and exits with code 0.

## Enforcing Thresholds

Use `jq` or a script to fail the pipeline if the score drops below a threshold:

```bash
SCORE=$(npx sickbay --json | jq '.overallScore')
if [ "$SCORE" -lt 80 ]; then
  echo "Health score $SCORE is below threshold (80)"
  exit 1
fi
```

## GitHub Actions Example

```yaml
jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Run Sickbay
        run: npx sickbay --json > sickbay-report.json
      - name: Check threshold
        run: |
          SCORE=$(jq '.overallScore' sickbay-report.json)
          echo "Health score: $SCORE"
          if (( $(echo "$SCORE < 80" | bc -l) )); then
            echo "::error::Health score $SCORE is below threshold"
            exit 1
          fi
      - name: Upload report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: sickbay-report
          path: sickbay-report.json
```

## Monorepo CI

For monorepos, scan per-package in parallel:

```bash
# Scan all packages
npx sickbay --json > monorepo-report.json

# Or scope to specific packages
npx sickbay --package @org/api --json > api-report.json
npx sickbay --package @org/web --json > web-report.json
```

## Branch Comparison

Compare against the base branch in PRs:

```bash
npx sickbay diff main --json
```

This shows regressions introduced by the PR.
```

- [ ] **Step 2: Create JSON output page**

Create `apps/docs/advanced/json-output.md`.

**Source file:** Read `packages/core/src/types.ts` for the `SickbayReport`, `MonorepoReport`, `CheckResult`, `Issue`, and `ProjectInfo` interfaces.

**Page structure:**

```md
# JSON Output

Use `--json` to get structured output suitable for CI/CD pipelines and automation.

## Usage

\`\`\`bash
sickbay --json > report.json
\`\`\`

## Report Structure

The top-level object is a `SickbayReport`:

| Field | Type | Description |
|-------|------|-------------|
| `overallScore` | `number` | 0-100 weighted score |
| `checks` | `CheckResult[]` | Individual check results |
| `summary` | `object` | Issue counts by severity |
| `projectInfo` | `object` | Detected project metadata |
| `timestamp` | `string` | ISO 8601 scan timestamp |

### CheckResult

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Check identifier |
| `displayName` | `string` | Human-readable name |
| `category` | `string` | One of: dependencies, security, code-quality, performance, git |
| `score` | `number` | 0-100 |
| `status` | `string` | passed, warning, failed, error, skipped |
| `issues` | `Issue[]` | Issues found |
| `description` | `string` | What the check does |

### Issue

| Field | Type | Description |
|-------|------|-------------|
| `message` | `string` | Issue description |
| `severity` | `string` | critical, warning, info |
| `file` | `string?` | File path if applicable |

(Add the MonorepoReport section for `--json` on monorepos)
\`\`\`

Document the key fields from `types.ts`. Do not dump the full TypeScript interfaces — describe them in tables as shown above. Include a truncated example JSON output at the end.

- [ ] **Step 3: Create AI features page**

Create `apps/docs/advanced/ai-features.md`:

```md
# AI Features

Sickbay integrates with Claude (Anthropic's AI) to provide intelligent analysis of your health report.

## Setup

Set the `ANTHROPIC_API_KEY` environment variable:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or create a `.env` file in your project root:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Sickbay also checks `~/.sickbay/.env` for a global API key.

## What AI Provides

### Auto-Analysis

When the web dashboard loads with an API key configured, Sickbay sends your report to Claude for analysis. The AI summary includes:

- Overall assessment of project health
- Prioritized recommendations
- Patterns across multiple issues (e.g., "your dependency issues suggest a stale project")

### Interactive Chat

The web dashboard includes a chat drawer where you can ask questions about your report:

- "Which issues should I fix first?"
- "Why is my code quality score low?"
- "What's the impact of these security warnings?"

## Privacy

Your report data is sent to Anthropic's API for analysis. No data is stored by Sickbay. Review Anthropic's privacy policy for API data handling.

## Without AI

The dashboard works fully without an API key — AI features are simply hidden. No functionality is lost.
```

- [ ] **Step 4: Commit**

```bash
git add apps/docs/advanced/ci-cd.md apps/docs/advanced/json-output.md apps/docs/advanced/ai-features.md
git commit -m "feat(docs): add advanced section — CI/CD, JSON output, AI features"
```

---

## Task 12: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/docs.yml`

- [ ] **Step 1: Create workflow file**

```bash
mkdir -p .github/workflows
```

Create `.github/workflows/docs.yml`:

```yaml
name: Deploy docs to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - 'apps/docs/**'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build docs
        run: pnpm docs:build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: apps/docs/.vitepress/dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/docs.yml
git commit -m "ci: add GitHub Actions workflow for docs deployment"
```

---

## Task 13: Build Verification and Final Commit

- [ ] **Step 1: Run full docs build**

Run: `pnpm docs:build`

Expected: VitePress builds successfully, output in `apps/docs/.vitepress/dist/`.

- [ ] **Step 2: Preview the built site**

Run: `pnpm --filter @nebulord/sickbay-docs docs:preview`

Expected: Preview server starts, navigate through all pages to verify links and content.

- [ ] **Step 3: Verify the main build still works**

Run: `pnpm build`

Expected: Turbo builds core and cli successfully. The docs package should NOT appear in Turbo's output (it has no `build` script — only `docs:build`).

- [ ] **Step 4: Run all tests**

Run: `pnpm test`

Expected: All existing tests pass — no regressions.

- [ ] **Step 5: Final review and commit if needed**

Review all pages for broken links, typos, or missing content. Fix any issues and commit.
