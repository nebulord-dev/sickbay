# @vitals/cli

The terminal interface for Vitals. Built with [Ink](https://github.com/vadimdemedes/ink) (React for terminals) and [Commander](https://github.com/tj/commander.js).

## Usage

```bash
vitals [options]
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `-p, --path <path>` | `process.cwd()` | Path to the project to analyze |
| `-c, --checks <names>` | all | Comma-separated check IDs to run |
| `--json` | false | Output raw JSON to stdout (no UI) |
| `--web` | false | Open web dashboard after scan |
| `--verbose` | false | Show tool output during checks |
| `-V, --version` | | Print version |
| `-h, --help` | | Show help |

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
```

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
    └── QuickWins.tsx      # Top actionable fix suggestions
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
