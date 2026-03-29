# CI/CD Integration

Sickbay's `--json` flag and non-zero exit codes make it straightforward to integrate into any CI pipeline.

## Basic Usage

Run a scan and save the JSON report as a build artifact:

```bash
npx sickbay --path . --json > sickbay-report.json
```

## Threshold Enforcement

Use `jq` to extract the overall score and fail the build when it drops below a threshold:

```bash
SCORE=$(npx sickbay --path . --json | jq '.overallScore')

if [ "$(echo "$SCORE < 70" | bc)" -eq 1 ]; then
  echo "Health score $SCORE is below threshold (70)"
  exit 1
fi
```

For more granular control, check individual category scores or issue counts:

```bash
REPORT=$(npx sickbay --path . --json)

CRITICAL=$(echo "$REPORT" | jq '.summary.critical')
if [ "$CRITICAL" -gt 0 ]; then
  echo "Found $CRITICAL critical issues — failing build"
  exit 1
fi
```

## GitHub Actions

A full workflow that runs Sickbay on every pull request, uploads the report as an artifact, and enforces a minimum score:

```yaml
name: Health Check

on:
  pull_request:
    branches: [main]

jobs:
  sickbay:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Run Sickbay
        run: npx sickbay --path . --json > sickbay-report.json

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: sickbay-report
          path: sickbay-report.json

      - name: Enforce minimum score
        run: |
          SCORE=$(jq '.overallScore' sickbay-report.json)
          echo "Health score: $SCORE"
          if [ "$(echo "$SCORE < 70" | bc)" -eq 1 ]; then
            echo "::error::Health score $SCORE is below minimum threshold (70)"
            exit 1
          fi
```

## Branch Comparison in PRs

Use `sickbay diff` to compare the current branch against the main branch and catch regressions:

```yaml
      - name: Compare against main
        run: npx sickbay diff main --json > sickbay-diff.json

      - name: Check for regressions
        run: |
          DELTA=$(jq '.scoreDelta' sickbay-diff.json)
          if [ "$(echo "$DELTA < -5" | bc)" -eq 1 ]; then
            echo "::error::Health score dropped by $DELTA points"
            exit 1
          fi
```

This scans the current working tree, then compares the result against the last report saved on the `main` branch.

## Monorepo CI

### Scan the entire monorepo

When run at the monorepo root, Sickbay automatically detects all workspace packages and produces a `MonorepoReport`:

```bash
npx sickbay --path . --json > monorepo-report.json
```

### Scan a single package

Scope the scan to one package using `--package`:

```bash
npx sickbay --path . --package @acme/web-app --json > web-app-report.json
```

### Matrix strategy for parallel scans

Run each package in a separate CI job for faster feedback:

```yaml
jobs:
  discover:
    runs-on: ubuntu-latest
    outputs:
      packages: ${{ steps.list.outputs.packages }}
    steps:
      - uses: actions/checkout@v4
      - id: list
        run: |
          PACKAGES=$(ls -d packages/*/package.json | xargs -I{} jq -r '.name' {} | jq -R -s -c 'split("\n") | map(select(. != ""))')
          echo "packages=$PACKAGES" >> "$GITHUB_OUTPUT"

  scan:
    needs: discover
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: ${{ fromJson(needs.discover.outputs.packages) }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: npx sickbay --path . --package "${{ matrix.package }}" --json > report.json
      - uses: actions/upload-artifact@v4
        with:
          name: sickbay-${{ matrix.package }}
          path: report.json
```

## Tips

- **Cache `node_modules`** — Sickbay depends on bundled tools (knip, madge, jscpd, etc.), so caching avoids reinstalling them on every run.
- **Run `sickbay init` first** in your repo to generate the `.sickbay/` directory with proper `.gitignore` rules, so saved reports don't pollute version control.
- **Combine with `sickbay trend`** to track score changes over time by committing reports to a dedicated branch or storing them as artifacts.
