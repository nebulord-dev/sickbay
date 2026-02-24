# Kanban Board

## Backlog

- Scan the vitals project with the vitals CLI
- Add Playwright tests to the web project

### Features
- `[Feature]` Historical Trends — track score changes over time, store past reports locally, visualize trends in a line chart
- `[Feature]` CI/CD Integration Guide — pre-built GitHub Actions and GitLab CI templates, auto-comment PR summaries with score deltas, fail builds on critical thresholds
- `[Feature]` Lighthouse Integration — run Lighthouse audits for Web Vitals (LCP, FID, CLS) alongside code health checks with unified performance scoring
- `[Feature]` Custom check API for plugins — plug-in system for adding custom runners with a simple interface
- `[Feature]` AI quick fixes — let Claude suggest and apply one-click fixes for unused imports, outdated deps, missing docs; maybe a `vitals --fix` command
- `[Feature]` VS Code Extension — inline warnings in editor, run checks on Save, show issues in the gutter
- `[Feature]` Fill the codebase tab out on all TypeScript-based projects — currently only fully populated on web projects
- `[Feature]` Monorepo detection — identify monorepos, determine how vitals runs across multiple apps, include language/framework detection (see vitals-monorepo-design.md); as part of this, fix coverage reporting to run per-package and aggregate results — currently running from the monorepo root instruments all source files including untested integration runners in `core`, producing misleadingly low numbers (~43%) despite per-package coverage being 95%+
- `[Feature]` Add a vitals-py variant to the CLI — Python equivalent scanning using same terminal and web views
- `[Feature]` Add more commands like `trends` and `doctor` — brainstorm other commands for quick visualizations
- `[Feature]` Update About page to show checks based on language — when polyglot features land, show only checks that ran
- `[Feature]` Replace Claude Code API key with Enterprise license — support both enterprise and personal API key options
- `[Feature]` Suggestions from Claude — have Claude suggest additional feature ideas for the app
- `[Feature]` Add tips to quick wins — surface tips like "use the React compiler" or "ESLint isn't fully configured"

### UI/UX
- `[UI/UX]` Dependency Tree Visualization — interactive graph of dependency tree highlighting vulnerabilities, outdated packages, and circular imports
- `[UI/UX]` Add tabs per project in the UI for a Monorepo — show a tab per project plus an overall summary dashboard

### Testing
- `[Feature]` Add missing tests to `@vitals/cli` — only `QuickWins`, `ScoreBar`, and `Summary` are covered; needs tests for components (`App`, `CheckResult`, `ProgressList`, `Header`, all cockpit components and hooks), commands (`web`, `doctor`, `fix`, `stats`, `trend`), and lib (`history.ts`, `project-hash.ts`)
- `[Feature]` Add missing tests to `@vitals/core` — currently only `scoring.ts`, `base.ts`, `knip.ts`, and `file-helpers.ts` are covered; all integration runners (`git.ts`, `npm-audit.ts`, `eslint.ts`, `coverage.ts`, `madge.ts`, etc.) and `runner.ts` need tests
- `[Feature]` Create `vitals-test-fixtures` repo — separate repo with fixture projects for testing Vitals against real project types; each fixture is self-contained in its own subfolder: `react-app/`, `angular-app/`, `ts-lib/`, `node-api/`, and `monorepo/` (Option B: a nested pnpm workspace with its own `pnpm-workspace.yaml` and sub-packages inside); some fixtures should intentionally contain known issues (outdated deps, circular imports, vulnerabilities) to verify Vitals catches them correctly
- `[Docs]` Document how to add a new test fixture — contributing guide in `vitals-test-fixtures` explaining how to add a new language or framework fixture (e.g. Python), what intentional issues to include, and how to run Vitals against it

### Documentation
- `[Docs]` Incremental checks — document only rerunning checks on changed files between commits (18x speedup for large codebases)
- `[Docs]` Adding a new language — docs for how to add a new language for scanning and checks
- `[Docs]` How to run the project locally — setup guide including global install steps
- `[Docs]` Document patterns for AI consistency — scan monorepo for code patterns and document them for AI working on Vitals
- `[Docs]` Add screenshots to the READMEs — add visuals of the app to package READMEs
- `[Docs]` Create SKILLS.md and reference files — have Claude suggest what skill files and other docs would be useful

### Versioning
- `[Feature]` Auto-increment Vitals CLI version — set up automated version bumping (e.g. via `changesets` or a release script); display the current version number beneath the Vitals banner in the terminal UI
- `[Feature]` Set up publishing and registry — once repo is moved to its permanent home, configure Changesets + `@changesets/action` GitHub Action and decide on registry strategy: (a) **public npm** — unscoped, `npx vitals` just works, no `.npmrc` needed for consumers, but code is public; (b) **GitHub Packages** — requires scoped package (e.g. `@acme/vitals`), so consumers must run `npx @acme/vitals` and need an `.npmrc` with a GitHub PAT; (c) **self-hosted registry** (Verdaccio/Artifactory) — supports unscoped but adds infrastructure overhead. Do not start until repo is in its permanent home. Chosen approach: **GitHub Packages** (`@r1-development/vitals`), global install via `npm install -g @r1-development/vitals`.
- `[Feature]` Update notifications and `vitals update` command — on startup, non-blocking check against the registry for a newer version; if found, print a notice under the banner (e.g. `v0.2.0 available — run "vitals update" to upgrade`); also add a `vitals update` command that runs the global reinstall automatically

### Code Quality & CI

- `[Quality]` Add linting across the monorepo — add ESLint to all packages
- `[Quality]` Add quality checks to repo PRs — run vitals checks as part of PR CI
- `[Refactor]` Rename the TUI cockpit — consider names like Bridge, Pulse, etc.

## In Progress

<!-- Tasks currently being worked on -->

## Done

- `[UI/UX]` Collapse top portion of Codebase tab — allow collapsing to see a bigger view of the module graph
- Add React compiler to the web project
- Add Vitest tests to all projects
- Add tests coverage reports to all projects
- Configure coverage to show in the vitest UI for each project
