# @vitals/cli

The terminal interface for Vitals. Built with [Ink](https://github.com/vadimdemedes/ink) (React for terminals) and [Commander](https://github.com/tj/commander.js).

## Usage

```bash
vitals [options]
```

### Commands

| Command               | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `init [options]`      | Scaffold `.vitals/`, run baseline scan, seed history  |
| `fix [options]`       | Interactively fix issues found by vitals scan         |
| `trend [options]`     | Show score history and trends over time               |
| `stats [options]`     | Show a quick codebase overview and project summary    |
| `doctor [options]`    | Diagnose project setup and configuration issues       |
| `tui [options]`       | Persistent live dashboard with file watching and activity tracking |

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
vitals

# Analyze another project
vitals -p ~/projects/my-app

# Run specific checks only
vitals --checks knip,npm-audit,depcheck

# JSON output for CI
vitals --json | jq '.overallScore'

# Get just the summary
vitals --json | jq '.summary'

# List all check names and their scores
vitals --json | jq '.checks[] | {name, score}'

# Get only failing checks
vitals --json | jq '.checks[] | select(.status == "fail")'

# Open web dashboard
vitals --web

# Initialize .vitals/ folder with baseline scan
vitals init

# Initialize for a specific project
vitals init --path ~/projects/my-app

# Interactively fix issues
vitals fix

# View score history and trends
vitals trend

# Get quick project stats
vitals stats

# Diagnose project setup
vitals doctor

# Launch tui dashboard (current directory, file watching enabled)
vitals tui

# TUI for a specific project, disable file watching
vitals tui --path ~/projects/my-app --no-watch

# TUI with faster auto-refresh (60 seconds) and specific checks only
vitals tui --path ~/projects/my-app --refresh 60 --checks knip,npm-audit,eslint
```

## TUI Dashboard

`vitals tui` opens a persistent split-pane TUI that continuously monitors your project. Unlike a one-shot scan, it stays running, watches for file changes, and lets you interact with results in real time.

### TUI Flags

| Flag                      | Default         | Description                                          |
| ------------------------- | --------------- | ---------------------------------------------------- |
| `-p, --path <path>`       | `process.cwd()` | Project path to monitor                              |
| `--no-watch`              | watch enabled   | Disable file-watching auto-refresh                   |
| `--refresh <seconds>`     | `300`           | Auto-refresh interval in seconds                     |
| `-c, --checks <checks>`   | all             | Comma-separated list of checks to run                |

### Panels

The tui displays six panels arranged in a responsive grid:

| Panel          | Key  | Content                                                                 |
| -------------- | ---- | ----------------------------------------------------------------------- |
| **Health**     | `h`  | All check results with status icons, names, and score bars              |
| **Score**      | —    | Overall score (0–100), color-coded status, issue counts, score delta    |
| **Trend**      | `t`  | Sparkline charts for overall score and each category (last 10 scans)   |
| **Git**        | `g`  | Branch, commits ahead/behind, modified/staged/untracked files, last commit |
| **Quick Wins** | `q`  | Top 5 actionable fixes prioritized by severity                         |
| **Activity**   | `a`  | Time-stamped event log (scans, file changes, regressions, git changes)  |

### Keyboard Controls

| Key        | Action                                              |
| ---------- | --------------------------------------------------- |
| `r`        | Manually trigger a rescan                           |
| `w`        | Launch web dashboard (without AI)                  |
| `W`        | Launch web dashboard with AI analysis               |
| `f`        | Expand focused panel to fullscreen                  |
| `Escape`   | Unfocus current panel                               |
| `↑ / ↓`   | Scroll Health Panel results (when focused)          |
| `h`        | Focus Health panel                                  |
| `g`        | Focus Git panel                                     |
| `t`        | Focus Trend panel                                   |
| `q`        | Focus Quick Wins panel                              |
| `a`        | Focus Activity panel                                |

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
            ├── useVitalsRunner.ts  # Manages check execution and scan state
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
4. Server responds to `GET /vitals-report.json` with the in-memory report
5. `open` package opens the browser
6. Process stays alive until Ctrl+C

### `--json` flag flow

Skips the Ink UI entirely, writes `JSON.stringify(report, null, 2)` to stdout, then exits.

## Local Development

```bash
# Watch mode — rebuilds on file changes
pnpm dev

# Test against a project
node dist/index.js --path ~/Desktop/vitals-test-app
node dist/index.js --path ~/Desktop/vitals-test-app --web
node dist/index.js --path ~/Desktop/vitals-test-app --json
```

## Build

```bash
pnpm build   # tsup → dist/index.js + dist/web-*.js (code-split)
pnpm clean   # rm -rf dist/
```
