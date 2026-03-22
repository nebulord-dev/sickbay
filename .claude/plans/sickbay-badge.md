# Feature: Sickbay Badge

> **Roadmap Phase**: Phase 2 — Standalone Polish
> **Blocked by**: nothing

Validate patterns and imports against the codebase before implementing. Pay close attention
to existing type names, util locations, and runner registration patterns.

## Feature Description

`sickbay badge` generates a shields.io-style markdown/HTML badge showing the project's health score, color-coded green/yellow/red. The badge is static — generated from the last scan result or a fresh scan. Output is markdown by default, with `--html` and `--url` variants. The badge URL uses shields.io's static badge endpoint so no server is needed.

## User Story

As a developer maintaining an open source project
I want to generate a health score badge for my README
So that contributors and users can see the project's health at a glance

## Problem Statement

There's no way to surface the sickbay health score outside of the CLI or web dashboard. Open source projects commonly use README badges to signal quality, and sickbay has no badge generation.

## Solution Statement

Add a `sickbay badge` subcommand that reads the last report from `.sickbay/last-report.json` (or runs a fresh scan if none exists) and outputs a shields.io static badge URL. The command is pure CLI — no new core or web changes needed. Follows the same command registration pattern as `doctor`, `stats`, `trend`.

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: Low
**Packages Affected**: cli only
**New npm Dependencies**: none (uses shields.io URL — no HTTP calls needed)
**Touches `types.ts`**: No

---

## CONTEXT REFERENCES

### Files to Read Before Implementing

- `apps/cli/src/index.ts` — command registration pattern (mirror `stats` or `doctor`)
- `apps/cli/src/commands/stats.ts` — simple command module pattern to follow
- `apps/cli/src/lib/history.ts` — `saveLastReport` / `.sickbay/last-report.json` convention
- `packages/constants/src/index.ts` — `SCORE_EXCELLENT` (90), `SCORE_GOOD` (80), `SCORE_FAIR` (60) thresholds
- `apps/cli/src/lib/resolve-package.ts` — `resolveProject()` for monorepo support

### New Files to Create

- `apps/cli/src/commands/badge.ts` — badge generation logic
- `apps/cli/src/commands/badge.test.ts` — unit tests

### Patterns to Follow

**Command module pattern** (from stats.ts, doctor.ts):
```typescript
// Export a pure function, no Ink rendering needed
export function generateBadge(options: BadgeOptions): BadgeResult { ... }
```

**shields.io static badge URL format:**
```
https://img.shields.io/badge/{label}-{message}-{color}
```
Example: `https://img.shields.io/badge/sickbay-92%2F100-brightgreen`

**Score → color mapping** (mirrors existing thresholds from constants):
- 90+ → `brightgreen`
- 80–89 → `green`
- 60–79 → `yellow`
- <60 → `red`

---

## IMPLEMENTATION PLAN

### Phase 1: Badge Command Module

Create `apps/cli/src/commands/badge.ts` with pure functions for badge URL generation and markdown/HTML formatting.

### Phase 2: CLI Registration

Register `sickbay badge` in `apps/cli/src/index.ts` following the same pattern as other subcommands.

### Phase 3: Tests

Unit tests for URL generation, color mapping, markdown/HTML output, and edge cases.

---

## STEP-BY-STEP TASKS

### 1. CREATE `apps/cli/src/commands/badge.ts`

- **IMPLEMENT**:
  - `getScoreColor(score: number): string` — maps score to shields.io color name:
    - `>= SCORE_EXCELLENT` (90) → `brightgreen`
    - `>= SCORE_GOOD` (80) → `green`
    - `>= SCORE_FAIR` (60) → `yellow`
    - `< SCORE_FAIR` → `red`
  - `badgeUrl(score: number, label?: string): string` — returns shields.io static badge URL:
    - Default label: `sickbay`
    - Message: `{score}/100` (URL-encoded: `{score}%2F100`)
    - Color from `getScoreColor`
    - Format: `https://img.shields.io/badge/{label}-{score}%2F100-{color}`
  - `badgeMarkdown(score: number, label?: string): string` — returns `![{label}]({url})`
  - `badgeHtml(score: number, label?: string): string` — returns `<img src="{url}" alt="{label}" />`
  - `loadScoreFromLastReport(projectPath: string): number | null` — reads `.sickbay/last-report.json`, returns `overallScore` or null
- **IMPORTS**: `{ existsSync, readFileSync }` from `fs`, `{ join }` from `path`, `{ SCORE_EXCELLENT, SCORE_GOOD, SCORE_FAIR }` from `@sickbay/constants`
- **GOTCHA**: Don't import from `@sickbay/core` at top level — only needed if running a fresh scan, so dynamic import inside the fallback path
- **VALIDATE**: `pnpm --filter @sickbay/cli build`

### 2. UPDATE `apps/cli/src/index.ts`

- **IMPLEMENT**: Register `sickbay badge` command after the `doctor` command block:
  ```typescript
  program
    .command("badge")
    .description("Generate a health score badge for your README")
    .option("-p, --path <path>", "project path", process.cwd())
    .option("--package <name>", "scope to a single package (monorepo only)")
    .option("--html", "output HTML <img> tag instead of markdown")
    .option("--url", "output bare badge URL only")
    .option("--label <text>", "custom badge label", "sickbay")
    .option("--scan", "run a fresh scan instead of using last report")
    .action(async (options) => { ... });
  ```
  - Action logic:
    1. Resolve project via `resolveProject()` (supports `--package`)
    2. Try `loadScoreFromLastReport(projectPath)`
    3. If null or `--scan` flag: dynamically import `runSickbay` from `@sickbay/core`, run scan, save report, get score
    4. Output based on flags: `--url` → `badgeUrl()`, `--html` → `badgeHtml()`, default → `badgeMarkdown()`
    5. `process.stdout.write(output + "\n")` and `process.exit(0)`
- **PATTERN**: Mirror `stats` command registration style
- **VALIDATE**: `pnpm --filter @sickbay/cli build`

### 3. CREATE `apps/cli/src/commands/badge.test.ts`

- **IMPLEMENT**:
  - Test `getScoreColor`: 95 → `brightgreen`, 85 → `green`, 70 → `yellow`, 40 → `red`
  - Test `badgeUrl`: correct URL format, score encoding, custom label
  - Test `badgeMarkdown`: wraps URL in `![label](url)` format
  - Test `badgeHtml`: wraps URL in `<img>` tag
  - Test `loadScoreFromLastReport`: returns score when file exists, null when missing
  - Test edge cases: score of 0, score of 100, boundary values (60, 80, 90)
- **PATTERN**: Follow `apps/cli/src/commands/doctor.test.ts` style
- **VALIDATE**: `pnpm --filter @sickbay/cli test`

---

## VALIDATION COMMANDS

### Level 1: Type checking
```bash
pnpm --filter @sickbay/cli build
```

### Level 2: Unit tests
```bash
pnpm --filter @sickbay/cli test
```

### Level 3: Manual spot checks
```bash
# Using existing last-report
node apps/cli/dist/index.js badge --path fixtures/packages/react-app

# Fresh scan
node apps/cli/dist/index.js badge --path fixtures/packages/react-app --scan

# URL only
node apps/cli/dist/index.js badge --path fixtures/packages/react-app --url

# HTML output
node apps/cli/dist/index.js badge --path fixtures/packages/react-app --html

# Custom label
node apps/cli/dist/index.js badge --path fixtures/packages/react-app --label "project health"
```

---

## ACCEPTANCE CRITERIA

- [ ] `sickbay badge` outputs markdown badge using last report score
- [ ] `--url` outputs bare shields.io URL
- [ ] `--html` outputs `<img>` tag
- [ ] `--label` customizes badge text
- [ ] `--scan` forces fresh scan instead of reading last report
- [ ] `--package` works for monorepo scoping
- [ ] Falls back to fresh scan if no `.sickbay/last-report.json` exists
- [ ] Score colors match thresholds: 90+ brightgreen, 80+ green, 60+ yellow, <60 red
- [ ] All CLI tests pass
- [ ] Build passes

---

## MONOREPO FUTURE-PROOFING NOTES

- `--package` flag already supported via `resolveProject()`. Per-package badges work if each package has its own `.sickbay/last-report.json`, which the current auto-save in `App.tsx` handles for scoped runs.

---

## NOTES

- No core or web changes needed — this is a CLI-only feature.
- shields.io static badges require no API calls — the URL itself encodes all badge data. The badge renders when a browser/GitHub fetches the URL.
- The `%2F` encoding for `/` in `score/100` is important — shields.io uses `/` as a delimiter.
- For monorepo root badges, we could later add an aggregate score badge, but that's out of scope here.
