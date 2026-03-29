# sickbay init

Initialize the `.sickbay/` directory in your project. This sets up the scaffolding needed for trend tracking, branch diffing, and badge generation.

## Usage

```bash
sickbay init [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path to initialize | Current working directory |

## What It Creates

Running `sickbay init` creates the following structure:

```
.sickbay/
  .gitignore        # Ignores report artifacts from version control
  baseline.json     # Initial health scan snapshot
  history.json      # Array of scan results for trend tracking
```

The `.gitignore` inside `.sickbay/` ensures that generated report files are not accidentally committed to your repository while keeping the directory itself tracked.

## Examples

### Initialize current directory

```bash
sickbay init
```

### Initialize a specific project

```bash
sickbay init --path ~/my-project
```

## What It Enables

After initialization, several features become available:

| Feature | Command | Requires Init |
|---------|---------|---------------|
| **Trend tracking** | `sickbay trend` | Yes — reads from `history.json` |
| **Branch diff** | `sickbay diff <branch>` | Yes — compares against `.sickbay/last-report.json` |
| **Badge generation** | `sickbay badge` | No, but uses `last-report.json` to avoid re-scanning |
| **Auto-save** | `sickbay` (scan) | Directory must exist |

## Monorepo Usage

In a monorepo, run `sickbay init` at the workspace root. The `.sickbay/` directory is created at the root level and stores aggregated data for all packages.

```bash
sickbay init --path ~/my-monorepo
```

## Tips

- Run `sickbay init` once when you first adopt Sickbay in a project
- The `baseline.json` captures your starting health score so you can measure improvement over time
- Add `.sickbay/` to your project's root `.gitignore` if you do not want to track the directory at all
