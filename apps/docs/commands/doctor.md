# sickbay doctor

Diagnose project setup and configuration issues. The doctor command checks that your project has the essential configuration files and tooling in place before you run a full health scan.

## Usage

```bash
sickbay doctor [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path to analyze | Current working directory |
| `--package <name>` | Scope to a single package (monorepo only) | — |
| `--fix` | Auto-scaffold missing configuration files | `false` |
| `--json` | Output diagnostic results as JSON | `false` |

## Examples

### Run diagnostics

```bash
sickbay doctor --path ~/my-project
```

### Auto-fix missing configs

```bash
sickbay doctor --path ~/my-project --fix
```

### JSON output for CI

```bash
sickbay doctor --path ~/my-project --json
```

### Check a single monorepo package

```bash
sickbay doctor --path ~/my-monorepo --package @acme/api
```

## What It Checks

The doctor command inspects your project for the following:

| Check | What It Looks For |
|-------|-------------------|
| **package.json** | Exists and is valid JSON |
| **Lock file** | `pnpm-lock.yaml`, `package-lock.json`, or `yarn.lock` present |
| **tsconfig** | `tsconfig.json` exists (for TypeScript projects) |
| **ESLint** | `.eslintrc.*` or `eslint.config.*` configuration present |
| **Test framework** | Vitest, Jest, or other test runner configured |
| **.gitignore** | `.gitignore` exists with reasonable defaults |

Each item is reported as a pass, warning, or fail with a brief description of the issue.

## The `--fix` Flag

When `--fix` is passed, the doctor will scaffold missing configuration files automatically. For example:

- Missing `.gitignore` — creates one with common Node.js ignores
- Missing `tsconfig.json` — creates a sensible default for the detected project type
- Missing ESLint config — creates a basic configuration

The doctor only creates files that are missing. It never overwrites existing configuration.

## Monorepo Mode

When run from a monorepo root without `--package`, the doctor checks each workspace package individually and reports results per package. Use `--package` to scope to a single package:

```bash
sickbay doctor --path ~/my-monorepo --package my-lib
```

## Tips

- Run `sickbay doctor` when adopting Sickbay to ensure your project is ready for a full scan
- Use `sickbay doctor --fix` to quickly bootstrap configuration in new packages
- Pipe `--json` output into your CI pipeline to enforce configuration standards
