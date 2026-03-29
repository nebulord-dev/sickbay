# VitePress Documentation Site — Design Spec

## Overview

A public-facing documentation site for Sickbay, built with VitePress and deployed to GitHub Pages. Documents all CLI commands, health checks, scoring system, and advanced features for users of the `npx sickbay` CLI.

## Location

`apps/docs/` — a new workspace package `@nebulord/sickbay-docs`. Lives alongside `apps/cli/` and `apps/web/` as a first-class app in the monorepo. The existing `docs/` directory at root remains unchanged (internal specs and plans).

## Stack

- **VitePress** (latest) — static site generator built on Vite
- **GitHub Actions** — automated deployment to GitHub Pages on push to `main`
- **pnpm workspace** — registered under `apps/*` (already covered by workspace glob)

## Base URL

`/sickbay/` — serves at `nebulord.github.io/sickbay`. Configured in VitePress `base` option. Trivial to swap to a custom domain later by changing `base` to `/` and adding a CNAME.

## Theme

Dark-mode-first, matching the Nebulord brand and Sickbay web dashboard aesthetic:

- **Primary color**: Teal/cyan `#00e5a0` (matches score rings and active tab in dashboard)
- **Accent/warning**: Red (matches critical issues styling)
- **Dark mode**: Default, with light mode available but not the design focus
- **Typography**: Monospace headings via CSS override to echo the terminal/hacker aesthetic of the nebulord site and Sickbay TUI
- **Implementation**: Override VitePress CSS custom properties in `apps/docs/.vitepress/theme/custom.css` — no custom Vue theme components needed

## Content Structure

### Guide Section

| Page | Content |
|------|---------|
| Introduction | What is Sickbay, philosophy (zero-config, opinionated), what it checks |
| Installation | `npx sickbay`, global install via `npm i -g sickbay`, monorepo note |
| Quick Start | Run first scan, read output, open web dashboard |
| Scoring System | 5 categories, weights (security 30%, deps 25%, etc.), thresholds (80+ green, 60-79 yellow, <60 red), overall score formula |
| Health Checks | All checks (currently 21) grouped by category — what each detects, how it scores, applicability conditions (React-only, Node-only, universal) |
| Monorepo Support | Auto-detection (pnpm/npm/yarn/turbo/nx/lerna), per-package reporting, `--package` flag, TUI monorepo panel |

### Commands Reference

One page per command:

| Command | Description |
|---------|-------------|
| `sickbay` | Default scan — flags (`--path`, `--checks`, `--package`, `--json`, `--web`, `--no-ai`, `--no-quotes`, `--verbose`). Includes `--web` flag documentation (launches web dashboard) |
| `sickbay init` | Initialize `.sickbay/` folder and baseline scan |
| `sickbay fix` | Interactive fix UI — `--all`, `--dry-run`, actionable vs guidance-only fixes |
| `sickbay tui` | Persistent developer dashboard — panels, hotkeys, file watching, auto-refresh |
| `sickbay doctor` | Diagnose project setup — missing configs, `--fix` to scaffold |
| `sickbay trend` | Score history over time — `--last`, `--json` |
| `sickbay stats` | Quick codebase overview and project summary |
| `sickbay badge` | Generate shields.io badge — `--url`, `--html`, `--label`, `--scan` |
| `sickbay diff <branch>` | Compare health score against another branch — score deltas, regressions |

### Advanced Section

| Page | Content |
|------|---------|
| CI/CD Integration | Using `--json` in pipelines, exit codes, threshold enforcement |
| JSON Output | Report structure, `SickbayReport` and `MonorepoReport` shapes, piping to other tools |
| AI Features | `ANTHROPIC_API_KEY` setup, what AI insights provide, interactive chat |

## VitePress Configuration

```
apps/docs/
├── .vitepress/
│   ├── config.ts          # Site config (nav, sidebar, base, title, theme)
│   └── theme/
│       ├── index.ts        # Extend default theme
│       └── custom.css      # CSS variable overrides for dark/teal theme
├── index.md                # Hero landing page
├── guide/
│   ├── introduction.md
│   ├── installation.md
│   ├── quick-start.md
│   ├── scoring.md
│   ├── health-checks.md
│   └── monorepo.md
├── commands/
│   ├── scan.md
│   ├── init.md
│   ├── fix.md
│   ├── tui.md
│   ├── doctor.md
│   ├── trend.md
│   ├── stats.md
│   ├── badge.md
│   └── diff.md
├── advanced/
│   ├── ci-cd.md
│   ├── json-output.md
│   └── ai-features.md
└── package.json
```

### VitePress Config Highlights

- `base: '/sickbay/'`
- `title: 'Sickbay'`
- `description: 'Zero-config health checks for TypeScript, React, and Node projects'`
- `appearance: 'dark'` (default to dark mode)
- Sidebar groups matching the three sections above
- Top nav: Guide | Commands | Advanced | GitHub link
- Social links: GitHub repo, npm package

## Package Configuration

`apps/docs/package.json`:
- Name: `@nebulord/sickbay-docs`
- Private: true
- Scripts: `dev`, `build`, `preview`
- Dependencies: `vitepress` only
- No build dependency on core/cli/web — pure markdown content

## Turbo Integration

Add to root `package.json`:
- `docs:dev` — `pnpm --filter @nebulord/sickbay-docs dev`
- `docs:build` — `pnpm --filter @nebulord/sickbay-docs build`

The docs package does not participate in the default `build` pipeline — it has no code dependencies and should not slow down `pnpm build`. Instead, exclude it from the standard `build` task by scoping Turbo: the root `docs:build` script uses `--filter` to target only the docs package. No changes to `turbo.json` needed — the docs package's `build` script (`vitepress build`) will run when filtered to directly.

## GitHub Actions Deployment

`.github/workflows/docs.yml`:

1. **Trigger**: Push to `main` (path filter: `apps/docs/**`)
2. **Steps**:
   - Checkout repo
   - Setup Node.js 20+
   - Setup pnpm (via `corepack enable` to match `packageManager` field)
   - Install dependencies (`pnpm install --frozen-lockfile`)
   - Build docs (`pnpm docs:build`)
   - Deploy to GitHub Pages using `actions/deploy-pages`
3. **Permissions**: `pages: write`, `id-token: write` (for Pages deployment)
4. **Environment**: `github-pages`

Requires enabling GitHub Pages in repo settings with source set to "GitHub Actions".

## Build Artifacts

VitePress generates `.vitepress/cache/` and `.vitepress/dist/` directories. Add both to `apps/docs/.gitignore`.

## Hero Landing Page

The `index.md` uses VitePress hero frontmatter:

- **Name**: `Sickbay`
- **Tagline**: `Zero-config health checks for TypeScript, React, and Node projects`
- **Actions**: "Get Started" (links to guide/introduction), "View on GitHub" (external link)
- **Features**: 3-4 feature cards highlighting key selling points (e.g., "21 Health Checks", "Interactive TUI", "Web Dashboard", "Monorepo Support")

## Out of Scope

- Custom Vue components (use default VitePress theme + CSS overrides)
- Auto-generated API docs from TypeScript (future enhancement)
- Search (VitePress includes built-in local search — enabled by default, no extra config)
- Versioned docs (single version for now)
- Screenshots/images in initial pass (can be added incrementally)
