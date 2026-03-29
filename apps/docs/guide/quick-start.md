# Quick Start

## Run Your First Scan

```bash
npx sickbay --path ~/my-project
```

Sickbay will:
1. Detect your project type (React, Node, etc.)
2. Run all applicable health checks in parallel
3. Display animated progress in the terminal
4. Show results with color-coded scores

## Read the Output

Each check shows:
- **Score** (0-100) with a color-coded bar (green 80+, yellow 60-79, red below 60)
- **Issue count** by severity (critical, warning, info)
- **Quick wins** — the most impactful fixes you can make right now

The overall score is a weighted average across all categories.

## Open the Web Dashboard

```bash
npx sickbay --path ~/my-project --web
```

The `--web` flag starts a local server and opens a rich browser dashboard with:
- Score cards for every check
- Filterable and sortable issues list
- Dependency graph visualization
- AI-powered insights (requires `ANTHROPIC_API_KEY`)

## Try the TUI

```bash
npx sickbay tui --path ~/my-project
```

The TUI is a persistent live dashboard that watches your files and re-scans automatically. Press `?` for keyboard shortcuts.

## Output JSON for CI

```bash
npx sickbay --path ~/my-project --json
```

Produces a structured `SickbayReport` JSON object suitable for piping to other tools or storing as a CI artifact. See [JSON Output](/advanced/json-output) for the full schema.

## Initialize Trend Tracking

```bash
npx sickbay init --path ~/my-project
```

Creates a `.sickbay/` folder with a baseline scan. Subsequent scans are recorded in `.sickbay/history.json`, enabling the `sickbay trend` command and the History tab in the web dashboard.
