# JSON Output

Pass `--json` to any scan command to get a structured report on stdout. This is the primary integration point for CI pipelines, custom dashboards, and third-party tools.

```bash
sickbay --path . --json > report.json
```

## Report Structure

### SickbayReport

The top-level object returned by a single-project scan.

| Field | Type | Description |
|-------|------|-------------|
| `overallScore` | `number` | Weighted health score from 0 to 100 |
| `checks` | `CheckResult[]` | Results for every check that ran |
| `summary` | `object` | Issue counts: `{ critical, warnings, info }` |
| `projectInfo` | `ProjectInfo` | Detected project metadata |
| `projectPath` | `string` | Absolute path to the analyzed project |
| `timestamp` | `string` | ISO 8601 timestamp of the scan |
| `quote` | `Quote?` | Optional personality quote based on overall health |

### ProjectInfo

Metadata about the scanned project, detected automatically.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Package name from `package.json` |
| `version` | `string` | Package version |
| `hasTypeScript` | `boolean` | Whether TypeScript is configured |
| `hasESLint` | `boolean` | Whether ESLint is configured |
| `hasPrettier` | `boolean` | Whether Prettier is configured |
| `framework` | `string` | Detected framework: `react`, `next`, `vite`, `cra`, `express`, `fastify`, `koa`, `hapi`, `hono`, `node`, or `unknown` |
| `packageManager` | `string` | `npm`, `pnpm`, `yarn`, or `bun` |
| `totalDependencies` | `number` | Combined count of dependencies and devDependencies |
| `dependencies` | `object` | Production dependencies (name to version) |
| `devDependencies` | `object` | Development dependencies (name to version) |
| `overrides` | `object?` | Dependency overrides, if any |

### CheckResult

One entry per health check that was executed.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique check identifier (e.g. `knip`, `npm-audit`) |
| `name` | `string` | Human-readable check name |
| `category` | `string` | One of: `dependencies`, `performance`, `code-quality`, `security`, `git` |
| `score` | `number` | Check score from 0 to 100 |
| `status` | `string` | `pass`, `warning`, `fail`, or `skipped` |
| `issues` | `Issue[]` | Problems found by this check |
| `toolsUsed` | `string[]` | Underlying tools that powered this check |
| `duration` | `number` | Execution time in milliseconds |
| `metadata` | `object?` | Check-specific extra data |

### Issue

An individual problem found during a check.

| Field | Type | Description |
|-------|------|-------------|
| `message` | `string` | Human-readable description of the problem |
| `severity` | `string` | `critical`, `warning`, or `info` |
| `file` | `string?` | File path where the issue was found, if applicable |
| `reportedBy` | `string[]` | Names of the tools that flagged this issue |
| `fix` | `FixSuggestion?` | Suggested fix, if available |

### FixSuggestion

An optional remediation hint attached to an issue.

| Field | Type | Description |
|-------|------|-------------|
| `description` | `string` | What the fix does |
| `command` | `string?` | Shell command to apply the fix |
| `modifiesSource` | `boolean?` | Whether the fix changes source files |
| `nextSteps` | `string?` | Follow-up instructions after applying |
| `codeChange` | `object?` | Before/after code snippet: `{ before, after }` |

### MonorepoReport

Returned instead of `SickbayReport` when scanning a monorepo root.

| Field | Type | Description |
|-------|------|-------------|
| `isMonorepo` | `true` | Always `true` — use this to distinguish from a single-project report |
| `rootPath` | `string` | Absolute path to the monorepo root |
| `monorepoType` | `string` | `pnpm`, `npm`, `yarn`, `turbo`, `nx`, or `lerna` |
| `packageManager` | `string` | `npm`, `pnpm`, `yarn`, or `bun` |
| `packages` | `PackageReport[]` | Per-package scan results |
| `overallScore` | `number` | Aggregate score across all packages |
| `summary` | `object` | Combined issue counts: `{ critical, warnings, info }` |
| `timestamp` | `string` | ISO 8601 timestamp |
| `quote` | `Quote?` | Optional personality quote |

### PackageReport

One entry per workspace package in a monorepo scan.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Package name |
| `path` | `string` | Absolute path to the package |
| `relativePath` | `string` | Path relative to the monorepo root |
| `framework` | `string` | Detected framework |
| `runtime` | `string` | `browser`, `node`, `edge`, or `unknown` |
| `checks` | `CheckResult[]` | Check results for this package |
| `score` | `number` | Package health score |
| `summary` | `object` | Issue counts: `{ critical, warnings, info }` |
| `dependencies` | `object` | Production dependencies |
| `devDependencies` | `object` | Development dependencies |

## Example Report

A truncated example showing the overall structure:

```json
{
  "timestamp": "2026-03-29T14:30:00.000Z",
  "projectPath": "/home/user/my-app",
  "projectInfo": {
    "name": "my-app",
    "version": "1.0.0",
    "hasTypeScript": true,
    "hasESLint": true,
    "hasPrettier": false,
    "framework": "react",
    "packageManager": "pnpm",
    "totalDependencies": 42,
    "dependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" },
    "devDependencies": { "typescript": "^5.7.0", "vite": "^6.0.0" }
  },
  "overallScore": 74,
  "summary": {
    "critical": 1,
    "warnings": 5,
    "info": 12
  },
  "checks": [
    {
      "id": "npm-audit",
      "name": "Security Audit",
      "category": "security",
      "score": 55,
      "status": "fail",
      "issues": [
        {
          "severity": "critical",
          "message": "lodash@4.17.20 has a prototype pollution vulnerability (CVE-2021-23337)",
          "file": "package-lock.json",
          "reportedBy": ["npm-audit"],
          "fix": {
            "description": "Update lodash to 4.17.21 or later",
            "command": "pnpm update lodash",
            "modifiesSource": false
          }
        }
      ],
      "toolsUsed": ["npm audit"],
      "duration": 2340,
      "metadata": { "totalVulnerabilities": 3 }
    },
    {
      "id": "knip",
      "name": "Unused Dependencies",
      "category": "dependencies",
      "score": 85,
      "status": "warning",
      "issues": [
        {
          "severity": "warning",
          "message": "Unused dependency: moment",
          "reportedBy": ["knip"],
          "fix": {
            "description": "Remove moment from dependencies",
            "command": "pnpm remove moment"
          }
        }
      ],
      "toolsUsed": ["knip"],
      "duration": 1820
    }
  ],
  "quote": {
    "text": "Your code has a mild fever. Nothing some refactoring won't cure.",
    "source": "Dr. Sickbay",
    "severity": "warning"
  }
}
```

## Distinguishing Report Types

When parsing JSON output, check for the `isMonorepo` field to determine which shape you're working with:

```bash
IS_MONO=$(jq '.isMonorepo // false' report.json)

if [ "$IS_MONO" = "true" ]; then
  echo "Monorepo with $(jq '.packages | length' report.json) packages"
  jq -r '.packages[] | "\(.name): \(.score)"' report.json
else
  echo "Single project score: $(jq '.overallScore' report.json)"
fi
```
