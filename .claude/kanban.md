# Kanban Board

## Roadmap

Phases run roughly sequentially. Phase 2 can begin once Phase 1 core tests are in place — it doesn't need the full testing suite to be done first.

```
Phase 1 — Testing & Hygiene   ████████░░░░░░░░░░░░░░░░░░░░░░░░
Phase 2 — Standalone Polish   ░░░░████████████░░░░░░░░░░░░░░░░  ← starts mid-P1
Phase 3 — Monorepo Support    ░░░░░░░░░░░░██████████████░░░░░░
Phase 4 — Polyglot Ecosystem  ░░░░░░░░░░░░░░░░░░░██████████░░░
Phase 5 — sickbay-py + Unified ░░░░░░░░░░░░░░░░░░░░░░░░░░░█████
```

| Phase | Focus               | Key tasks                                                                                                                                                                                                    | Unblocks                 |
| ----- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| **1** | Testing & Hygiene   | Core runner tests, CLI component tests, `sickbay-test-fixtures` repo, Playwright (web), linting, CI quality checks                                                                                            | Safe refactor in Phase 3 |
| **2** | Standalone Polish   | Fill codebase tab (TS projects), CI/CD guide, historical trends, branch diff, sickbay badge, expand command suite, version bumping, publishing & registry; **`ProjectContext` infrastructure refactor (late P2)** | Phase 3 framework work   |
| **3** | Monorepo Support    | Monorepo detection, `MonorepoReport` data shape, per-package runner scoping (uses `ProjectContext`), web tab UI, per-package coverage fix, About page dynamic, `--package` flag; **framework-specific runners (Angular, Next, Node/Express) + fixtures** | Phase 4 features         |
| **4** | Polyglot Ecosystem  | Custom plugins API, VS Code extension, `.sickbayrc` config, team dashboard, context-aware tips, Lighthouse integration                                                                                        | Phase 5                  |
| **5** | sickbay-py + Unified | Python CLI (`sickbay-py`), unified polyglot dashboard spanning both CLIs                                                                                                                                      | —                        |

> **Blocked items**: Custom plugins, VS Code ext, `.sickbayrc`, team dashboard, and context-aware tips all explicitly require Phase 3 to be complete before starting. See individual task descriptions for details.
>
> **Phase dependency note**: `ProjectContext` infrastructure (shipped late Phase 2) is a prerequisite for Phase 3 per-package runner scoping. Monorepo work builds on top of it.

---

## Task Tracking

All backlog, icebox, and in-progress tasks have been migrated to Jira:

- **Project**: [Ricochet Devs (KAN)](https://nebulord.atlassian.net/jira/software/projects/KAN/boards/1)
- **Epic**: [KAN-5 — Sickbay](https://nebulord.atlassian.net/browse/KAN-5)
- **Tickets**: KAN-87 through KAN-126 (40 tickets)

### Label Reference

| Label | Meaning |
|-------|---------|
| `auto` | Can be executed headless from a written plan |
| `collab` | Needs user in the loop for design/UX/product decisions |
| `plan-auto` | Needs a planning session, then execution can be headless |
| `blocked` | Explicitly blocked by prerequisite work |
| `tui-enhancement` | TUI-specific feature or improvement |
| `icebox` | Low priority / deferred |
| `phase-N` | Roadmap phase the task belongs to |

---

## In Progress


## Done

- `[Quality]` Audit `sickbay fix` executable commands — classified all fix suggestions as actionable (auto-applicable commands) vs guidance-only (require human judgment); stripped `command` from guidance-only fixes so they appear in Quick Wins but are excluded from `sickbay fix`; audited knip, depcheck, npm-audit, secrets, and complexity runners
- `[Feature]` Star Trek doctor rotating quotes (default theme) — severity-tiered `Quote` type on `SickbayReport` and `MonorepoReport`; 40 quotes across 6 Trek doctors (McCoy, Crusher, The Doctor, Bashir, Phlox, T'Ana) in 4 severity tiers; `getQuote()` in core selects randomly based on overall score; rendered in CLI Summary, TUI ScorePanel, and web Dashboard sidebar; `--no-quotes` flag suppresses

- `[Security]` Resolved transitive picomatch ReDoS and brace-expansion DoS vulnerabilities via `pnpm.overrides`; also includes previously resolved minimatch, rollup, and prismjs overrides
- `[Testing]` Snapshot regression testing against fixtures — Vitest snapshot tests run `runSickbay` against `react-app` and `node-api` fixtures; 17 stable checks get full snapshots, 4 unstable checks get structural assertions; runs via `pnpm test:snapshots` separate from unit tests; 48 tests total
- `[Feature]` Branch diff — `sickbay diff <branch>` compares health of current branch against another; per-check table with score deltas, color-coded arrows (regressions, improvements, unchanged, new, removed); reads baseline via `git show <branch>:.sickbay/last-report.json`; supports `--json` output; uses `execFileSync` to prevent command injection
- `[Feature]` Sickbay badge — `sickbay badge` generates shields.io static badge markdown/HTML/URL from last scan score; supports `--url`, `--html`, `--label`, `--scan`, `--package` flags; color-coded green/yellow/red based on score thresholds
- `[Task]` Rename to sickbay — updated all package names, CLI command, imports, branding, ASCII art header, and README references from vitals to sickbay; npm name `sickbay` secured
- `[Bug]` Fix knip false positives for workspace siblings — knip runner now detects workspace scope from `package.json` name and filters sibling packages from unused dependency results; fix commands use detected package manager instead of hardcoded `npm uninstall`
- `[Bug]` Fix coverage runner not finding hoisted providers — `hasCoverageProvider` now walks up directory tree to find `@vitest/coverage-v8` in parent `node_modules`; fix command uses detected package manager instead of hardcoded `npm install`
- `[Bug]` Fix index-as-key warnings in FixApp, TrendApp, ActivityPanel — replaced array index keys with stable keys derived from data (`checkId-command`, `category`, `timestamp-type`)
- `[UI/UX]` Dependency update totals + package overrides in web Dependencies tab — totals banner shows major/minor/patch pill counts; collapsible overrides section shows pnpm.overrides/npm overrides/yarn resolutions; outdated runner now classifies updates as major/minor/patch; `ProjectInfo.overrides` field added to core types
- `[Feature]` Monorepo-aware subcommands (`doctor`, `stats`, `trend`, `fix`) — added `--package` flag and auto-detection to all subcommands; shared `resolveProject` helper; per-package grouped output for doctor/stats/trend/fix; 390 tests passing

- `[Feature]` Auto-save last report to `.sickbay/last-report.json` — writes full JSON report after every scan (App.tsx, index.ts --json path, TuiApp.tsx); always overwrites; silent fail; discoverable by Claude Code and other tools without any flags
- `[UI/UX]` TUI score reveal animation — score counts up from 0 on first load, from previous score on re-scans; color transitions red→yellow→green naturally as the number crosses thresholds; 20ms/tick interval
- `[UI/UX]` TUI panel entrance animations — panels appear sequentially on startup (health→score→trend→git→quickwins→activity, 120ms stagger); `PanelBorder` renders `···` placeholder until revealed; creates cockpit powering-on feel

- `[Testing]` Add missing tests to `@sickbay/cli` — boosted from 74.26% → 80.34% statements / 82.21% lines (360 tests, 31 files); added coverage for onCheckStart/onCheckComplete callbacks, opening-web phase, FixApp keyboard navigation, QuickWinsPanel path shortening helpers, and web.ts static file serving branch
- `[Bug]` Fix Node security runners firing on non-server projects — added `isApplicable()` to `NodeSecurityRunner` and `NodeInputValidationRunner` to check for HTTP server framework presence (express, fastify, koa, etc.) before running; confirmed by scanning sickbay against itself: score went from 83 → 98
- `[Bug]` Fix ESLint runner silently scanning 0 files — runner now detects available source directories (`src`, `lib`, `app`) and returns `skipped` if none exist, instead of passing with 0 files scanned
- `[Bug]` Fix source-map-explorer not executing — SME v2.x wraps JSON output in `{ results: [...] }`, not `{ files: {}, totalBytes }`; fixed interface and parsing; now scores on largest single bundle instead of total across all chunks
- `[Bug]` Fix todo-scanner false positives on string literals — strip string literal contents before matching TODO/FIXME/HACK pattern; single-quoted, double-quoted, and single-line template literals handled
- `[Fix]` Show only applicable checks in terminal output — added `onRunnersReady` callback to `runSickbay`; progress list and results now only show checks that actually ran for the detected project type; react-perf and asset-size no longer appear on Node apps
- `[Fix]` Framework and package manager detection improvements — `detectFramework` now detects express/fastify/koa/hapi and returns `node` as fallback instead of `unknown`; `detectPackageManager` walks up the directory tree to find lock files in monorepo roots; coverage fix command uses `${packageManager} test` instead of hardcoded `vitest run`
- `[Refactor]` `ProjectContext` infrastructure — rich `ProjectContext` type (`frameworks`, `runtime`, `buildTool`, `testFramework`); declarative `applicableFrameworks`/`applicableRuntimes` on `BaseRunner`; runner filtering done once in `runner.ts` rather than per-runner filesystem checks
- `[Feature]` Framework-scoped checks — all runners migrated to declarative scoping; Node-specific runners added (`NodeSecurity`, `NodeInputValidation`, `NodeAsyncErrors`); verified against `react-app` and `node-api` fixtures
- `[Testing]` Add missing tests to `@sickbay/core` — **97.16% statements**, all integrations covered
- `[Testing]` Test fixtures — `fixtures/packages/react-app` and `fixtures/packages/node-api` live in the monorepo as a standalone pnpm workspace; `node-api` has intentional issues (secrets, circular deps, outdated packages, etc.)
- `[Docs]` Document how to add a new test fixture — covered in `CONTRIBUTING.md`
- `[Docs]` Adding a new language — stub section in `CONTRIBUTING.md`, full docs deferred to Phase 4
- `[Docs]` How to run the project locally — covered in `CONTRIBUTING.md`

- `[Feature]` Suggestions from Claude — Claude suggested additional feature ideas: "Explain this" in the TUI, Sickbay badge, `.sickbayrc` config, multi-repo team dashboard, dependency upgrade preview, and branch diff; all added to backlog
- `[UI/UX]` Collapse top portion of Codebase tab — allow collapsing to see a bigger view of the module graph
- `[Quality]` Add linting across the monorepo — ESLint configured at root with TS + React + hooks plugins; all packages have `lint` scripts; `turbo run lint` runs all
- `[Refactor]` Rename the TUI cockpit to `tui` — command is now `sickbay tui`, directory renamed to `src/components/tui/`, component renamed to `TuiApp`
- `[UI/UX]` Remove Future Enhancements page and its button from the About page
- `[UI/UX]` Remove CRT overlay easter egg
- Add React compiler to the web project
- Add Vitest tests to all projects
- Add tests coverage reports to all projects
- Configure coverage to show in the vitest UI for each project
- `[Feature]` Historical Trends — `sickbay init` scaffolds `.sickbay/` with `.gitignore` and `baseline.json`; history stored in `<projectPath>/.sickbay/history.json`; exposed via `/sickbay-history.json` HTTP endpoint; web dashboard shows a History tab with SVG line chart, toggleable category lines, score delta, and empty state
- `[Bug]` Fix test count showing zero in web Codebase tab — root causes: (1) `execa` `preferLocal` without `localDir` resolved sickbay' own vitest instead of the project's; (2) stdout parsing was fragile when `vite.config.ts` emitted `console.log` before JSON output; fixed by adding `localDir: projectPath` and switching to `--outputFile` temp file approach
- `[UI/UX]` TUI column widths — bumped Health Checks name column from 18 to 26 chars (fits all check names); passed calculated `availableWidth` from `columns` to `QuickWinsPanel` so it uses actual terminal width instead of the 22-char default
- `[UI/UX]` TUI package manager detection — `QuickWinsPanel` and `QuickWins` now replace hardcoded `npm` commands with the detected package manager (`pnpm add`, `yarn add`, `bun add`, etc.) using `report.projectInfo.packageManager`
- `[Bug]` Fix index-as-key in web dashboard components — original four spots (AISummary, CriticalIssues, IssuesList, ScoreCard) were already using stable keys; fixed remaining index-as-key issues in `HistoryChart.tsx` (X-axis labels and score dots now use `e.timestamp`) and `ChatDrawer.tsx` (messages now use `${msg.role}-${i}`)
- `[Docs]` Scoring documentation — `docs/scoring.md`; covers category weights, overall score formula, all 20 checks with score formulas, issue severity thresholds, status thresholds, applicability conditions, and JSON output structure
- `[Feature]` Monorepo detection and per-package reporting — auto-detects pnpm/npm/yarn/turbo/nx/lerna workspaces; discovers packages via glob expansion; runs all checks per-package in parallel via `runSickbayMonorepo()`; `MonorepoReport` / `PackageReport` types added; `--package <name>` flag scopes to a single package; terminal output shows per-package score table with score bars, framework, critical count; TUI shows `MonorepoPanel` banner + mini scoreboard in place of QuickWins; rotating loading messages during scan
- `[UI/UX]` Monorepo web dashboard — sidebar package list with scores; Overview tab with `MonorepoOverview` scoreboard (score rings, cross-package quick wins, aggregate summary); per-package drill-in reuses all existing Dashboard tabs (checks, issues, dependencies, codebase); AI insights and VAI assistant available per-package drill-in view; history tab hidden for per-package views
- `[Feature]` About page dynamic per project type — checks list and descriptions in the About tab render from `report.checks` dynamically; content changes based on whether the project is React, Node, etc.; confirmed working across fixture packages
