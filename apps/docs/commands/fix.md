# sickbay fix

Interactively fix issues found by a Sickbay scan. Some checks provide actionable auto-fixes; others provide guidance that requires manual intervention.

## Usage

```bash
sickbay fix [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path to analyze | Current working directory |
| `-c, --checks <checks>` | Comma-separated list of checks to run | All applicable checks |
| `--package <name>` | Scope to a single package (monorepo only) | — |
| `--all` | Apply all available fixes without prompting | `false` |
| `--dry-run` | Preview what would be fixed without executing | `false` |
| `--verbose` | Show verbose output | `false` |

## Examples

### Interactive fix

```bash
sickbay fix --path ~/my-project
```

Sickbay scans the project, then presents each fixable issue with a prompt asking whether to apply the fix.

### Fix specific checks only

```bash
sickbay fix --checks knip,depcheck
```

### Apply all fixes without prompting

```bash
sickbay fix --path ~/my-project --all
```

### Preview fixes without applying

```bash
sickbay fix --path ~/my-project --dry-run
```

### Fix a single monorepo package

```bash
sickbay fix --path ~/my-monorepo --package @acme/web-app
```

## Actionable vs Guidance-Only Fixes

Not every issue can be auto-fixed. Sickbay distinguishes between two types:

### Actionable fixes

These can be applied automatically. Examples:
- Removing unused dependencies (`knip`, `depcheck`)
- Updating outdated packages (`outdated`)
- Adding missing `.gitignore` entries

When an actionable fix is available, `sickbay fix` shows what it will do and asks for confirmation (unless `--all` is passed).

### Guidance-only fixes

These require manual work and cannot be automated. Examples:
- Resolving circular dependencies (`madge`)
- Reducing code duplication (`jscpd`)
- Fixing security vulnerabilities that require code changes
- Addressing complexity warnings

For guidance-only issues, `sickbay fix` displays a description of the problem and a recommended approach, but does not modify any files.

## Dry Run

The `--dry-run` flag is useful for CI or for previewing changes before applying them:

```bash
sickbay fix --dry-run --path ~/my-project
```

In dry-run mode, Sickbay:
- Runs the full scan
- Lists every fixable issue
- Shows what each fix would do
- Does not write any changes to disk

## Monorepo Mode

When run from a monorepo root without `--package`, `sickbay fix` scans all packages and presents fixes grouped by package. Use `--package` to scope to one:

```bash
sickbay fix --path ~/my-monorepo --package my-lib
```
