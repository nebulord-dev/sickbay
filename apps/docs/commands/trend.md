# sickbay trend

Show score history and trends over time. Visualizes how your project's health has changed across recent scans.

## Usage

```bash
sickbay trend [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path to analyze | Current working directory |
| `-n, --last <count>` | Number of recent scans to show | `20` |
| `--package <name>` | Scope to a single package (monorepo only) | — |
| `--json` | Output trend data as JSON | `false` |

## Prerequisites

Trend tracking requires initialization. Run `sickbay init` first:

```bash
sickbay init --path ~/my-project
```

This creates the `.sickbay/` directory with `history.json`, which stores scan results over time. Each subsequent scan appends an entry to the history.

## Examples

### View recent trends

```bash
sickbay trend --path ~/my-project
```

### Show the last 5 scans

```bash
sickbay trend --path ~/my-project --last 5
```

### JSON output

```bash
sickbay trend --path ~/my-project --json
```

### Trend for a single monorepo package

```bash
sickbay trend --path ~/my-monorepo --package @acme/web-app
```

## What It Shows

The trend command displays:

- **Score timeline** — overall score for each scan with timestamps
- **Direction indicators** — arrows showing whether the score is improving or declining
- **Category breakdown** — per-category scores over time so you can spot which areas are trending up or down

## Monorepo Mode

When run from a monorepo root without `--package`, the trend command shows aggregated trend data across all packages. Use `--package` to see the trend for a specific package:

```bash
sickbay trend --path ~/my-monorepo --package my-lib
```

## Tips

- Run scans regularly (or set up CI) to build up meaningful trend data
- Use `--last 5` in CI to check for regressions in recent builds
- Pipe `--json` output to custom dashboards or reporting tools
