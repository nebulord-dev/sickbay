---
name: audit-cli
description: Use when auditing apps/cli for Ink component issues, Commander flag edge cases, bundled-deps drift, TUI hook correctness, or web server security problems.
---

# Audit: apps/cli

The published `sickbay` package. Audit for correctness, robustness, and the bundling invariant that keeps it installable.

## Checklist

### 1. Bundled-Deps Mirror

This is the most critical invariant for the published package. A drift here means user installs crash at runtime.

- Run `pnpm check:bundled-deps` — must pass
- Check `apps/cli/knip.config.ts` `ignoreDependencies` — must match `packages/core/package.json` dependencies exactly
- If core added or removed a dep, cli must be updated too

### 2. Ink Component Patterns

Ink (React for terminals) has specific rules that differ from browser React.

- No synchronous blocking operations inside render or `useEffect` without cleanup
- `useEffect` with async operations must handle unmount — check for missing cleanup in `useFileWatcher`, `useGitStatus`, `useSickbayRunner`
- Components that receive large data (all check results) should not re-render excessively — check for unstabilized object/array props
- `process.stdout` manipulations must be cleaned up on unmount/exit

### 3. TUI Hooks

Review `src/components/tui/hooks/`:

- **`useFileWatcher.ts`** — chokidar watcher must be closed on cleanup. Debounce (2s) must be cancelled on unmount. What happens when the watched path doesn't exist?
- **`useGitStatus.ts`** — polls every 10s via `setInterval`. Interval must be cleared on unmount. What if `git` isn't installed?
- **`useSickbayRunner.ts`** — manages scan state. Can a new scan start while one is in progress? What's the behaviour if `runSickbay()` throws?
- **`useTerminalSize.ts`** — SIGWINCH handler must be removed on cleanup

### 4. Commander Setup

Review `src/index.ts`:

- Are all flags validated before running the scan? (e.g., `--path` pointing to a non-existent directory)
- Does `--checks` with an invalid check ID fail gracefully?
- Does `--json` suppress all non-JSON output, including spinners and banners?
- Are exit codes correct? (0 = success, non-zero = error — CI depends on this)

### 5. Web Server (`src/commands/web.ts`)

The `--web` flag starts an HTTP server. Review for:

- **Path traversal** — does the static file server restrict to `dist/` only? Can `GET /../../../etc/passwd` reach the filesystem?
- **Port handling** — if port 3030 is in use, does it find the next free port gracefully?
- **Server shutdown** — is the server closed on SIGINT/SIGTERM, or does it leave orphaned processes?
- **Report endpoint** — `GET /sickbay-report.json` serves the in-memory report. Verify it sets `Content-Type: application/json` and doesn't expose any other data

### 6. Exit Codes and Error Handling

- Does an unhandled rejection in a check crash the whole CLI, or is it contained?
- When `--json` is used, does an error produce valid JSON on stderr and a non-zero exit?
- Does the process always exit cleanly, even after the Ink UI renders? (Ink can sometimes leave the process hanging)

### 7. Update Check (`src/lib/update-check.ts`)

- Is the update check non-blocking? It must not delay the scan
- Does it fail silently when offline or when npm registry is unreachable?
- Is the result cached? (Should not hit npm on every run)

## Key Files

```
apps/cli/src/
├── index.ts                    # Commander entry — flags, validation, exit codes
├── commands/web.ts             # HTTP server — path traversal, port handling
├── components/App.tsx          # Root Ink component — phases, error handling
├── components/tui/
│   ├── TuiApp.tsx              # TUI root — keyboard, layout
│   └── hooks/                  # useFileWatcher, useGitStatus, useSickbayRunner
└── lib/update-check.ts         # Non-blocking update notifications
```

## How to Run

Dispatch a `feature-dev:code-reviewer` agent. Focus it on the bundled-deps invariant first (run `pnpm check:bundled-deps`), then the web server security section, then TUI hook cleanup. Skip style issues entirely.
