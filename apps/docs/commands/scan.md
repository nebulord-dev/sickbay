# sickbay (scan)

The default command. Runs all applicable health checks against a project and displays the results.

## Usage

```bash
sickbay [options]
```

No subcommand is needed — running `sickbay` by itself starts a scan.

## Options

| Flag                    | Description                                     | Default                   |
| ----------------------- | ----------------------------------------------- | ------------------------- |
| `-p, --path <path>`     | Project path to analyze                         | Current working directory |
| `-c, --checks <checks>` | Comma-separated list of checks to run           | All applicable checks     |
| `--package <name>`      | Scope to a single named package (monorepo only) | —                         |
| `--json`                | Output raw JSON report to stdout                | `false`                   |
| `--web`                 | Open the web dashboard after the scan completes | `false`                   |
| `--no-ai`               | Disable AI-powered features                     | AI enabled                |
| `--no-quotes`           | Suppress personality quotes in output           | Quotes enabled            |
| `--verbose`             | Show verbose output with extra detail           | `false`                   |

## Examples

### Basic scan

```bash
sickbay --path ~/my-project
```

### Run specific checks only

```bash
sickbay --path ~/my-project --checks knip,eslint,npm-audit
```

### JSON output for CI

```bash
sickbay --path ~/my-project --json > report.json
```

### Scan a single monorepo package

```bash
sickbay --path ~/my-monorepo --package @acme/web-app
```

### Verbose output with no quotes

```bash
sickbay --path ~/my-project --verbose --no-quotes
```

## Web Dashboard

Pass `--web` to start a local server on port 3030 and open the web dashboard in your browser:

```bash
sickbay --path ~/my-project --web
```

The dashboard provides:

- **Score cards** for each category with circular progress indicators
- **Filterable issues table** sorted by severity
- **Quick wins** panel highlighting the most impactful fixes
- **Dependency graph** visualization
- **AI insights** — automatic analysis and an interactive chat interface (requires `ANTHROPIC_API_KEY`)

To disable AI features in the dashboard, combine `--web` with `--no-ai`:

```bash
sickbay --path ~/my-project --web --no-ai
```

## Auto-Save

Every scan automatically saves the report to `.sickbay/last-report.json` in the project directory. This file is used by other commands:

- `sickbay trend` reads from saved reports to show score history
- `sickbay badge` uses the last report to generate a badge without re-scanning
- `sickbay diff` compares the current scan against a saved baseline

Run `sickbay init` first to set up the `.sickbay/` directory with proper `.gitignore` rules.

## Environment Variables

| Variable            | Purpose                                          |
| ------------------- | ------------------------------------------------ |
| `ANTHROPIC_API_KEY` | Enables AI-powered insights in the web dashboard |

Sickbay loads `.env` files from three locations (in order of priority):

1. The project path being analyzed (highest priority)
2. The current working directory
3. `~/.sickbay/.env` (global config, lowest priority)
