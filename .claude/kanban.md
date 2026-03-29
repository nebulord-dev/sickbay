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

## Automation Tags

> **`[Auto]`** — Can be executed headless from a written plan. No mid-task judgment calls needed.
> **`[Collab]`** — Needs you in the loop for design decisions, UX judgment, or product direction.
> **`[Plan→Auto]`** — Needs a planning session together, then execution can be headless.

---

## Backlog

### General

- `[Task]` `[Auto]` Migrate Sickbay kanban to Jira — transfer all Backlog, Icebox, and In Progress tasks from `.claude/kanban.md` to the Ricochet Devs project (KAN) in Jira under a Sickbay epic; preserve task descriptions, automation tags, and blocking notes; once complete, remove task content from kanban.md and leave a pointer to Jira
- `[Task]` `[Auto]` Scan the sickbay project with the sickbay CLI — run `sickbay` against this monorepo and review the results; use findings to identify gaps and inform future work

### Features

- `[Feature]` `[Collab]` Claude Code skill for Sickbay — a static, evergreen skill file covering: where the report lives (`.sickbay/last-report.json`), the JSON schema shape (`SickbayReport`, `CheckResult`, `Issue`), score interpretation (0–100, 80+ green, 60–79 yellow, <60 red), severity levels (critical/warning/info), and how to act on fix suggestions (`issue.fix.command`); content is deliberately high-level so it never goes stale; ship as a doc (`docs/claude-skill.md`) and optionally as `sickbay claude` command that writes it to `.claude/skills/sickbay.md` in the target project
- `[Feature]` `[Plan→Auto]` CI/CD Integration Guide — pre-built GitHub Actions and GitLab CI templates, auto-comment PR summaries with score deltas, fail builds on critical thresholds; a basic single-project template can be built now, but monorepo support will require matrix build strategies and per-package runs — plan for a v2 of the templates once monorepo detection lands
- `[Feature]` `[Collab]` Lighthouse Integration — run Lighthouse audits for Web Sickbay (LCP, FID, CLS) alongside code health checks with unified performance scoring
- `[Feature]` `[Collab]` Custom check API for plugins — plug-in system for adding custom runners with a simple interface; do not implement before polyglot work is complete — the runner interface (language scoping, category registration, how checks are discovered) will change significantly once multi-language support lands; building this now would mean redesigning the plugin API twice
- `[Feature]` `[Collab]` AI quick fixes — let Claude suggest and apply one-click fixes for unused imports, outdated deps, missing docs; maybe a `sickbay --fix` command
- `[Feature]` `[Collab]` VS Code Extension — inline warnings in editor, run checks on Save, show issues in the gutter; do not implement before monorepo and polyglot work is complete — the extension needs to know which package the user is editing in a monorepo, which language/framework applies, and which checks are relevant; building it now against a single-project JS assumption would require a significant rewrite later
- `[Feature]` `[Plan→Auto]` Fill the codebase tab out on all TypeScript-based projects — currently only fully populated on web projects
- `[Feature]` `[Collab]` Add a sickbay-py variant to the CLI — Python equivalent scanning using same terminal and web views; this task IS polyglot work and should not be started until the polyglot architecture is established in `core` — building it beforehand risks creating a parallel codebase that has to be painfully retrofitted later; the right approach is to implement Python checks as first-class runners within the existing architecture once language detection and multi-language runner registration are in place
- `[Feature]` `[Collab]` Expand the command suite — `trends` and `doctor` already exist; brainstorm and build additional commands in the same spirit (e.g. `sickbay compare`, `sickbay explain`, `sickbay export`) that surface quick, focused visualizations or workflows without running a full scan
- `[Feature]` `[Plan→Auto]` Replace Claude Code API key with Enterprise license — support both enterprise and personal API key options
- `[Feature]` `[Collab]` Add context-aware tips to quick wins — surface tips like "use the React compiler" or "ESLint isn't fully configured", but tips must be framework/language aware (a React compiler tip is meaningless on Angular or Node); requires: (1) reliable framework detection from the polyglot/monorepo work, (2) a tip registry where each tip declares the context it applies to (framework, language, tooling), and (3) tip prioritization based on check scores; do not implement until framework detection is stable
- `[Feature]` `[Collab]` "Explain this" in the TUI — press `e` on a selected check in the Health panel to open a Claude-powered overlay explaining what the issue means and how to fix it without leaving the terminal; the Health panel currently shows check names and scores but doesn't support individual check selection, so this needs: (1) arrow-key navigation to select a specific check row, (2) a full-screen or side overlay component to render the AI response, (3) streaming Claude output so the explanation appears progressively; requires `ANTHROPIC_API_KEY`
- `[Feature]` `[Collab]` Project config (`sickbay.config.ts`) and `.sickbay/` data folder — allow projects to calibrate check thresholds to their own standards (e.g. raise the max lines-per-file from 300 to 800 for a codebase with established conventions); scores reflect the project's health against its declared standards, with a visible "custom thresholds in effect" notice in TUI and web; config lives at root as `sickbay.config.ts` (TypeScript, `defineConfig` helper, executed via `jiti`); generated project data lives in `.sickbay/` (history, cache, baseline); `sickbay init` scaffolds both; web dashboard gets a Config tab showing active vs default values; see `docs/plans/sickbay-config-design.md` for full design; do not implement before monorepo and polyglot work is complete — the config schema will need per-package overrides in Phase 3 and building a single-project schema now means extending it carefully later
- `[Feature]` `[Collab]` False positive suppression — allow users to mark specific check findings as intentional/irrelevant so they stop appearing in results (e.g. a helmet-less Express app behind a proxy, a "secret" that's actually a public key, an async handler pattern the scanner can't distinguish from an unprotected one); natural home is `.sickbayrc` — a `suppress` key per check id; do not implement before `.sickbayrc` lands, as the suppression config needs to live somewhere stable
- `[Feature]` `[Collab]` Multi-repo team dashboard — `sickbay team --repos ./repos.json` scans multiple repos and shows an aggregated web dashboard with per-repo health scores, a team-level rollup, and the ability to drill into any individual project; ideal for agencies or platform teams managing many codebases; do not implement before monorepo detection lands — how repos are discovered and scanned will change once monorepo support exists, and the dashboard will need per-package drill-down within a monorepo, not just per-repo
- `[Feature]` `[Plan→Auto]` Dependency upgrade preview — after a scan, show projected score impact of upgrading all outdated deps: "upgrading 8 packages would raise your score from 72 → 86"; could use `npm outdated` data + a simulated re-score without actually running the upgrade

### UI/UX

- `[UI/UX]` `[Collab]` Dependency Tree Visualization — interactive graph of dependency tree highlighting vulnerabilities, outdated packages, and circular imports

### Epic: TUI Enhancements

- `[Feature]` `[Plan→Auto]` Monorepo-aware TUI — add `--package` flag to `sickbay tui`; without it, show a package picker or aggregate dashboard at monorepo roots
- `[Feature]` `[Collab]` "Explain this" in the TUI — press `e` on a selected check to open a Claude-powered overlay explaining the issue and how to fix it; needs check selection, overlay component, streaming output; requires `ANTHROPIC_API_KEY`
- `[UI/UX]` `[Plan→Auto]` TUI live score feedback — when a background re-scan completes and a score changes, the relevant panel border briefly pulses red (regression) or green (improvement)
- `[Feature]` `[Collab]` TUI issue drill-down with file preview — press Enter on a selected check to open a half-screen overlay showing file path and relevant lines with ANSI syntax highlighting; needs: file+line metadata on check results, file-excerpt renderer, overlay with scroll
- `[Feature]` `[Collab]` TUI command palette — press `:` to open a vim-style input bar; supports commands like `scan`, `export`, `open web`, `compare <branch>`, `theme <name>`
- `[UI/UX]` `[Plan→Auto]` TUI mouse support — click panel to focus, scroll wheel in Health and Activity panels; Ink has mouse support via `useInput` — needs investigation
- `[Feature]` `[Collab]` TUI resizable panels — `[` / `]` to shrink/grow focused panel; persist layout to `.sickbayrc`; blocked by config support
- `[Feature]` `[Plan→Auto]` TUI diff mode — `sickbay tui --diff <branch>` shows two score columns (current vs branch) with delta indicators per check
### Testing

- `[Testing]` `[Auto]` Extract fixtures to a dedicated private `sickbay-test-fixtures` repo — **primary driver is security compliance**: `node-api` contains intentional hardcoded secrets and vulnerable dependencies that will fail GitHub Enterprise security scanning and block Sickbay from reaching any internal main branch or environment; a private repo is not subject to the same scanning gates; secondary benefits: (1) CI clones the fixtures repo on demand instead of bundling it; (2) fixtures can have their own permissive security policy since issues are intentional by design; (3) versioned independently — sickbay CI can pin to a specific fixtures tag; migration path is clean since `fixtures/` is already a separate pnpm workspace — extract the directory, `git init`, push to new private repo, update CI workflow to clone it, remove `fixtures/` from the sickbay workspace; **this should be done before Sickbay is pushed to any internal infrastructure**


- `[Testing]` `[Plan→Auto]` Add Playwright tests to the web project — add end-to-end tests covering key dashboard interactions (tab switching, collapsible sections, dependency graph, AI drawer)

- `[Feature]` `[Plan→Auto]` `/create-fixture` skill — scaffold a new test fixture package under `fixtures/packages/<framework>/` from the command line (e.g. `/create-fixture angular` or `/create-fixture nextjs vue`); skill should generate a realistic `package.json` with framework-appropriate outdated deps, source files with intentional issues (circular deps, fake secrets, TODOs, complexity, no tests), run `pnpm install` from the fixtures root, and append a section to `fixtures/README.md` documenting what's broken; **do not build until framework-scoped checks exist for the target framework** — scaffolding an Angular fixture is only useful if Sickbay has Angular-specific checks to run against it; this skill and the framework-scoped checks task should ship together

### Documentation

- `[Docs]` `[Auto]` Incremental checks — document only rerunning checks on changed files between commits (18x speedup for large codebases)
- `[Docs]` `[Auto]` Document patterns for AI consistency — scan monorepo for code patterns and document them for AI working on Sickbay
- `[Docs]` `[Auto]` Add screenshots to the READMEs — add visuals of the app to package READMEs
- `[Docs]` `[Auto]` Create SKILLS.md and reference files — have Claude suggest what skill files and other docs would be useful

### Security


### Versioning

- `[Feature]` `[Plan→Auto]` Auto-increment Sickbay CLI version — set up automated version bumping (e.g. via `changesets` or a release script); display the current version number beneath the Sickbay banner in the terminal UI
- `[Feature]` `[Collab]` Set up publishing and registry — once repo is moved to its permanent home, configure Changesets + `@changesets/action` GitHub Action and decide on registry strategy: (a) **public npm** — unscoped, `npx sickbay` just works, no `.npmrc` needed for consumers, but code is public; (b) **GitHub Packages** — requires scoped package (e.g. `@acme/sickbay`), so consumers must run `npx @acme/sickbay` and need an `.npmrc` with a GitHub PAT; (c) **self-hosted registry** (Verdaccio/Artifactory) — supports unscoped but adds infrastructure overhead. Do not start until repo is in its permanent home. Chosen approach: **GitHub Packages** (`@r1-development/sickbay`), global install via `npm install -g @r1-development/sickbay`.
- `[Feature]` `[Plan→Auto]` Update notifications and `sickbay update` command — on startup, non-blocking check against the registry for a newer version; if found, print a notice under the banner (e.g. `v0.2.0 available — run "sickbay update" to upgrade`); also add a `sickbay update` command that runs the global reinstall automatically

### Code Quality & CI

- `[Quality]` `[Plan→Auto]` Add quality checks to repo PRs — run sickbay checks as part of PR CI; no GitHub Actions workflows exist yet
- `[Quality]` `[Collab]` Migrate to Vite+ — replace ESLint, Prettier, and Vitest with Vite+ unified tooling (formatting, linting, testing in one config); Vite+ is currently in alpha — track progress and migrate when stable

## Icebox


- `[UI/UX]` `[Collab]` Light theme support — add a light theme to the web dashboard with a toggle to switch between light and dark; dark remains the default
- `[Feature]` `[Plan→Auto]` Project-type-aware file length thresholds — replace the hardcoded 400-line component warning with per-file-type thresholds based on project context and filename conventions; detection via filename pattern matching (e.g. `Button.tsx` → component, `useAuth.ts` → hook, `userService.ts` → service, `Button.test.tsx` → exempt); proposed thresholds: React components 300 (warn) / 500 (error), custom hooks 150/250, Node modules/services 500/800, route files/controllers 250/400, TS utility/lib files 600/1000, TS classes 300/500, test files exempt, config files exempt; thresholds defined in a single config object in core for easy tuning; warning message should name the detected file type (e.g. "Hook useAuth.ts exceeds 150 lines") not just say "component too long"
- `[Feature]` `[Collab]` Themeable personality quotes — Foundation shipped: built-in Star Trek quotes, `getQuote` API, `Quote` type on report, `--no-quotes` flag. Remaining: config-driven theme selection, community theme packages, user quote overrides via `sickbay.config.ts`

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
