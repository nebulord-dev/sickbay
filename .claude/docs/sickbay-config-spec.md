# Sickbay Config System Design

> **Date**: 2026-04-04
> **Jira**: KAN-99
> **Status**: Approved design, ready for implementation planning
> **Phase**: 4 (with schema designed for forward compatibility through Phase F)

## Overview

A typed configuration file (`sickbay.config.ts`) at the project root that lets users calibrate Sickbay to their project's standards. The config is authored with a `defineConfig` helper for full IDE autocomplete, loaded at runtime via `jiti` (no build step), and threaded through the runner pipeline.

The core principle is **calibration, not suppression**. Users aren't dismissing checks — they're telling Sickbay what "healthy" means for their project. Scores reflect the project's health against its own declared standards.

---

## What Already Exists

These pieces are implemented and should not be rebuilt:

| Piece | Location |
|---|---|
| `.sickbay/` folder | Created by `sickbay init` and auto-created on scan |
| `.sickbay/.gitignore` | Created by `sickbay init` |
| `.sickbay/baseline.json` | Created by `sickbay init` |
| `.sickbay/history.json` | Appended on every scan (single file, not per-timestamp) |
| `.sickbay/last-report.json` | Overwritten on every scan |
| `sickbay init` command | Scaffolds `.sickbay/`, baseline, gitignore |
| `sickbay diff` command | Reads baseline from `.sickbay/last-report.json` via git |
| History tab (web) | Line chart from `.sickbay/history.json` |
| Per-file-type thresholds | `packages/core/src/utils/file-types.ts` (v1.5.0) |
| `--checks` flag | CLI already supports selecting a subset of checks |
| `ProjectContext` infrastructure | `detectContext()`, `applicableFrameworks`/`applicableRuntimes` on `BaseRunner` |

---

## Config File

### Location and Format

- **File**: `sickbay.config.ts` at the project root, alongside `vite.config.ts`, `eslint.config.ts`, etc.
- **Fallback resolution**: `sickbay.config.ts` > `sickbay.config.js` > `sickbay.config.mjs`. First found wins. Only checked at project root.
- **Runtime loading**: `jiti` executes the file — no user build step required.
- **Zero-config default**: If no config file exists, all defaults apply. Sickbay remains zero-config for users who don't need customization.

### Authoring

```ts
import { defineConfig } from 'sickbay'

export default defineConfig({
  // ...
})
```

`defineConfig` is a typed identity function — no runtime logic, just TypeScript inference for full autocomplete and validation in any editor.

### Type Location

The `SickbayConfig` type and `defineConfig` function are defined in `packages/core/src/config.ts`. The CLI (`apps/cli`) re-exports `defineConfig` from its own entry point so users import from `sickbay` — the package they install.

---

## Config Type

### Full Schema

```ts
// packages/core/src/config.ts

/**
 * Scoring categories. This is a subset of CheckResult['category'] — the existing
 * 'unknown-category' value is excluded because it has no weight. Runners with
 * category 'unknown-category' fall back to a 0.1 weight (existing behavior in scoring.ts).
 */
export type Category = 'dependencies' | 'performance' | 'code-quality' | 'security' | 'git';

export interface SickbayConfig {
  /** Override which checks run. Omitted checks keep their defaults (enabled). */
  checks?: {
    [checkId: string]: boolean | CheckConfig;
  };

  /** Glob patterns to exclude from all checks. */
  exclude?: string[];

  /**
   * Override category scoring weights. Omitted categories keep defaults.
   * Values are normalized proportionally — no need to sum to 1.
   */
  weights?: Partial<Record<Category, number>>;
}

export interface CheckConfig {
  /** Set false to disable this check (default: true). */
  enabled?: boolean;

  /** Check-specific threshold overrides. Shape varies per runner. */
  thresholds?: Record<string, unknown>;

  /** Glob patterns to exclude from this check only. */
  exclude?: string[];

  /** Suppress specific findings from this check. */
  suppress?: SuppressionRule[];
}

export interface SuppressionRule {
  /** Glob pattern matching file paths (picomatch syntax). Matched against Issue.file. */
  path?: string;
  /**
   * Substring match against Issue.message. Case-insensitive.
   * Examples: 'NEXT_PUBLIC_*' for secrets, 'GHSA-xxxx' for npm-audit advisories.
   * When both path and match are provided, both must match (AND logic).
   * When only one is provided, it alone determines the match.
   */
  match?: string;
  /** Why this is suppressed — required, shows in reports to prevent suppress-and-forget rot. */
  reason: string;
}

export function defineConfig(config: SickbayConfig): SickbayConfig {
  return config;
}
```

### Check Configuration Ergonomics

A check can be set to three shapes:

| Value | Meaning |
|---|---|
| `true` | Enabled with all defaults |
| `false` | Disabled entirely |
| `{ ... }` (CheckConfig object) | Enabled with overrides (thresholds, exclude, suppress) |
| `{ enabled: false }` | Also valid for disabling — both paths work |

Checks **not listed** in the config are enabled with defaults. The config is overrides-only, not exhaustive. This means new checks added in future Sickbay versions automatically run without requiring config changes.

### Weight Normalization

When users provide partial `weights`, omitted categories keep their default ratios. All values are normalized proportionally to sum to 1.0.

Example: if a user sets `{ security: 0.50 }`, the remaining 0.50 is distributed among the other four categories in proportion to their original weights.

Default weights:
- `security`: 0.30
- `dependencies`: 0.25
- `code-quality`: 0.25
- `performance`: 0.15
- `git`: 0.05

Validation: weight values must be > 0. Values ≤ 0 produce an error.

#### Normalization Algorithm

```ts
function normalizeWeights(
  userWeights: Partial<Record<Category, number>>,
  defaults: Record<Category, number>,
): Record<Category, number> {
  // Start with defaults
  const merged = { ...defaults };

  // Apply user overrides (these are absolute values, not relative)
  for (const [cat, val] of Object.entries(userWeights)) {
    merged[cat as Category] = val;
  }

  // Normalize so all values sum to 1.0
  const total = Object.values(merged).reduce((sum, v) => sum + v, 0);
  for (const cat of Object.keys(merged)) {
    merged[cat as Category] /= total;
  }

  return merged;
}
```

This means: user values are treated as absolute weights in the same scale as defaults. If a user sets `{ security: 0.50 }`, the merged map is `{ security: 0.50, dependencies: 0.25, code-quality: 0.25, performance: 0.15, git: 0.05 }` (total 1.20), which normalizes to `{ security: 0.417, dependencies: 0.208, code-quality: 0.208, performance: 0.125, git: 0.042 }`. Security gets the largest share; other categories shrink proportionally.

---

## Per-Runner Threshold Types

Based on a full audit of all 34 runners. Runners are grouped into **configurable** (have threshold knobs) and **binary** (enable/disable only).

### Configurable Runners (12)

#### Dependencies

```ts
outdated: {
  thresholds: {
    maxOutdated: number;        // default: 15 — fail threshold
  }
}
```

#### Code Quality

```ts
complexity: {
  thresholds: {
    'react-component'?: { warn: number; critical: number };  // 300 / 500
    'custom-hook'?: { warn: number; critical: number };       // 150 / 250
    'node-service'?: { warn: number; critical: number };      // 500 / 800
    'route-file'?: { warn: number; critical: number };        // 250 / 400
    'ts-utility'?: { warn: number; critical: number };        // 600 / 1000
    'config'?: { warn: number; critical: number };            // Infinity / Infinity
    'test'?: { warn: number; critical: number };              // Infinity / Infinity
    'general'?: { warn: number; critical: number };           // 400 / 600
  }
}

jscpd: {
  thresholds: {
    warnPercent: number;        // default: 5
    criticalPercent: number;    // default: 20
  }
}

coverage: {
  thresholds: {
    lines: number;              // default: 80
    functions: number;          // default: 80
  }
}

eslint: {
  thresholds: {
    maxErrors: number;          // default: 10 — fail threshold
  }
}

typescript: {
  thresholds: {
    maxErrors: number;          // default: 20 — fail threshold
  }
}

madge: {
  thresholds: {
    maxCircular: number;        // default: 5 — fail threshold
  }
}

'todo-scanner': {
  thresholds: {
    patterns: string[];         // default: ['TODO', 'FIXME', 'HACK']
  }
}
```

#### Performance

```ts
'asset-size': {
  thresholds: {
    imageWarn: number;          // default: 512000 (500KB)
    imageCritical: number;      // default: 2097152 (2MB)
    svgWarn: number;            // default: 102400 (100KB)
    fontWarn: number;           // default: 512000 (500KB)
    totalWarn: number;          // default: 5242880 (5MB)
    totalCritical: number;      // default: 10485760 (10MB)
  }
}

'source-map-explorer': {
  thresholds: {
    warnSize: number;           // default: 512000 (500KB)
    failSize: number;           // default: 1048576 (1MB)
  }
}
```

#### Security

```ts
'license-checker': {
  thresholds: {
    blocklist: string[];        // default: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.1', 'LGPL-3.0', 'CC-BY-NC']
  }
}
```

#### Git

```ts
git: {
  thresholds: {
    staleMonths: number;        // default: 6
    maxRemoteBranches: number;  // default: 20
  }
}
```

### Binary Runners — Enable/Disable Only (13)

These runners find issues or don't — no user-facing threshold knobs. They accept `true | false | { exclude, suppress }`.

- **Angular** (7): `angular-build-config`, `angular-change-detection`, `angular-lazy-routes`, `angular-security`, `angular-strict`, `angular-subscriptions`, `angular-template-performance`
- **Node** (3): `node-security`, `node-input-validation`, `node-async-errors`
- **Next** (1): `next-missing-boundaries`
- **General** (2): `knip`, `depcheck`

### Intentionally Excluded from Threshold Config

The following runners have internal score multipliers but exposing them as user config would be confusing:

- `react-perf` — score multipliers per pattern (warning ×3, info ×1)
- `npm-audit` — severity multipliers (critical ×15, moderate ×10, low ×2)
- `secrets` — score multiplier (×25 per finding)
- `heavy-deps` — per-package severity list
- `next-images`, `next-link`, `next-fonts`, `next-client-components`, `next-security-headers` — score multipliers per violation

Score multipliers are implementation details. Users control these checks via enable/disable and suppress.

### What's Not Configurable

Some checks are objective and should not have threshold overrides:

- Hardcoded secrets / credentials (secrets runner)
- Known CVEs from `npm audit` (npm-audit runner)
- Circular dependencies existence (madge runner — count threshold is configurable, but you can't tell it circular deps are "fine")

These can be suppressed on a case-by-case basis with `suppress` rules but their core scoring logic isn't user-adjustable.

---

## Generated Config File

### What `sickbay init` Generates

The generated config is **lean** — just check names and `true`/`false`. No thresholds, no suppress, no weights. The file doubles as a discoverability surface: users see every applicable check and can flip any to `false` without looking up names.

```ts
// Threshold overrides, suppressions, and more:
// https://nebulord-dev.github.io/sickbay/guide/configuration
import { defineConfig } from 'sickbay'

export default defineConfig({
  checks: {
    // --- Dependencies ---
    knip: true,
    depcheck: true,
    outdated: true,
    'npm-audit': true,
    'license-checker': true,
    'heavy-deps': true,

    // --- Code Quality ---
    complexity: true,
    jscpd: true,
    madge: true,
    eslint: true,
    'todo-scanner': true,
    typescript: true,
    coverage: true,

    // --- Performance ---
    'react-perf': true,
    'source-map-explorer': true,
    'asset-size': true,

    // --- Security ---
    secrets: true,

    // --- Git ---
    git: true,
  },
})
```

The generated checks are **framework-aware**: if the project is detected as Next.js, the 6 Next runners are included. Angular gets the Angular runners. Node API gets the Node runners. Checks that don't apply to the detected framework are omitted — no noise.

Threshold overrides, suppress syntax, weights, and exclude are documented in the **VitePress docs** under a Configuration Reference page. Users who need to tune copy the relevant snippet from the docs.

### Idempotent `sickbay init`

`sickbay init` must accommodate users who have been running Sickbay without a config and decide to add one later:

| Piece | If missing | If exists |
|---|---|---|
| `sickbay.config.ts` | Generate with applicable checks as `true` | Skip, print "Config already exists, skipping" |
| `.sickbay/` folder | Create with `.gitignore` | Skip |
| `.sickbay/baseline.json` | Run baseline scan, save | Skip |
| `.sickbay/history.json` | Append baseline entry | Append baseline entry |

The config file is never overwritten or merged into — it's the user's file.

**Important**: `sickbay init` now needs to call `detectContext()` before generating the config, so it knows which framework-specific checks to include. This is a new dependency for the init command — it currently only scaffolds files, it does not detect frameworks.

### Monorepo Behavior (Phase A)

In Phase A, `loadConfig()` only looks for a config file at the path passed to `runSickbay()`. For monorepo scans via `runSickbayMonorepo()`, the root config applies to all packages — `loadConfig(rootPath)` is called once and passed to every `runSickbay()` call. Per-package config files are not resolved until Phase F.

### Config Sync (Future — Phase F)

When Sickbay adds new runners in future versions, users who already have a config won't see them listed. The checks still **run** (unlisted = enabled by default), but they lose the discoverability benefit.

Two features address this:

1. **`sickbay init --sync`** — Reads the existing config, detects which applicable checks are missing, and appends them as `true` without touching existing entries. Preserves all user customizations. Useful after `npm update sickbay`.

2. **Scan-time notification** — When Sickbay detects checks running that aren't listed in the config, print a notice: "3 new checks available but not in your config. Run `sickbay init --sync` to add them."

Both are Phase F features. For Phase A, unlisted checks run with defaults silently.

---

## Config Loading Pipeline

### 1. Resolution

`loadConfig(projectPath)` in `packages/core/src/config.ts` looks for config files in order: `sickbay.config.ts` → `.js` → `.mjs` at the project root. Uses `jiti` to execute. Returns `SickbayConfig | null`.

**Error handling**: If `jiti` fails to load the file (syntax errors, missing imports, runtime exceptions), `loadConfig()` prints a descriptive error to stderr and returns `null`. The scan proceeds with all defaults. This is deliberate — a broken config should not block scanning. The error message includes the file path, the error, and a note: "Falling back to defaults."

### 2. Validation

Light validation after loading:

- Unknown check IDs → warning to stderr (not an error — forward-compatible with older configs that reference removed checks)
- Weight values ≤ 0 → error
- Malformed thresholds → warning per check, that check falls back to defaults

Warnings go to stderr so they don't break `--json` output.

### 3. Merging

Config merges with defaults in `runner.ts` before checks execute:

- **`checks`** → each runner checks if it's disabled (`false` or `{ enabled: false }`)
- **`exclude`** → global excludes passed to every runner; per-check excludes passed to that runner
- **`weights`** → merged with `CATEGORY_WEIGHTS`, then normalized proportionally to sum to 1
- **`thresholds`** → passed to the specific runner, which uses them instead of hardcoded constants
- **`suppress`** → passed to the specific runner, which filters results before returning

### 4. Report Metadata

The `SickbayReport` type gains a new field:

```ts
config?: {
  hasCustomConfig: boolean;
  overriddenChecks: string[];   // check IDs with non-default thresholds, excludes, or suppress
  disabledChecks: string[];     // check IDs set to false
}
```

This powers:
- "Custom config active" notice in CLI terminal output
- "Custom config active" badge in TUI score panel
- Config tab data in web dashboard (Phase E)

---

## Code Changes (Architecture)

### New Files

- `packages/core/src/config.ts` — `SickbayConfig` type, `defineConfig()`, `loadConfig()`, validation, merging logic

### Modified Files

- `packages/core/src/types.ts` — Add `config?` field to `SickbayReport` and `MonorepoReport`
- `packages/core/src/runner.ts` — Call `loadConfig()` at start of `runSickbay()`, filter disabled checks, pass resolved config to runners
- `packages/core/src/scoring.ts` — `calculateOverallScore(checks, weights?)` gains an optional second parameter: `weights?: Record<string, number>` (already-normalized). Normalization happens in `runner.ts` before calling this function.
- `packages/core/src/integrations/base.ts` — `RunOptions` extended with `checkConfig?: CheckConfig`. The resolved per-check config (thresholds, exclude, suppress) is passed through the existing `options` parameter. New signature: `run(projectPath: string, options?: RunOptions): Promise<CheckResult>` (unchanged shape, but `RunOptions` gains a field). This avoids changing the `ToolRunner` interface contract.
- `packages/core/src/index.ts` — Export `defineConfig`, `SickbayConfig`, and related types
- `apps/cli/src/index.ts` — Re-export `defineConfig` from CLI entry point
- `apps/cli/src/commands/init.ts` — Generate `sickbay.config.ts` when missing
- Individual runner files (Phase B) — Read thresholds from config instead of hardcoded constants

### Web Dashboard (Phase E)

- `apps/web/src/components/ConfigTab.tsx` — New read-only Config tab component
- `apps/web/src/components/Dashboard.tsx` — Add Config tab to navigation
- `apps/cli/src/commands/web.ts` — Serve `/sickbay-config.json` endpoint

### VitePress Docs

- `apps/docs/guide/configuration.md` — New Configuration Reference page with per-runner threshold examples, suppress syntax, weight overrides, exclude patterns

---

## Implementation Phases

Each phase is a standalone deliverable that ships value on its own. The full `SickbayConfig` type ships in Phase A so the schema is stable from day one.

### Phase A: Config Loading + Enable/Disable ✅ Complete (2026-04-04)

- `SickbayConfig` type with full shape (all fields defined)
- `defineConfig` helper in core, re-exported from CLI via `sickbay/config`
- `loadConfig()` using jiti — resolution, validation, defaults merging (resolves relative paths)
- `sickbay init` generates config file with applicable checks as `true` (JSDoc `@type` annotation, no import required)
- Runners respect `false` / `{ enabled: false }` to skip
- Report metadata: `hasCustomConfig`, `disabledChecks`, `overriddenChecks`
- "Custom config active" notice in CLI output and TUI score panel
- VitePress Configuration Reference page at `/guide/configuration`
- jiti externalized from CLI bundle to avoid Node builtin resolution errors
- knip runner filters `sickbay.config.ts` from unused file false positives
- `sickbay init` skips config loading during baseline scan (`_config: null`)

### Phase B: Threshold Overrides ✅ Complete (2026-04-04)

- Each configurable runner reads its `thresholds` from config instead of hardcoded values
- 12 runners get typed threshold interfaces with local `*Thresholds` types
- `getCheckConfig()` helper + `KNOWN_THRESHOLD_KEYS` map in config.ts
- Unknown threshold keys warn to stderr via centralized validation
- Complexity runner merges user thresholds with `FILE_TYPE_THRESHOLDS` defaults
- `RunOptions.checkConfig` field threads per-check config from runner.ts to each runner
- 15 new tests covering threshold override behavior across all configurable runners

### Phase C: Exclude Paths + Weight Overrides ✅ Complete (2026-04-04)

- Global `config.exclude` + per-check `checkConfig.exclude` merged in runner.ts
- 5 file-scanning runners filter via `createExcludeFilter()` using picomatch
- `normalizeWeights()` merges user overrides with `CATEGORY_WEIGHTS` proportionally
- `calculateOverallScore()` accepts optional custom weights param
- `CATEGORY_WEIGHTS` exported for external use
- 10 new tests covering exclude filtering and weight normalization
- Validation (values > 0) already in place from Phase A

### Phase D: Suppression

- Per-check `suppress` arrays with `SuppressionRule`
- Each runner filters its results against suppression rules before returning
- Suppressed findings tracked in report metadata
- `reason` field required on all suppression rules

### Phase E: Web Config Tab

- `/sickbay-config.json` endpoint on CLI HTTP server
- Read-only Config tab in web dashboard
- Custom badges, default vs override comparison, disabled check dimming
- "Custom configuration active" banner

### Phase F: Config Sync + Monorepo (Future)

- `sickbay init --sync` — appends new checks to existing config without touching existing entries
- Scan-time warning when unlisted checks are detected
- `sickbay init --reset-config` — regenerates config from scratch
- Per-package `sickbay.config.ts` resolution and merge in monorepo mode

---

## Design Decisions Log

Decisions made during the collaborative design session:

| Decision | Rationale |
|---|---|
| `true` / `false` / `CheckConfig` union per check | Matches Vite, ESLint flat config, Nuxt patterns. Concise DX. |
| Suppression inline on check (`checks.secrets.suppress`) | Keeps all config for a check in one place. No hunting across top-level keys. |
| Per-file-type granular complexity thresholds | Explicit > magic. No flat `maxLines` multiplier ambiguity. |
| Generated config lists only check names as `true`/`false` | Lean out-of-box. Threshold/suppress/weight docs live in VitePress. Progressive disclosure. |
| Partial weight overrides with proportional normalization | Users express relative priority. Prevents invalid sums. Friendly DX. |
| Global + per-check exclude (type ships in Phase A, per-check wired in Phase C) | Covers 90% case immediately. Granular control available when needed. |
| Full schema in Phase A, phased implementation | Type stability from day one. No config format churn for early adopters. |
| `sickbay init` idempotent — never overwrites existing config | Config is the user's file. Hands off. |
| `sickbay init --sync` for adding new checks (Phase F) | Solves discoverability gap when Sickbay adds runners. Paired with scan-time notification. |
| Score multipliers excluded from threshold config | Implementation details, not user-facing knobs. Confusing to reason about. |
| `reason` required on suppression rules | Prevents suppress-and-forget rot. Shows in reports. |
