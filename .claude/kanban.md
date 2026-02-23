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
- `[Feature]` Monorepo detection — identify monorepos, determine how vitals runs across multiple apps, include language/framework detection (see vitals-monorepo-design.md)
- `[Feature]` Add a vitals-py variant to the CLI — Python equivalent scanning using same terminal and web views
- `[Feature]` Add more commands like `trends` and `doctor` — brainstorm other commands for quick visualizations
- `[Feature]` Update About page to show checks based on language — when polyglot features land, show only checks that ran
- `[Feature]` Replace Claude Code API key with Enterprise license — support both enterprise and personal API key options
- `[Feature]` Suggestions from Claude — have Claude suggest additional feature ideas for the app
- `[Feature]` Add tips to quick wins — surface tips like "use the React compiler" or "ESLint isn't fully configured"

### UI/UX
- `[UI/UX]` Dependency Tree Visualization — interactive graph of dependency tree highlighting vulnerabilities, outdated packages, and circular imports
- `[UI/UX]` Add tabs per project in the UI for a Monorepo — show a tab per project plus an overall summary dashboard
- `[UI/UX]` Collapse top portion of Codebase tab — allow collapsing to see a bigger view of the module graph

### Documentation
- `[Docs]` Incremental checks — document only rerunning checks on changed files between commits (18x speedup for large codebases)
- `[Docs]` Adding a new language — docs for how to add a new language for scanning and checks
- `[Docs]` How to run the project locally — setup guide including global install steps
- `[Docs]` Document patterns for AI consistency — scan monorepo for code patterns and document them for AI working on Vitals
- `[Docs]` Add screenshots to the READMEs — add visuals of the app to package READMEs
- `[Docs]` Create SKILLS.md and reference files — have Claude suggest what skill files and other docs would be useful

### Code Quality & CI
- `[Quality]` Add linting across the monorepo — add ESLint to all packages
- `[Quality]` Add quality checks to repo PRs — run vitals checks as part of PR CI
- `[Refactor]` Rename the TUI cockpit — consider names like Bridge, Pulse, etc.

## In Progress

<!-- Tasks currently being worked on -->

## Done

- Add React compiler to the web project
- Add Vitest tests to all projects
- Add tests coverage reports to all projects
- Configure coverage to show in the vitest UI for each project
