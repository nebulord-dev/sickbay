# sickbay stats

Show a quick codebase overview and project summary. The stats command gives you a snapshot of your project's key metrics without running a full health scan.

## Usage

```bash
sickbay stats [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path to analyze | Current working directory |
| `--package <name>` | Scope to a single package (monorepo only) | — |
| `--json` | Output stats as JSON | `false` |

## Examples

### View project stats

```bash
sickbay stats --path ~/my-project
```

### JSON output

```bash
sickbay stats --path ~/my-project --json
```

### Stats for a single monorepo package

```bash
sickbay stats --path ~/my-monorepo --package @acme/web-app
```

## What It Shows

The stats command displays the following information:

| Metric | Description |
|--------|-------------|
| **Framework** | Detected framework (React, Next.js, Remix, etc.) |
| **Runtime** | `browser` or `node` based on project dependencies |
| **Package manager** | pnpm, npm, or yarn |
| **Dependency count** | Number of production and dev dependencies |
| **File count** | Total source files in the project |
| **Lines of code** | Total LOC across source files |
| **Test count** | Number of detected test files |
| **Last score** | Most recent health score from `.sickbay/last-report.json` |

The last score field is only populated if you have previously run a scan with `sickbay init` set up.

## Monorepo Mode

When run from a monorepo root without `--package`, the stats command shows an overview for each workspace package. Use `--package` to scope to one:

```bash
sickbay stats --path ~/my-monorepo --package my-lib
```

## Tips

- Use `sickbay stats --json` in CI to log project metadata alongside health reports
- The stats command is lightweight and fast — it reads metadata without running analysis tools
