# sickbay badge

Generate a health score badge for your README. The badge uses [shields.io](https://shields.io) and color-codes based on your project's health score.

## Usage

```bash
sickbay badge [options]
```

## Options

| Flag                | Description                                    | Default                   |
| ------------------- | ---------------------------------------------- | ------------------------- |
| `-p, --path <path>` | Project path                                   | Current working directory |
| `--package <name>`  | Scope to a single package (monorepo only)      | —                         |
| `--html`            | Output an HTML `<img>` tag instead of Markdown | `false`                   |
| `--url`             | Output bare badge URL only                     | `false`                   |
| `--label <text>`    | Custom badge label                             | `sickbay`                 |
| `--scan`            | Run a fresh scan instead of using last report  | `false`                   |

## Examples

### Markdown badge (default)

```bash
sickbay badge --path ~/my-project
```

Output:

```markdown
![sickbay](https://img.shields.io/badge/sickbay-85%25-brightgreen)
```

### HTML badge

```bash
sickbay badge --path ~/my-project --html
```

Output:

```html
<img src="https://img.shields.io/badge/sickbay-85%25-brightgreen" alt="sickbay" />
```

### Bare URL

```bash
sickbay badge --path ~/my-project --url
```

Output:

```
https://img.shields.io/badge/sickbay-85%25-brightgreen
```

### Custom label

```bash
sickbay badge --path ~/my-project --label "health score"
```

Output:

```markdown
![health score](https://img.shields.io/badge/health%20score-85%25-brightgreen)
```

### Force a fresh scan

```bash
sickbay badge --path ~/my-project --scan
```

## Badge Color Thresholds

The badge color is determined by the health score:

| Score  | Color                 |
| ------ | --------------------- |
| 80-100 | Green (`brightgreen`) |
| 60-79  | Yellow (`yellow`)     |
| 0-59   | Red (`red`)           |

## How It Works

By default, the badge command reads the score from `.sickbay/last-report.json` to avoid running a full scan. If no saved report is found, or if `--scan` is passed, Sickbay runs a fresh scan and saves the result before generating the badge.

## Monorepo Mode

When run from a monorepo root without `--package`, the badge reflects the overall monorepo score. Use `--package` to generate a badge for a specific package:

```bash
sickbay badge --path ~/my-monorepo --package @acme/web-app
```

## Tips

- Add the badge to your project's README for at-a-glance health visibility
- Use `--scan` in CI to ensure the badge always reflects the latest state
- Combine with `sickbay init` so the badge command can read from cached reports locally
