# Sickbay Config & Project Data Design

> **Last updated**: 2026-04-02
> **Status**: Design draft — needs collaborative schema design session before implementation
> **Jira**: KAN-99
> **Labels**: collab, phase-4

## Overview

Sickbay needs a way for projects to calibrate checks to their own standards, and a place to store data it generates over time. This document covers the config file format, the `.sickbay/` project folder, the `sickbay init` command, and the related web UI surface.

---

## What's Already Implemented

Several pieces from this design already exist in the codebase. Don't re-implement these:

| Piece | Status | Location |
|---|---|---|
| `.sickbay/` folder | Exists | Created by `sickbay init` and auto-created on scan |
| `.sickbay/.gitignore` | Exists | Created by `sickbay init` |
| `.sickbay/baseline.json` | Exists | Created by `sickbay init` |
| `.sickbay/history.json` | Exists | Appended on every scan (single file, not per-timestamp) |
| `.sickbay/last-report.json` | Exists | Overwritten on every scan |
| `sickbay init` command | Exists | Scaffolds `.sickbay/`, baseline, gitignore |
| `sickbay diff` command | Exists | Reads baseline from `.sickbay/last-report.json` via git |
| History tab (web) | Exists | Line chart from `.sickbay/history.json` |
| File-type thresholds | Exists (v1.5.0) | `packages/core/src/utils/file-types.ts` — per-file-type warn/critical |
| `--checks` flag | Exists | CLI already supports selecting a subset of checks |

**Key difference from original design**: History is stored as a single `history.json` file with appended entries, not as individual timestamped files in a `history/` directory. The `cache/` directory for incremental checks was never built (KAN-115 was removed as noise).

---

## The Core Problem

Sickbay ships with opinionated defaults (e.g. 300-line component threshold, 150-line hook threshold, specific dep age thresholds). These make sense as universal starting points, but projects with established conventions shouldn't be penalized for not conforming to them. A codebase with 800-line components isn't necessarily unhealthy — it just has different standards.

The goal is **calibration**, not suppression. The user isn't dismissing the check; they're telling Sickbay what "healthy" means for their project. Scores should reflect the project's health against its own declared standards, not a one-size-fits-all ruleset.

When custom thresholds are active, Sickbay should surface a notice in both the TUI and web dashboard so the score is understood in context.

---

## Config File: `sickbay.config.ts`

The config lives at the project root as `sickbay.config.ts`, alongside `vite.config.ts`, `eslint.config.ts` etc. This is the established ecosystem pattern — visible, findable, consistent.

**Not** `.sickbayrc.json` — JSON gives no IDE support and no programmatic capability. **Not** `.sickbay/config.ts` — config should be at the root where users expect it, not buried in a data folder.

Sickbay executes it at runtime using `jiti` so users never need a build step.

### Shape (needs revision — see open questions)

```ts
import { defineConfig } from 'sickbay'

export default defineConfig({
  // Check configuration — all checks listed, enabled by default.
  // Set to `false` to disable, or pass an object to override thresholds.
  checks: {
    // --- Dependencies ---
    knip: true,
    depcheck: true,
    outdated: true,
    'npm-audit': true,
    'license-checker': true,
    'heavy-deps': true,

    // --- Code Quality ---
    complexity: {
      // Override per-file-type thresholds (omitted types keep defaults)
      thresholds: {
        'react-component': { warn: 400, critical: 600 },
        'custom-hook': { warn: 200, critical: 350 },
        // 'node-service', 'route-file', 'ts-utility', 'config', 'test', 'general'
      },
    },
    jscpd: true,
    eslint: true,
    'todo-scanner': true,
    typescript: true,
    coverage: true,

    // --- Performance ---
    'react-perf': false,   // disabled — project doesn't use React patterns this checks for
    'source-map-explorer': true,
    'asset-size': true,

    // --- Security ---
    secrets: true,
    'node-security': true,
    'node-input-validation': true,
    'node-async-errors': true,

    // --- Git ---
    git: true,

    // --- Framework-specific (only shown if framework detected) ---
    'next-images': true,
    'next-link': true,
    'next-fonts': true,
    'next-missing-boundaries': true,
    'next-security-headers': true,
    'next-client-components': true,
    'angular-change-detection': true,
    'angular-lazy-routes': true,
    'angular-strict': true,
    'angular-subscriptions': true,
  },

  // Exclude paths from all checks
  exclude: ['src/generated/**', 'src/legacy/**'],

  // Override category weights (must sum to 1)
  weights: {
    security: 0.35,
    dependencies: 0.20,
    'code-quality': 0.25,
    performance: 0.10,
    git: 0.10,
  },
})
```

### `defineConfig` helper

Sickbay exports `defineConfig` from the `sickbay` package (the CLI). It's a typed identity function — no runtime logic, just TypeScript inference. The benefit is full autocomplete and validation in any editor without needing a JSON schema.

### Monorepo support

In a monorepo, `sickbay.config.ts` at the workspace root applies to all packages. Individual packages can have their own `sickbay.config.ts` for overrides. The per-package config merges with (and takes precedence over) the root config. This is deferred to later phases.

---

## Project Data Folder: `.sickbay/`

> **Already implemented.** The folder structure below reflects what actually exists today.

```
.sickbay/
├── .gitignore          # generated by sickbay init
├── history.json        # appended on every scan (array of report entries)
├── last-report.json    # full report from most recent scan
├── baseline.json       # reference point from sickbay init
└── dep-tree.json       # dependency tree cache
```

---

## `sickbay init` Command

> **Already implemented (steps 2-4).** Step 1 (config file generation) is the new work.

1. **NEW**: Creates `sickbay.config.ts` at project root with all checks listed and set to `true`, defaults shown in comments — the primary discoverability surface
2. Creates `.sickbay/` folder with a `.gitignore` inside
3. Runs an initial scan and saves the result as `.sickbay/baseline.json`
4. Prints a summary of what was created

The generated config should list every check that's applicable to the detected project type, with their current default thresholds shown in comments. Framework-specific checks only appear if that framework is detected.

---

## Web UI: Config & Data Pages

### Config tab

A read-only view of the active configuration:

- Lists every check, its default threshold, and whether a custom value is in effect
- Highlights overridden values visually (e.g. a different color or "custom" badge)
- Shows which checks are disabled and which paths are excluded
- Links out to scoring docs for each check

**Editable config** (later): The CLI HTTP server could expose a write endpoint that proxies changes back to `sickbay.config.ts` on disk. The UI would show a diff preview before writing. Not in scope for the initial implementation — read-only first.

### History tab

> **Already implemented.** Line chart from `.sickbay/history.json` with toggleable category lines.

---

## Relationship to Other Features

| Feature | Dependency on this design | Status |
|---|---|---|
| Historical Trends | Reads from `.sickbay/history.json` | **Done** |
| Branch diff (`sickbay diff`) | Reads `.sickbay/last-report.json` via git | **Done** |
| False positive suppression | `suppress` key in `sickbay.config.ts` | Not started |
| `.sickbayrc` (original task) | Superseded by this design | N/A |
| CI/CD integration | References `baseline.json` for threshold enforcement | Not started |
| Monorepo per-package config | Extends this schema | Not started |

---

## What's Not Configurable

Some checks are objective and should not be threshold-configurable:

- Hardcoded secrets / credentials
- Known CVEs from `npm audit`
- Circular dependencies (existence, not count)

These can be suppressed on a case-by-case basis (via the `suppress` mechanism — TBD) but their scoring logic isn't user-adjustable.

---

## Implementation Notes

- `jiti` executes `sickbay.config.ts` at runtime without requiring a user build step
- Config is loaded once in `runner.ts` and passed through as part of the runner context
- Each runner declares which config keys it reads — unknown keys should warn, not silently ignore
- The "custom thresholds in effect" notice should appear: in the TUI score panel, in the web dashboard header, and in `--json` output as a top-level flag
- Design the config type to be extensible for per-package monorepo overrides from the start

---

## Open Questions for Design Session

These need to be resolved collaboratively before implementation:

### 1. Check configuration ergonomics

The current proposal uses `true`/`false`/`object` per check. Is this the right DX?

```ts
checks: {
  knip: true,                          // enabled, defaults
  'react-perf': false,                 // disabled
  complexity: { thresholds: { ... } }, // enabled with overrides
}
```

Alternative: separate `disable` array + `overrides` object? The combined approach is more concise but means checks can be three different types (`boolean | CheckConfig`).

### 2. Complexity threshold overrides

Now that we have per-file-type thresholds (KAN-125, v1.5.0), overriding complexity is more nuanced. The current file types are: `react-component`, `custom-hook`, `node-service`, `route-file`, `ts-utility`, `config`, `test`, `general`. Users need to be able to override any subset. Proposed shape:

```ts
complexity: {
  thresholds: {
    'react-component': { warn: 400, critical: 600 },
    // omitted types keep defaults from FILE_TYPE_THRESHOLDS
  },
}
```

Should we also support a flat `maxLines` override that applies to all types as a multiplier or absolute override? Or is per-type granular enough?

### 3. What overrides does each runner support?

Need to audit all ~34 runners and catalog which ones have configurable thresholds vs which are binary (pass/fail with no knobs). Some candidates:

- **complexity**: file-type thresholds (designed above)
- **jscpd**: duplication threshold percentage
- **outdated**: max age for dependencies
- **coverage**: minimum coverage percentages
- **heavy-deps**: size threshold for flagging
- **asset-size**: max asset size
- **todo-scanner**: which patterns to scan for

Many runners (knip, depcheck, eslint, madge, npm-audit, secrets) are binary — they find issues or they don't. For these, the only config is enable/disable.

### 4. False positive suppression shape

Absorbed from KAN-100. How do users suppress specific findings?

```ts
suppress: {
  secrets: [
    { path: 'src/config.ts', pattern: 'NEXT_PUBLIC_*' },   // public keys
  ],
  'npm-audit': [
    { advisory: 'GHSA-xxxx', reason: 'Not exploitable in our context' },
  ],
}
```

Or simpler — just an array of issue message patterns?

```ts
suppress: [
  { check: 'secrets', match: 'NEXT_PUBLIC_*', reason: '...' },
]
```

### 5. Phased rollout

Can we ship useful increments?

- **Phase A**: Check enable/disable only (`true`/`false`) — simplest, immediately useful
- **Phase B**: Threshold overrides for checks that support them
- **Phase C**: `exclude` paths, category weights
- **Phase D**: False positive suppression
- **Phase E**: Web Config tab

Or is it better to ship the full schema at once so the config format doesn't churn?

### 6. Scoring weight validation

If the user provides `weights`, must they sum to 1? What if they only override one category — do we normalize the rest? Or require all five?

### 7. Where does `defineConfig` live?

The doc says `@sickbay/core` but users import from `sickbay` (the CLI package). Since the config is a user-facing file, the import should be from the package they installed: `import { defineConfig } from 'sickbay'`. The type can live in core and be re-exported.
