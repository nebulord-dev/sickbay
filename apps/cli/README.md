# sickbay

The terminal interface for Sickbay. Published to npm as the unscoped `sickbay` package. Built with [Ink](https://github.com/vadimdemedes/ink) (React for terminals) and [Commander](https://github.com/tj/commander.js).

## Quickstart

```bash
# Terminal
npx sickbay

# Web
npx sickbay --web

# TUI
npx sickbay --tui
```

## Usage

```bash
sickbay [options]
```

### Commands

| Command            | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `init [options]`   | Scaffold `.sickbay/`, run baseline scan, seed history              |
| `fix [options]`    | Interactively fix issues found by sickbay scan                     |
| `trend [options]`  | Show score history and trends over time                            |
| `stats [options]`  | Show a quick codebase overview and project summary                 |
| `doctor [options]` | Diagnose project setup and configuration issues                    |
| `tui [options]`    | Persistent live dashboard with file watching and activity tracking |

### Flags

| Flag                   | Default         | Description                       |
| ---------------------- | --------------- | --------------------------------- |
| `-p, --path <path>`    | `process.cwd()` | Path to the project to analyze    |
| `-c, --checks <names>` | all             | Comma-separated check IDs to run  |
| `--json`               | false           | Output raw JSON to stdout (no UI) |
| `--web`                | false           | Open web dashboard after scan     |
| `--verbose`            | false           | Show tool output during checks    |
| `-V, --version`        |                 | Print version                     |
| `-h, --help`           |                 | Show help                         |

### Examples

```bash
# Analyze current directory
sickbay

# Analyze another project
sickbay -p ~/projects/my-app

# Run specific checks only
sickbay --checks knip,npm-audit,depcheck

# JSON output for CI
sickbay --json | jq '.overallScore'

# Get just the summary
sickbay --json | jq '.summary'

# List all check names and their scores
sickbay --json | jq '.checks[] | {name, score}'

# Get only failing checks
sickbay --json | jq '.checks[] | select(.status == "fail")'

# Open web dashboard
sickbay --web

# Initialize .sickbay/ folder with baseline scan
sickbay init

# Initialize for a specific project
sickbay init --path ~/projects/my-app

# Interactively fix issues
sickbay fix

# View score history and trends
sickbay trend

# Get quick project stats
sickbay stats

# Diagnose project setup
sickbay doctor

# Launch tui dashboard (current directory, file watching enabled)
sickbay tui

# TUI for a specific project, disable file watching
sickbay tui --path ~/projects/my-app --no-watch

# TUI with faster auto-refresh (60 seconds) and specific checks only
sickbay tui --path ~/projects/my-app --refresh 60 --checks knip,npm-audit,eslint
```

## `sickbay init` vs `sickbay`

**Run `sickbay init` once when setting up a project for the first time.**

It scaffolds the `.sickbay/` data folder, saves a `baseline.json` snapshot of the project's current health, and wires up `.gitignore` entries so `history.json` doesn't pollute your repo. Think of it as "onboarding" Sickbay to a project.

**Run `sickbay` for every subsequent scan.**

Each scan automatically appends an entry to `.sickbay/history.json`, so your score trend builds up over time without any extra steps. The History tab in the web dashboard (`sickbay --web`) reads from this file.

|                           | First time     | Ongoing        |
| ------------------------- | -------------- | -------------- |
| Command                   | `sickbay init` | `sickbay`      |
| Creates `.sickbay/`       | ✓              | ✓ (if missing) |
| Saves `baseline.json`     | ✓              | ✗              |
| Updates root `.gitignore` | ✓              | ✗              |
| Appends to `history.json` | ✓              | ✓              |

> If you skip `sickbay init` and go straight to `sickbay`, history will still accumulate — you just won't have a baseline snapshot or gitignore entries for `.sickbay/`. But you can always ignore it manually.

## TUI Dashboard

`sickbay tui` opens a persistent split-pane TUI that continuously monitors your project. Unlike a one-shot scan, it stays running, watches for file changes, and lets you interact with results in real time.

### TUI Flags

| Flag                    | Default         | Description                           |
| ----------------------- | --------------- | ------------------------------------- |
| `-p, --path <path>`     | `process.cwd()` | Project path to monitor               |
| `--no-watch`            | watch enabled   | Disable file-watching auto-refresh    |
| `--refresh <seconds>`   | `300`           | Auto-refresh interval in seconds      |
| `-c, --checks <checks>` | all             | Comma-separated list of checks to run |

### Panels

The tui displays six panels arranged in a responsive grid:

| Panel          | Key | Content                                                                    |
| -------------- | --- | -------------------------------------------------------------------------- |
| **Health**     | `h` | All check results with status icons, names, and score bars                 |
| **Score**      | —   | Overall score (0–100), color-coded status, issue counts, score delta       |
| **Trend**      | `t` | Sparkline charts for overall score and each category (last 10 scans)       |
| **Git**        | `g` | Branch, commits ahead/behind, modified/staged/untracked files, last commit |
| **Quick Wins** | `q` | Top 5 actionable fixes prioritized by severity                             |
| **Activity**   | `a` | Time-stamped event log (scans, file changes, regressions, git changes)     |

### Keyboard Controls

| Key      | Action                                     |
| -------- | ------------------------------------------ |
| `r`      | Manually trigger a rescan                  |
| `w`      | Launch web dashboard (without AI)          |
| `W`      | Launch web dashboard with AI analysis      |
| `f`      | Expand focused panel to fullscreen         |
| `Escape` | Unfocus current panel                      |
| `↑ / ↓`  | Scroll Health Panel results (when focused) |
| `h`      | Focus Health panel                         |
| `g`      | Focus Git panel                            |
| `t`      | Focus Trend panel                          |
| `q`      | Focus Quick Wins panel                     |
| `a`      | Focus Activity panel                       |

### Automatic Triggers

- **Startup** — Initial scan runs immediately
- **File watch** — Rescans when TypeScript, JavaScript, or JSON files change (debounced 2s)
- **Auto-refresh** — Periodic rescan at the configured interval (default 5 minutes)
- **Regression detection** — Activity panel flags category score decreases automatically

## Architecture

```
src/
├── index.ts              # Commander entry — parses flags, renders Ink <App>
├── commands/
│   └── web.ts            # HTTP server (Node built-in) for the dashboard
└── components/
    ├── App.tsx            # Root Ink component — manages phases & state
    ├── Header.tsx         # ASCII art banner + project name
    ├── ProgressList.tsx   # Animated check progress (pending → running → done)
    ├── CheckResult.tsx    # Single check: name, status, score bar, issues
    ├── ScoreBar.tsx       # Colored horizontal bar (green/yellow/red)
    ├── Summary.tsx        # Overall score + issue counts
    ├── QuickWins.tsx      # Top actionable fix suggestions
    └── tui/
        ├── TUIApp.tsx         # TUI root — layout, keyboard input, state
        ├── HealthPanel.tsx        # Check results with status icons and score bars
        ├── ScorePanel.tsx         # Overall score, issue counts, delta from last scan
        ├── TrendPanel.tsx         # Sparkline charts for score history (last 10 scans)
        ├── GitPanel.tsx           # Branch, ahead/behind, staged/modified file counts
        ├── QuickWinsPanel.tsx     # Top 5 actionable fixes by severity
        ├── ActivityPanel.tsx      # Timestamped event log
        ├── HotkeyBar.tsx          # Fixed footer with keyboard shortcut reference
        ├── PanelBorder.tsx        # Focused/unfocused border styling
        └── hooks/
            ├── useSickbayRunner.ts  # Manages check execution and scan state
            ├── useFileWatcher.ts   # chokidar file watcher with debounce
            ├── useGitStatus.ts     # Polls git status every 10 seconds
            └── useTerminalSize.ts  # Tracks terminal dimensions for responsive layout
```

### UI Phases

The `<App>` component cycles through phases:

1. **`loading`** — Shows progress list with animated spinners while checks run
2. **`results`** — Displays all check results + summary + quick wins
3. **`opening-web`** — Starts HTTP server, opens browser, stays alive until Ctrl+C
4. **`error`** — Shows error message and exits

### `--web` flag flow

When `--web` is passed:

1. Scan completes normally
2. `serveWeb(report)` starts an HTTP server on port 3030 (or next free port)
3. Server serves `packages/web/dist/` as static files
4. Server responds to `GET /sickbay-report.json` with the in-memory report
5. `open` package opens the browser
6. Process stays alive until Ctrl+C

### `--json` flag flow

Skips the Ink UI entirely, writes `JSON.stringify(report, null, 2)` to stdout, then exits.

## Local Development

```bash
# Watch mode — rebuilds on file changes
pnpm dev

# Test against a project
node dist/index.js --path ~/Desktop/sickbay-test-app
node dist/index.js --path ~/Desktop/sickbay-test-app --web
node dist/index.js --path ~/Desktop/sickbay-test-app --json
```

## Build

```bash
pnpm build   # tsup → dist/index.js + dist/web-*.js (code-split)
pnpm clean   # rm -rf dist/
```
