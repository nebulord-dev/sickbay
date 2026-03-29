# sickbay tui

Launch the persistent developer dashboard. The TUI provides a multi-panel terminal interface that monitors your project's health in real time with file watching and auto-refresh.

## Usage

```bash
sickbay tui [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path to monitor | Current working directory |
| `-c, --checks <checks>` | Comma-separated list of checks to run | All applicable checks |
| `--no-watch` | Disable file-watching auto-refresh | Watch enabled |
| `--no-quotes` | Suppress personality quotes in output | Quotes enabled |
| `--refresh <seconds>` | Auto-refresh interval in seconds | `300` |

## Examples

### Launch the dashboard

```bash
sickbay tui --path ~/my-project
```

### Disable file watching

```bash
sickbay tui --path ~/my-project --no-watch
```

### Set a faster refresh interval

```bash
sickbay tui --path ~/my-project --refresh 60
```

### Run with specific checks only

```bash
sickbay tui --path ~/my-project --checks knip,eslint,npm-audit
```

## Dashboard Panels

The TUI displays six panels that you can navigate between:

| Panel | Content |
|-------|---------|
| **Health** | Overall health score with per-category breakdown |
| **Score** | Detailed per-check scores with status indicators |
| **Trend** | Score history chart (requires `sickbay init`) |
| **Git** | Git-related health info — coverage, commit hygiene |
| **Quick Wins** | Top actionable fixes ranked by impact |
| **Activity** | Recent scan activity and file change events |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `?` | Toggle help overlay |
| `h` | Focus Health panel |
| `g` | Focus Git panel |
| `t` | Focus Trend panel |
| `q` | Focus Quick Wins panel |
| `a` | Focus Activity panel |
| `f` | Expand the currently focused panel to full screen |
| `Escape` | Close expanded panel or help overlay |
| `r` | Trigger a manual re-scan |
| `w` | Open the web dashboard in a browser |
| `W` | Open the web dashboard with AI features enabled |

## File Watching

By default, the TUI watches your project directory for file changes. When a change is detected, Sickbay automatically re-runs the health checks and updates the dashboard.

The `--refresh` flag controls the minimum interval between auto-refreshes (default 300 seconds / 5 minutes). This prevents excessive scanning when many files change rapidly. You can also press `r` at any time to trigger an immediate re-scan.

To disable file watching entirely, use `--no-watch`. The dashboard will only update when you press `r`.

## Monorepo Mode

When the TUI detects a monorepo, it displays a monorepo banner at the top of the screen with a mini scoreboard showing each package and its current health score. This gives you an at-a-glance view of the entire workspace without leaving the terminal.

```bash
sickbay tui --path ~/my-monorepo
```

## Tips

- Use `f` to expand any panel for a detailed view, then `Escape` to return to the overview
- Press `W` (capital) to open the web dashboard with AI analysis pre-enabled
- Combine `--checks` with `--refresh` for a focused, fast-updating dashboard on the checks you care about most
