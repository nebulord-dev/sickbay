# Monorepo Support

Sickbay has first-class support for JavaScript and TypeScript monorepos. When you point Sickbay at a monorepo root, it automatically detects workspace packages and scans each one individually.

## Supported Workspace Tools

Sickbay detects monorepos by looking for workspace configuration files at the project root.

| Tool | Detection File |
|------|---------------|
| **pnpm** | `pnpm-workspace.yaml` |
| **npm** | `package.json` with `workspaces` field |
| **Yarn** | `package.json` with `workspaces` field |
| **Turbo** | `turbo.json` |
| **Nx** | `nx.json` |
| **Lerna** | `lerna.json` |

If multiple workspace tools are present (e.g., pnpm workspaces + Turbo), Sickbay uses the package manager workspace config to discover packages and respects the build orchestrator for ordering.

## Running in a Monorepo

Point Sickbay at the monorepo root and every package is scanned:

```bash
sickbay --path ~/my-monorepo
```

Sickbay will:
1. Detect the workspace tool and enumerate all packages
2. Run health checks against each package individually
3. Aggregate results into a combined report
4. Display per-package scores alongside the overall monorepo score

## Scoping to a Single Package

Use `--package` to scope any scan to one specific package:

```bash
sickbay --package my-app --path ~/my-monorepo
```

The `--package` flag matches against the `name` field in each package's `package.json`. You can use either the full scoped name or the short name:

```bash
# These are equivalent
sickbay --package @acme/web-app
sickbay --package web-app
```

If the package is not found, Sickbay exits with an error:

```
Package "web-app" not found in monorepo
```

## All Subcommands Support Monorepo Mode

Every Sickbay subcommand works with monorepos out of the box. When run from a monorepo root without `--package`, each command operates across all packages:

| Command | Monorepo Behavior |
|---------|-------------------|
| `sickbay` (scan) | Scans all packages, shows combined report |
| `sickbay fix` | Offers fixes across all packages |
| `sickbay stats` | Shows stats for each package |
| `sickbay trend` | Displays trend data per package |
| `sickbay doctor` | Diagnoses setup issues across all packages |
| `sickbay badge` | Generates badge from overall monorepo score |

All of these accept `--package <name>` to scope to a single package.

## Web Dashboard in Monorepo Mode

When you use `--web` in a monorepo, the web dashboard adds a sidebar listing every workspace package. You can click any package to see its individual report, or view the aggregate monorepo overview.

```bash
sickbay --path ~/my-monorepo --web
```

Dashboard features in monorepo mode:
- **Package sidebar** — navigate between packages
- **Aggregate overview** — combined score and issue counts
- **Per-package drill-down** — individual scores, issues, and quick wins
- **AI insights** — analysis covers all packages when enabled

## TUI in Monorepo Mode

The persistent TUI dashboard (`sickbay tui`) detects monorepos automatically and shows a monorepo banner at the top with a mini scoreboard listing each package and its current score.

```bash
sickbay tui --path ~/my-monorepo
```

The mini scoreboard gives you an at-a-glance view of every package's health without leaving the terminal.

## Tips

- Run `sickbay init` at the monorepo root to set up trend tracking for the entire workspace
- Use `--package` in CI to run checks on only the packages that changed
- The `--json` flag in monorepo mode returns a report object with per-package results, making it easy to parse in CI pipelines
