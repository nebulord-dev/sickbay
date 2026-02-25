# Kanban Board

## Roadmap

Phases run roughly sequentially. Phase 2 can begin once Phase 1 core tests are in place — it doesn't need the full testing suite to be done first.

```
Phase 1 — Testing & Hygiene   ████████░░░░░░░░░░░░░░░░░░░░░░░░
Phase 2 — Standalone Polish   ░░░░████████████░░░░░░░░░░░░░░░░  ← starts mid-P1
Phase 3 — Monorepo Support    ░░░░░░░░░░░░████████░░░░░░░░░░░░
Phase 4 — Polyglot Ecosystem  ░░░░░░░░░░░░░░░░░░░██████████░░░
Phase 5 — vitals-py + Unified ░░░░░░░░░░░░░░░░░░░░░░░░░░░█████
```

| Phase | Focus               | Key tasks                                                                                                                                                | Unblocks                 |
| ----- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **1** | Testing & Hygiene   | Core runner tests, CLI component tests, `vitals-test-fixtures` repo, Playwright (web), linting, CI quality checks                                        | Safe refactor in Phase 3 |
| **2** | Standalone Polish   | Fill codebase tab (TS projects), CI/CD guide, historical trends, branch diff, vitals badge, expand command suite, version bumping, publishing & registry | —                        |
| **3** | Monorepo Support    | Monorepo detection, `MonorepoReport` data shape, per-package runner, web tab UI, per-package coverage fix, About page dynamic, `--package` flag          | Phase 4 features         |
| **4** | Polyglot Ecosystem  | Custom plugins API, VS Code extension, `.vitalsrc` config, team dashboard, context-aware tips, Lighthouse integration                                    | Phase 5                  |
| **5** | vitals-py + Unified | Python CLI (`vitals-py`), unified polyglot dashboard spanning both CLIs                                                                                  | —                        |

> **Blocked items**: Custom plugins, VS Code ext, `.vitalsrc`, team dashboard, and context-aware tips all explicitly require Phase 3 to be complete before starting. See individual task descriptions for details.

---

## Backlog

### General

- `[Task]` Scan the vitals project with the vitals CLI — run `vitals` against this monorepo and review the results; use findings to identify gaps and inform future work

### Features

- `[Feature]` Historical Trends — track score changes over time, store past reports locally, visualize trends in a line chart
- `[Feature]` CI/CD Integration Guide — pre-built GitHub Actions and GitLab CI templates, auto-comment PR summaries with score deltas, fail builds on critical thresholds; a basic single-project template can be built now, but monorepo support will require matrix build strategies and per-package runs — plan for a v2 of the templates once monorepo detection lands
- `[Feature]` Lighthouse Integration — run Lighthouse audits for Web Vitals (LCP, FID, CLS) alongside code health checks with unified performance scoring
- `[Feature]` Custom check API for plugins — plug-in system for adding custom runners with a simple interface; do not implement before polyglot work is complete — the runner interface (language scoping, category registration, how checks are discovered) will change significantly once multi-language support lands; building this now would mean redesigning the plugin API twice
- `[Feature]` AI quick fixes — let Claude suggest and apply one-click fixes for unused imports, outdated deps, missing docs; maybe a `vitals --fix` command
- `[Feature]` VS Code Extension — inline warnings in editor, run checks on Save, show issues in the gutter; do not implement before monorepo and polyglot work is complete — the extension needs to know which package the user is editing in a monorepo, which language/framework applies, and which checks are relevant; building it now against a single-project JS assumption would require a significant rewrite later
- `[Feature]` Framework-scoped checks — ensure each runner only runs when relevant to the detected framework/runtime, and add framework-specific checks where gaps exist; currently most checks gray out on non-React projects (e.g. the node-api fixture) because `isApplicable()` correctly skips them but there are no Node-specific replacements; work needed: (1) audit every runner's `isApplicable()` to confirm it correctly detects React vs Node vs vanilla TS vs other; (2) identify gaps where a framework has no targeted checks (e.g. Node APIs have no Express/Fastify-specific checks, no middleware audit, no route complexity check); (3) add Node-specific runners to fill those gaps; (4) verify against fixtures — running vitals on `fixtures/packages/react-app` should show a full React-appropriate check suite, and `fixtures/packages/node-api` should show a full Node-appropriate suite with minimal grayout; depends on reliable framework detection, which is part of the monorepo work but can be partially addressed now for the two known frameworks
- `[Feature]` Fill the codebase tab out on all TypeScript-based projects — currently only fully populated on web projects
- `[Feature]` Monorepo detection — identify monorepos, determine how vitals runs across multiple apps, include language/framework detection (see vitals-monorepo-design.md); as part of this, fix coverage reporting to run per-package and aggregate results — currently running from the monorepo root instruments all source files including untested integration runners in `core`, producing misleadingly low numbers (~43%) despite per-package coverage being 95%+
- `[Feature]` Add a vitals-py variant to the CLI — Python equivalent scanning using same terminal and web views; this task IS polyglot work and should not be started until the polyglot architecture is established in `core` — building it beforehand risks creating a parallel codebase that has to be painfully retrofitted later; the right approach is to implement Python checks as first-class runners within the existing architecture once language detection and multi-language runner registration are in place
- `[Feature]` Expand the command suite — `trends` and `doctor` already exist; brainstorm and build additional commands in the same spirit (e.g. `vitals compare`, `vitals explain`, `vitals export`) that surface quick, focused visualizations or workflows without running a full scan
- `[Feature]` Make About page fully dynamic for polyglot support — the checks list already renders from `report.checks` dynamically, but `CHECK_DESCRIPTIONS` in `About.tsx` is a hardcoded map; as Python, Angular, Node etc. checks are added, their descriptions would need to be manually added to the web package; the fix is to move `description` onto each runner's `CheckResult` in `core` so the About page can just render `check.description` with no hardcoded map needed; do not implement until the polyglot/language detection work is underway
- `[Feature]` Replace Claude Code API key with Enterprise license — support both enterprise and personal API key options
- `[Feature]` Add context-aware tips to quick wins — surface tips like "use the React compiler" or "ESLint isn't fully configured", but tips must be framework/language aware (a React compiler tip is meaningless on Angular or Node); requires: (1) reliable framework detection from the polyglot/monorepo work, (2) a tip registry where each tip declares the context it applies to (framework, language, tooling), and (3) tip prioritization based on check scores; do not implement until framework detection is stable
- `[Feature]` "Explain this" in the TUI — press `e` on a selected check in the Health panel to open a Claude-powered overlay explaining what the issue means and how to fix it without leaving the terminal; the Health panel currently shows check names and scores but doesn't support individual check selection, so this needs: (1) arrow-key navigation to select a specific check row, (2) a full-screen or side overlay component to render the AI response, (3) streaming Claude output so the explanation appears progressively; requires `ANTHROPIC_API_KEY`
- `[Feature]` Vitals badge — `vitals badge` generates a shields.io-style markdown/HTML badge showing the project health score, color-coded green/yellow/red; badge could be static (generated once) or dynamic (served via a small endpoint); great for open source README visibility
- `[Feature]` `.vitalsrc` config file — allow projects to customize check weights, per-check score thresholds, excluded paths, and which checks to run via a `.vitalsrc.json` (or `vitals` key in `package.json`); zero-config remains the default but power users need this; will require re-architecture of how `runVitals()` receives its config in `core`; do not implement before monorepo and polyglot work is complete — the config schema (per-package overrides, language-specific check toggles, workspace-level vs package-level settings) will be substantially more complex in a polyglot monorepo context; building a single-project schema now means redesigning it entirely later
- `[Feature]` Multi-repo team dashboard — `vitals team --repos ./repos.json` scans multiple repos and shows an aggregated web dashboard with per-repo health scores, a team-level rollup, and the ability to drill into any individual project; ideal for agencies or platform teams managing many codebases; do not implement before monorepo detection lands — how repos are discovered and scanned will change once monorepo support exists, and the dashboard will need per-package drill-down within a monorepo, not just per-repo
- `[Feature]` Dependency upgrade preview — after a scan, show projected score impact of upgrading all outdated deps: "upgrading 8 packages would raise your score from 72 → 86"; could use `npm outdated` data + a simulated re-score without actually running the upgrade
- `[Feature]` Branch diff — `vitals diff main` (or `vitals diff <branch>`) compares health of the current branch against another; shows which checks regressed, which improved, and the overall delta; different from trend (historical over time) — this is branch-aware and perfect as a pre-push check or auto-comment on PRs

### UI/UX

- `[UI/UX]` Dependency Tree Visualization — interactive graph of dependency tree highlighting vulnerabilities, outdated packages, and circular imports
- `[UI/UX]` Add tabs per project in the UI for a Monorepo — when vitals detects a monorepo, the web view shows an Overview tab plus one tab per package; the Overview tab is a health dashboard summarising the whole repo: a score card grid showing each package's overall score, a rollup of total critical/warning/info counts, and quick wins across all packages; clicking a package tab switches to the standard full web view for that package (checks, scores, issues, dependency graph, etc.) scoped to just that package's report; the existing single-package dashboard components should be reusable per-tab with no changes — the tab just controls which `PackageReport` gets passed in; blocked by monorepo detection and the `MonorepoReport` data shape (Phase 3)
- `[UI/UX]` Remove Future Enhancements page and its button from the About page — the tab and the button that navigates to it should both be deleted
- `[UI/UX]` Remove CRT overlay easter egg — find and delete the CRT scanline/flicker overlay effect and any toggle that enables it
- `[UI/UX]` Light theme support — add a light theme to the web dashboard with a toggle to switch between light and dark; dark remains the default

### Testing

- `[Testing]` Add Playwright tests to the web project — add end-to-end tests covering key dashboard interactions (tab switching, collapsible sections, dependency graph, AI drawer)
- `[Testing]` Add missing tests to `@vitals/cli` — `CheckResult`, `ProgressList`, `Header`, `history.ts`, and `project-hash.ts` now covered; still needs: `App`, all tui components and hooks, commands (`web`, `doctor`, `fix`, `stats`, `trend`). Let's get all projects to around 90% coverage.
- `[Testing]` Add missing tests to `@vitals/core` — `runner.ts`, `detect-project.ts`, `npm-audit.ts`, `eslint.ts`, `git.ts`, `typescript.ts`, `outdated.ts`, `coverage.ts` now covered; still needs: `madge.ts`, `jscpd.ts`, `depcheck.ts`, `secrets.ts`, `heavy-deps.ts`, `react-perf.ts`, `asset-size.ts`, `todo-scanner.ts`, `complexity.ts`, `license-checker.ts`, `source-map-explorer.ts`
- `[Testing]` Create `vitals-test-fixtures` repo — separate repo with fixture projects for testing Vitals against real project types; each fixture is self-contained in its own subfolder: `react-app/`, `angular-app/`, `ts-lib/`, `node-api/`, and `monorepo/` (Option B: a nested pnpm workspace with its own `pnpm-workspace.yaml` and sub-packages inside); some fixtures should intentionally contain known issues (outdated deps, circular imports, vulnerabilities) to verify Vitals catches them correctly

### Documentation

- `[Docs]` Incremental checks — document only rerunning checks on changed files between commits (18x speedup for large codebases)
- `[Docs]` Document patterns for AI consistency — scan monorepo for code patterns and document them for AI working on Vitals
- `[Docs]` Add screenshots to the READMEs — add visuals of the app to package READMEs
- `[Docs]` Create SKILLS.md and reference files — have Claude suggest what skill files and other docs would be useful

### Versioning

- `[Feature]` Auto-increment Vitals CLI version — set up automated version bumping (e.g. via `changesets` or a release script); display the current version number beneath the Vitals banner in the terminal UI
- `[Feature]` Set up publishing and registry — once repo is moved to its permanent home, configure Changesets + `@changesets/action` GitHub Action and decide on registry strategy: (a) **public npm** — unscoped, `npx vitals` just works, no `.npmrc` needed for consumers, but code is public; (b) **GitHub Packages** — requires scoped package (e.g. `@acme/vitals`), so consumers must run `npx @acme/vitals` and need an `.npmrc` with a GitHub PAT; (c) **self-hosted registry** (Verdaccio/Artifactory) — supports unscoped but adds infrastructure overhead. Do not start until repo is in its permanent home. Chosen approach: **GitHub Packages** (`@r1-development/vitals`), global install via `npm install -g @r1-development/vitals`.
- `[Feature]` Update notifications and `vitals update` command — on startup, non-blocking check against the registry for a newer version; if found, print a notice under the banner (e.g. `v0.2.0 available — run "vitals update" to upgrade`); also add a `vitals update` command that runs the global reinstall automatically

### Code Quality & CI

- `[Quality]` Add quality checks to repo PRs — run vitals checks as part of PR CI; no GitHub Actions workflows exist yet

## In Progress

<!-- Tasks currently being worked on -->

## Done

- `[Docs]` Document how to add a new test fixture — covered in `CONTRIBUTING.md`
- `[Docs]` Adding a new language — stub section in `CONTRIBUTING.md`, full docs deferred to Phase 4
- `[Docs]` How to run the project locally — covered in `CONTRIBUTING.md`

- `[Feature]` False positive suppression — allow users to mark specific findings as intentional/irrelevant so they stop appearing in results
- `[Feature]` Suggestions from Claude — Claude suggested additional feature ideas: "Explain this" in the TUI, Vitals badge, `.vitalsrc` config, multi-repo team dashboard, dependency upgrade preview, and branch diff; all added to backlog
- `[UI/UX]` Collapse top portion of Codebase tab — allow collapsing to see a bigger view of the module graph
- `[Quality]` Add linting across the monorepo — ESLint configured at root with TS + React + hooks plugins; all packages have `lint` scripts; `turbo run lint` runs all
- `[Refactor]` Rename the TUI cockpit to `tui` — command is now `vitals tui`, directory renamed to `src/components/tui/`, component renamed to `TuiApp`
- Add React compiler to the web project
- Add Vitest tests to all projects
- Add tests coverage reports to all projects
- Configure coverage to show in the vitest UI for each project
