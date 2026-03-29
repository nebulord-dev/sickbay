# sickbay diff

Compare your current branch's health score against another branch. Useful for catching regressions in pull requests.

## Usage

```bash
sickbay diff <branch> [options]
```

The `<branch>` argument is required. It specifies the branch to compare against (typically `main` or `develop`).

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path to analyze | Current working directory |
| `-c, --checks <checks>` | Comma-separated list of checks to run | All applicable checks |
| `--json` | Output diff as JSON | `false` |
| `--verbose` | Show verbose output | `false` |

## Examples

### Compare against main

```bash
sickbay diff main --path ~/my-project
```

### Compare specific checks only

```bash
sickbay diff main --checks knip,eslint,npm-audit
```

### JSON output for CI

```bash
sickbay diff main --path ~/my-project --json
```

### Verbose diff

```bash
sickbay diff develop --path ~/my-project --verbose
```

## How It Works

The diff command follows a three-step process:

1. **Read baseline** — retrieves the saved report from the target branch using `git show <branch>:.sickbay/last-report.json`
2. **Run fresh scan** — executes a full health scan on the current working tree
3. **Compare** — calculates per-check score deltas between the baseline and the fresh scan

## Output

The diff output shows each check with a score delta and color-coded arrow:

- **Green arrow up** — score improved compared to the target branch
- **Red arrow down** — score regressed compared to the target branch
- **Gray dash** — no change

The overall score delta is displayed at the top, followed by per-check breakdowns.

## Prerequisites

The diff command requires `.sickbay/last-report.json` to exist on both branches:

- **Target branch** — must have a saved report (run `sickbay` on that branch at least once after `sickbay init`)
- **Current branch** — the diff command runs a fresh scan automatically

If the target branch does not have a saved report, the diff command will exit with an error.

## CI Usage

The diff command is particularly useful in CI pipelines for pull request checks:

```bash
# In a GitHub Actions workflow
sickbay diff main --json > diff-report.json
```

You can parse the JSON output to enforce a "no regression" policy — fail the build if any check score drops below its baseline.

## Tips

- Run `sickbay init` and commit the `.sickbay/` directory on your main branch to establish a baseline
- Use `--checks` to focus on the checks most relevant to your PR review process
- Combine with `--verbose` to see detailed issue-level changes, not just score deltas
