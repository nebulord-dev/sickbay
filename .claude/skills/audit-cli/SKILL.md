---
name: audit-cli
description: Use when auditing apps/cli for Ink component issues, Commander flag edge cases, bundled-deps drift, TUI hook correctness, subcommand safety (especially `fix` which writes to user files), web server security, child process cleanup, or piped-stdin behaviour. Run before merging any change that touches apps/cli/.
---

# Audit: apps/cli

The published `sickbay` package. Audit for correctness, robustness, the bundling invariant that keeps it installable, and every subcommand's blast radius — `fix` modifies user code, so the bar is high.

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

### 4. Commander Setup (`src/index.ts`)

- All flags validated before running the scan (e.g., `--path` pointing to a non-existent directory)
- `--checks` with an invalid check ID fails gracefully with the list of valid IDs
- `--json` suppresses all non-JSON output, including spinners and banners
- Exit codes correct (0 = success, non-zero = error — CI depends on this)
- Subcommand flag collisions — e.g. does `--json` work consistently across `scan`, `diff`, `stats`?

### 5. Subcommand Coverage

Each subcommand has its own audit surface. Don't stop at `scan` + `--web`.

#### `fix` — **highest-risk command** (`src/commands/fix.ts`, `src/components/FixApp.tsx`)

Writes to user files. Every failure mode matters.

- **Dry-run / preview** — is there one? The default mode should show diffs before committing, or require an explicit `--write` flag
- **Git-cleanliness preflight** — refuses to run (or warns loudly) on a dirty working tree. Otherwise users can't undo a bad fix
- **Atomic writes** — partial writes on crash leave the user's code in a half-edited state. Writes must be all-or-nothing (temp file + rename)
- **Idempotency** — running `fix` twice on the same project produces the same result as running it once. If the second run re-applies already-applied fixes, that's a bug
- **Scope confinement** — only modifies files inside the project root. Never follows symlinks out of the tree. Never touches `.git/`, `node_modules/`, or other ignored paths
- **Binary / generated files** — skipped. Applying text fixes to a `.png` corrupts it silently

#### `init` (`src/commands/init.ts`)

Writes `sickbay.config.ts` to the user's project.

- **Overwrite protection** — refuses or prompts if the file exists
- **Template correctness** — generated config imports types from `sickbay-core`, not internal paths
- **No network side-effects** — init should be offline-safe

#### `claude` + `services/ai.ts`

AI integration inside the CLI, distinct from the web dashboard's AI.

- API key sourced from `ANTHROPIC_API_KEY` env var, never prompted to stdin (would be captured by piping)
- Missing key produces a clear error, not a crash from the SDK
- Streaming output works with Ink without tearing or clobbering the UI
- Rate limit / offline errors become friendly messages, not raw SDK stacks
- Prompt injection: report content is user-controlled — system prompt must constrain the AI's trust in that content

#### `doctor` (`src/commands/doctor.ts` — largest subcommand at 11KB)

Environment diagnostics.

- Each diagnostic fails independently — one failure doesn't skip the rest
- No false positives for optional tools (e.g. don't flag "git not found" if the project doesn't use git)
- Output is actionable — `git not found — install from https://git-scm.com` beats bare `git not found`

#### `diff`, `stats`, `trend`, `badge`

- All read `.sickbay/history.json` or `.sickbay/last-report.json` — handle missing / malformed files gracefully, don't crash
- `badge` outputs SVG — every user-controlled string (project name, score) must be XML-escaped to prevent SVG injection
- `trend` / `diff` — compare reports from different Sickbay versions. Handle schema differences without crashing

### 6. Web Server (`src/commands/web.ts`)

The `--web` flag starts an HTTP server. Review for:

- **Path traversal** — the static file server restricts to `dist/` only. `GET /../../../etc/passwd` must not reach the filesystem
- **Port handling** — if port 3030 is in use, it finds the next free port gracefully
- **Probe/listen host parity** — the free-port probe binds to the same host as the real `server.listen()`. Mismatches (e.g. default `::` probe vs. `127.0.0.1` real bind) produce false "port free" results on macOS because IPv4 and IPv6 loopback sockets are independent. Don't trust the fallback logic exists — verify it fires end-to-end: hold a port on `127.0.0.1` with a real server, call `serveWeb(report, heldPort)`, assert the returned URL uses a different port
- **Listen error handler** — every `http.Server` / `net.Server` has an `.on('error', ...)` / `.once('error', ...)` listener attached **before** `server.listen()` is called. An unhandled `'error'` event on a Server EventEmitter crashes the process with a raw Node stack trace (e.g. on EADDRINUSE, EACCES) instead of producing a graceful promise rejection the Ink error phase can render. Grep every `.listen(` call in the package and confirm each has a sibling error listener
- **CORS on report endpoint** — `/sickbay-report.json` should set `Access-Control-Allow-Origin` only to the dashboard's own origin, not `*`. The dashboard is served by the same process, so same-origin suffices
- **Server shutdown** — the server closes on SIGINT/SIGTERM and doesn't leave orphaned processes. On listen failure, SIGINT/SIGTERM handlers are unregistered so they don't leak across retries
- **Report endpoint content type** — `GET /sickbay-report.json` sets `Content-Type: application/json` and exposes nothing else

### 7. Child Process Cleanup

Scans spawn knip, madge, jscpd, depcheck, and other tools via execa in core. The CLI owns the process lifecycle.

- On SIGINT mid-scan, are all spawned child processes killed? Orphaned node processes after Ctrl-C is a real failure mode users notice
- Does the Ink app unmount cleanly so the terminal isn't left broken (cursor hidden, alt-screen active, stdin in raw mode)?
- Does `useSickbayRunner` abort in-flight scans when the component unmounts mid-scan?

### 8. Non-TTY / Piped Stdin

Ink and terminal libraries behave oddly when stdin isn't a TTY.

- `sickbay --json | jq` — CLI detects non-TTY and skips the interactive UI entirely, outputting pure JSON
- `sickbay < /dev/null` — doesn't hang waiting for input
- `sickbay --web` inside a CI runner — doesn't try to `open` a browser when `CI=true`

### 9. History & Cache Files (`lib/history.ts`)

`history.ts` writes three files into the analyzed project's `.sickbay/` directory: `history.json` (trend data), `last-report.json` (latest scan), and `dep-tree.json` (dep graph snapshot). All three are CLI-owned outputs derived from core.

- Two parallel scans of the same project don't clobber each other's writes (atomic write — temp file + rename, not read-modify-write)
- Malformed / truncated `history.json` — next scan recovers (treats as empty history), not crash
- Unbounded growth of `history.json` — retention policy or cap on entries?
- `dep-tree.json` is rewritten every scan (no cache-hit check). Verify the write is atomic so a crashed scan can't leave a truncated JSON blob on disk
- Schema migration — if the tree or history shape changes between versions, stale files from an older install must not crash the new reader
- `.sickbay/` lives inside the analyzed project; verify the root `.gitignore` excludes the files that shouldn't travel (it does for `dep-tree.json`)

### 10. Update Check (`src/lib/update-check.ts`)

- Non-blocking — must not delay the scan
- Fails silently when offline or when npm registry is unreachable
- Result is cached — should not hit npm on every run

### 11. Exit Codes and Error Handling

- Unhandled rejection in a check doesn't crash the whole CLI — it's contained
- With `--json`, errors produce valid JSON on stderr and a non-zero exit
- Process always exits cleanly, even after Ink renders. Ink occasionally leaves the event loop alive

## Key Files

```
apps/cli/src/
├── index.ts                       # Commander entry — flags, validation, exit codes
├── commands/
│   ├── fix.ts, init.ts            # High-risk: modify user state
│   ├── web.ts                     # HTTP server — traversal, port handling, error listeners
│   ├── claude.ts                  # CLI AI integration
│   ├── doctor.ts, diff.ts         # Large diagnostic/comparison commands
│   └── stats.ts, trend.ts, badge.ts
├── components/
│   ├── App.tsx, FixApp.tsx        # Root + fix-specific phases
│   └── tui/hooks/                 # useFileWatcher, useGitStatus, useSickbayRunner
├── services/ai.ts                 # AI service — key sourcing, prompts
└── lib/
    ├── history.ts                 # Trend history — atomic writes, retention
    ├── update-check.ts            # Non-blocking update notification
    ├── issue-grouping.ts          # Grouping stability
    └── resolve-package.ts         # Symlink handling
```

## Output Format

Dispatched reviewer should report findings as:

```
[Severity: High|Medium|Low] path/to/file.ts:123
What's wrong: <one-line description>
Why it matters: <impact on users or maintainers>
Suggested fix: <concrete change>
```

Skip style issues entirely. Prioritize in this order: bundled-deps drift → `fix` safety → web server security → child-process cleanup → TUI hook cleanup → everything else.

## How to Run

Dispatch a `feature-dev:code-reviewer` agent. First action: run `pnpm check:bundled-deps` and surface the result. Then work through the subcommand checklist, `fix` first.

## Related Audits

- Changes to `apps/cli/src/commands/web.ts` → cross-check **audit-web** for CORS / CSP contract
- Changes to `apps/cli/package.json` dependencies → run **audit-architecture** (bundled-deps invariant)
- Changes to report rendering or types consumed → run **audit-core** (upstream source of truth)
