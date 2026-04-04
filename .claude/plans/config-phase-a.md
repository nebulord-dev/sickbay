# Sickbay Config Phase A — Config Loading + Enable/Disable

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `sickbay.config.ts` system — typed config file with `defineConfig` helper, config loading via jiti, check enable/disable, `sickbay init` config generation, and "custom config active" notices in CLI/TUI output.

**Architecture:** New `packages/core/src/config.ts` module handles types, loading (jiti), validation, and merging. `runner.ts` calls `loadConfig()` at scan start and filters disabled checks. CLI re-exports `defineConfig` via a separate `sickbay/config` entry point. `sickbay init` generates a framework-aware config file.

**Tech Stack:** TypeScript, jiti (runtime TS execution), picomatch (glob matching for future phases), Vitest (tests), Ink (CLI notices)

**Spec:** `.claude/docs/sickbay-config-spec.md`

**Deviation from spec:** The spec says `import { defineConfig } from 'sickbay'`, but the CLI's `index.ts` is a bin script that calls `program.parse()` — importing it triggers CLI execution. Instead, we use `import { defineConfig } from 'sickbay/config'` via a separate entry point. This follows established patterns (`next/server`, `vite/client`).

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `packages/core/src/config.ts` | `SickbayConfig` type, `CheckConfig`, `SuppressionRule`, `Category`, `defineConfig()`, `loadConfig()`, `validateConfig()`, `resolveCheckConfig()` |
| `packages/core/src/config.test.ts` | Tests for config loading, validation, merging, edge cases |
| `apps/cli/src/config.ts` | Re-export entry point: `export { defineConfig } from '@nebulord/sickbay-core'` + types |
| `apps/cli/src/commands/init.test.ts` | Tests for config generation in `sickbay init` |
| `apps/docs/guide/configuration.md` | VitePress Configuration Reference page |

### Modified Files

| File | Changes |
|---|---|
| `packages/core/src/types.ts` | Add `config?` field to `SickbayReport` and `MonorepoReport` |
| `packages/core/src/runner.ts` | Call `loadConfig()`, filter disabled checks, attach config metadata to report |
| `packages/core/src/index.ts` | Export `defineConfig`, `loadConfig`, `SickbayConfig`, `CheckConfig`, `SuppressionRule`, `Category` |
| `packages/core/package.json` | Add `jiti` dependency |
| `apps/cli/src/index.ts` | No changes needed (config loaded inside core) |
| `apps/cli/src/commands/init.ts` | Generate `sickbay.config.ts` when missing, using `detectContext()` for framework-aware checks |
| `apps/cli/src/components/Summary.tsx` | Show "Custom config active" notice when `report.config?.hasCustomConfig` |
| `apps/cli/src/components/tui/ScorePanel.tsx` | Show "Custom config active" badge |
| `apps/cli/package.json` | Add `./config` export, update tsup entry |
| `apps/cli/tsup.config.ts` | Add `src/config.ts` as second entry point |
| `apps/docs/.vitepress/config.ts` | Add Configuration Reference to sidebar |

---

## Task 1: Core Config Types + `defineConfig`

**Files:**
- Create: `packages/core/src/config.ts`
- Create: `packages/core/src/config.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write test for `defineConfig` identity function**

```ts
// packages/core/src/config.test.ts
import { describe, it, expect } from 'vitest';
import { defineConfig } from './config.js';

describe('defineConfig', () => {
  it('returns the config object unchanged', () => {
    const config = {
      checks: { knip: true, 'react-perf': false },
    };
    expect(defineConfig(config)).toBe(config);
  });

  it('accepts an empty config', () => {
    expect(defineConfig({})).toEqual({});
  });

  it('accepts full config shape', () => {
    const config = {
      checks: {
        complexity: {
          thresholds: { 'react-component': { warn: 400, critical: 600 } },
          exclude: ['src/legacy/**'],
          suppress: [{ path: 'src/Big.tsx', reason: 'migration planned' }],
        },
        knip: false,
      },
      exclude: ['src/generated/**'],
      weights: { security: 0.5 },
    };
    expect(defineConfig(config)).toBe(config);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm vitest run src/config.test.ts`
Expected: FAIL — `./config.js` does not exist

- [ ] **Step 3: Write the types and `defineConfig`**

```ts
// packages/core/src/config.ts
import type { CheckResult } from './types.js';

/**
 * Scoring categories. Excludes 'unknown-category' from CheckResult['category']
 * because unknown categories have no configurable weight (they fall back to 0.1 in scoring.ts).
 */
export type Category = 'dependencies' | 'performance' | 'code-quality' | 'security' | 'git';

export interface SickbayConfig {
  checks?: Record<string, boolean | CheckConfig>;
  exclude?: string[];
  weights?: Partial<Record<Category, number>>;
}

export interface CheckConfig {
  enabled?: boolean;
  thresholds?: Record<string, unknown>;
  exclude?: string[];
  suppress?: SuppressionRule[];
}

export interface SuppressionRule {
  path?: string;
  match?: string;
  reason: string;
}

export interface ResolvedConfigMeta {
  hasCustomConfig: boolean;
  overriddenChecks: string[];
  disabledChecks: string[];
}

export function defineConfig(config: SickbayConfig): SickbayConfig {
  return config;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm vitest run src/config.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Export from core index**

Add to `packages/core/src/index.ts`:

```ts
export { defineConfig, loadConfig } from './config.js';
export type {
  SickbayConfig,
  CheckConfig,
  SuppressionRule,
  Category,
  ResolvedConfigMeta,
} from './config.js';
```

Export only `defineConfig` and types now. The `loadConfig`, `isCheckDisabled`, and `resolveConfigMeta` exports will be added in their respective tasks (Tasks 2 and 3).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/config.ts packages/core/src/config.test.ts packages/core/src/index.ts
git commit -m "feat(core): add SickbayConfig types and defineConfig helper (KAN-99)"
```

---

## Task 2: Config Loading with jiti

**Files:**
- Modify: `packages/core/src/config.ts`
- Modify: `packages/core/src/config.test.ts`
- Modify: `packages/core/package.json`

- [ ] **Step 1: Add jiti dependency**

```bash
cd packages/core && pnpm add jiti
```

- [ ] **Step 2: Write tests for `loadConfig`**

Add to `packages/core/src/config.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `sickbay-config-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns null when no config file exists', async () => {
    const result = await loadConfig(tempDir);
    expect(result).toBeNull();
  });

  it('loads sickbay.config.ts', async () => {
    writeFileSync(
      join(tempDir, 'sickbay.config.ts'),
      `export default { checks: { knip: false } };`,
    );
    const result = await loadConfig(tempDir);
    expect(result).toEqual({ checks: { knip: false } });
  });

  it('loads sickbay.config.js as fallback', async () => {
    writeFileSync(
      join(tempDir, 'sickbay.config.js'),
      `export default { checks: { eslint: false } };`,
    );
    const result = await loadConfig(tempDir);
    expect(result).toEqual({ checks: { eslint: false } });
  });

  it('prefers .ts over .js when both exist', async () => {
    writeFileSync(
      join(tempDir, 'sickbay.config.ts'),
      `export default { checks: { knip: false } };`,
    );
    writeFileSync(
      join(tempDir, 'sickbay.config.js'),
      `export default { checks: { eslint: false } };`,
    );
    const result = await loadConfig(tempDir);
    expect(result).toEqual({ checks: { knip: false } });
  });

  it('returns null and warns on syntax error', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    writeFileSync(join(tempDir, 'sickbay.config.ts'), `export default {{{`);
    const result = await loadConfig(tempDir);
    expect(result).toBeNull();
    expect(stderrSpy).toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it('handles default export from defineConfig', async () => {
    writeFileSync(
      join(tempDir, 'sickbay.config.ts'),
      `
        function defineConfig(c: any) { return c; }
        export default defineConfig({ checks: { git: false } });
      `,
    );
    const result = await loadConfig(tempDir);
    expect(result).toEqual({ checks: { git: false } });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/core && pnpm vitest run src/config.test.ts`
Expected: FAIL — `loadConfig` is not exported

- [ ] **Step 4: Implement `loadConfig`**

Add to `packages/core/src/config.ts`:

```ts
import { existsSync } from 'fs';
import { join } from 'path';

const CONFIG_FILES = ['sickbay.config.ts', 'sickbay.config.js', 'sickbay.config.mjs'];

export async function loadConfig(projectPath: string): Promise<SickbayConfig | null> {
  const configPath = CONFIG_FILES
    .map((f) => join(projectPath, f))
    .find((p) => existsSync(p));

  if (!configPath) return null;

  try {
    const { createJiti } = await import('jiti');
    const jiti = createJiti(projectPath);
    const mod = await jiti.import(configPath);
    const config = (mod as Record<string, unknown>).default ?? mod;
    return config as SickbayConfig;
  } catch (err) {
    process.stderr.write(
      `Warning: Failed to load ${configPath}: ${err instanceof Error ? err.message : err}\n` +
      `Falling back to defaults.\n`,
    );
    return null;
  }
}
```

- [ ] **Step 5: Update core index.ts to export `loadConfig`**

Add `loadConfig` to the export line from `./config.js` in `packages/core/src/index.ts`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/core && pnpm vitest run src/config.test.ts`
Expected: PASS (all tests including new loadConfig tests)

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/config.ts packages/core/src/config.test.ts packages/core/src/index.ts packages/core/package.json pnpm-lock.yaml
git commit -m "feat(core): add loadConfig with jiti for runtime TS config loading (KAN-99)"
```

---

## Task 3: Config Validation + Check Resolution

**Files:**
- Modify: `packages/core/src/config.ts`
- Modify: `packages/core/src/config.test.ts`

- [ ] **Step 1: Write tests for `isCheckDisabled` and `resolveConfigMeta`**

Add to `packages/core/src/config.test.ts`:

```ts
import { isCheckDisabled, resolveConfigMeta } from './config.js';

describe('isCheckDisabled', () => {
  it('returns false when config is null', () => {
    expect(isCheckDisabled(null, 'knip')).toBe(false);
  });

  it('returns false when check is not in config', () => {
    expect(isCheckDisabled({ checks: {} }, 'knip')).toBe(false);
  });

  it('returns false when check is true', () => {
    expect(isCheckDisabled({ checks: { knip: true } }, 'knip')).toBe(false);
  });

  it('returns true when check is false', () => {
    expect(isCheckDisabled({ checks: { knip: false } }, 'knip')).toBe(true);
  });

  it('returns true when check has enabled: false', () => {
    expect(isCheckDisabled({ checks: { knip: { enabled: false } } }, 'knip')).toBe(true);
  });

  it('returns false when check is an object without enabled: false', () => {
    expect(isCheckDisabled(
      { checks: { complexity: { thresholds: { general: { warn: 500, critical: 800 } } } } },
      'complexity',
    )).toBe(false);
  });
});

describe('resolveConfigMeta', () => {
  it('returns no-config meta when config is null', () => {
    expect(resolveConfigMeta(null)).toEqual({
      hasCustomConfig: false,
      overriddenChecks: [],
      disabledChecks: [],
    });
  });

  it('detects disabled checks', () => {
    const meta = resolveConfigMeta({
      checks: { knip: false, eslint: true, 'react-perf': { enabled: false } },
    });
    expect(meta.hasCustomConfig).toBe(true);
    expect(meta.disabledChecks).toEqual(['knip', 'react-perf']);
  });

  it('detects overridden checks', () => {
    const meta = resolveConfigMeta({
      checks: {
        complexity: { thresholds: { general: { warn: 500, critical: 800 } } },
        knip: true,
      },
    });
    expect(meta.overriddenChecks).toEqual(['complexity']);
  });

  it('detects custom weights as hasCustomConfig', () => {
    const meta = resolveConfigMeta({ weights: { security: 0.5 } });
    expect(meta.hasCustomConfig).toBe(true);
  });

  it('detects global exclude as hasCustomConfig', () => {
    const meta = resolveConfigMeta({ exclude: ['src/generated/**'] });
    expect(meta.hasCustomConfig).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm vitest run src/config.test.ts`
Expected: FAIL — functions not exported

- [ ] **Step 3: Implement `isCheckDisabled` and `resolveConfigMeta`**

Add to `packages/core/src/config.ts`:

```ts
export function isCheckDisabled(config: SickbayConfig | null, checkId: string): boolean {
  if (!config?.checks) return false;
  const entry = config.checks[checkId];
  if (entry === false) return true;
  if (typeof entry === 'object' && entry.enabled === false) return true;
  return false;
}

export function resolveConfigMeta(config: SickbayConfig | null): ResolvedConfigMeta {
  if (!config) {
    return { hasCustomConfig: false, overriddenChecks: [], disabledChecks: [] };
  }

  const disabledChecks: string[] = [];
  const overriddenChecks: string[] = [];

  if (config.checks) {
    for (const [id, entry] of Object.entries(config.checks)) {
      if (entry === false || (typeof entry === 'object' && entry.enabled === false)) {
        disabledChecks.push(id);
      } else if (typeof entry === 'object') {
        // Has thresholds, exclude, or suppress — it's overridden
        if (entry.thresholds || entry.exclude?.length || entry.suppress?.length) {
          overriddenChecks.push(id);
        }
      }
    }
  }

  const hasCustomConfig =
    disabledChecks.length > 0 ||
    overriddenChecks.length > 0 ||
    (config.weights !== undefined && Object.keys(config.weights).length > 0) ||
    (config.exclude !== undefined && config.exclude.length > 0);

  return { hasCustomConfig, overriddenChecks, disabledChecks };
}
```

- [ ] **Step 4: Write tests for `validateConfig`**

```ts
describe('validateConfig', () => {
  it('warns on unknown check IDs', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const knownCheckIds = ['knip', 'eslint', 'complexity'];
    validateConfig({ checks: { 'nonexistent-check': true } }, knownCheckIds);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent-check'));
    stderrSpy.mockRestore();
  });

  it('throws on weight values <= 0', () => {
    expect(() => validateConfig({ weights: { security: -1 } }, [])).toThrow();
    expect(() => validateConfig({ weights: { security: 0 } }, [])).toThrow();
  });

  it('does not warn on valid check IDs', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    validateConfig({ checks: { knip: false } }, ['knip']);
    expect(stderrSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
  });
});
```

- [ ] **Step 5: Implement `validateConfig`**

Add to `packages/core/src/config.ts`:

```ts
export function validateConfig(config: SickbayConfig, knownCheckIds: string[]): void {
  // Validate weight values
  if (config.weights) {
    for (const [category, value] of Object.entries(config.weights)) {
      if (value !== undefined && value <= 0) {
        throw new Error(`Invalid weight for category "${category}": must be > 0, got ${value}`);
      }
    }
  }

  // Warn on unknown check IDs
  if (config.checks) {
    for (const checkId of Object.keys(config.checks)) {
      if (!knownCheckIds.includes(checkId)) {
        process.stderr.write(
          `Warning: Unknown check "${checkId}" in sickbay.config — it will be ignored.\n`,
        );
      }
    }
  }
}
```

- [ ] **Step 6: Export the new functions from index.ts**

Add `isCheckDisabled`, `resolveConfigMeta`, and `validateConfig` to the config exports in `packages/core/src/index.ts`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd packages/core && pnpm vitest run src/config.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/config.ts packages/core/src/config.test.ts packages/core/src/index.ts
git commit -m "feat(core): add isCheckDisabled, resolveConfigMeta, and validateConfig (KAN-99)"
```

---

## Task 4: Wire Config into Runner Pipeline

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/runner.ts`
- Modify: `packages/core/src/runner.test.ts`

- [ ] **Step 1: Add `config` field to report types**

In `packages/core/src/types.ts`, add to `SickbayReport`:

```ts
config?: {
  hasCustomConfig: boolean;
  overriddenChecks: string[];
  disabledChecks: string[];
};
```

Add the same field to `MonorepoReport`.

- [ ] **Step 2: Write test for config-disabled checks being filtered**

The existing `runner.test.ts` mocks ALL dependencies with `vi.mock`. Follow the same pattern — mock `./config.js`:

```ts
// Add near the top of runner.test.ts, alongside the other vi.mock calls:
vi.mock('./config.js', () => ({
  loadConfig: vi.fn(),
  isCheckDisabled: vi.fn(),
  resolveConfigMeta: vi.fn(),
}));

import { loadConfig, isCheckDisabled, resolveConfigMeta } from './config.js';
```

Then add a new describe block:

```ts
describe('config integration', () => {
  it('filters out checks disabled by config', async () => {
    vi.mocked(loadConfig).mockResolvedValue({ checks: { knip: false } });
    vi.mocked(isCheckDisabled).mockImplementation((_config, id) => id === 'knip');
    vi.mocked(resolveConfigMeta).mockReturnValue({
      hasCustomConfig: true,
      overriddenChecks: [],
      disabledChecks: ['knip'],
    });

    const report = await runSickbay({ projectPath: '/test' });
    expect(allMockRunners.knip.run).not.toHaveBeenCalled();
    expect(report.config?.hasCustomConfig).toBe(true);
    expect(report.config?.disabledChecks).toEqual(['knip']);
  });

  it('attaches config metadata to report when custom config active', async () => {
    vi.mocked(loadConfig).mockResolvedValue({ checks: { eslint: false } });
    vi.mocked(isCheckDisabled).mockImplementation((_config, id) => id === 'eslint');
    vi.mocked(resolveConfigMeta).mockReturnValue({
      hasCustomConfig: true,
      overriddenChecks: [],
      disabledChecks: ['eslint'],
    });

    const report = await runSickbay({ projectPath: '/test' });
    expect(report.config).toBeDefined();
    expect(report.config!.disabledChecks).toContain('eslint');
  });

  it('omits config field when no custom config', async () => {
    vi.mocked(loadConfig).mockResolvedValue(null);
    vi.mocked(isCheckDisabled).mockReturnValue(false);
    vi.mocked(resolveConfigMeta).mockReturnValue({
      hasCustomConfig: false,
      overriddenChecks: [],
      disabledChecks: [],
    });

    const report = await runSickbay({ projectPath: '/test' });
    expect(report.config).toBeUndefined();
  });
});
```

Reset config mocks in the existing `beforeEach`:
```ts
vi.mocked(loadConfig).mockResolvedValue(null);
vi.mocked(isCheckDisabled).mockReturnValue(false);
vi.mocked(resolveConfigMeta).mockReturnValue({
  hasCustomConfig: false,
  overriddenChecks: [],
  disabledChecks: [],
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/core && pnpm vitest run src/runner.test.ts`
Expected: FAIL — config not wired in yet

- [ ] **Step 4: Wire config into `runSickbay()`**

In `packages/core/src/runner.ts`, modify `runSickbay()`:

```ts
import { loadConfig, isCheckDisabled, resolveConfigMeta } from './config.js';

export async function runSickbay(options: RunnerOptions = {}): Promise<SickbayReport> {
  const projectPath = options.projectPath ?? process.cwd();
  const projectInfo = await detectProject(projectPath);
  const context = await detectContext(projectPath);

  // Load config
  const config = await loadConfig(projectPath);
  const configMeta = resolveConfigMeta(config);

  const candidateRunners = options.checks
    ? ALL_RUNNERS.filter((r) => options.checks!.includes(r.name))
    : ALL_RUNNERS;

  // Filter by context first, then by config
  const runners = candidateRunners
    .filter((r) => r.isApplicableToContext(context))
    .filter((r) => !isCheckDisabled(config, r.name));

  options.onRunnersReady?.(runners.map((r) => r.name));

  // ... rest of existing logic unchanged ...

  return {
    timestamp: new Date().toISOString(),
    projectPath,
    projectInfo,
    checks,
    overallScore,
    summary,
    quote: options.quotes !== false ? getQuote(overallScore) : undefined,
    config: configMeta.hasCustomConfig ? configMeta : undefined,
  };
}
```

Also wire config into `runSickbayMonorepo()` — load config once at root, pass `configMeta` through:

```ts
export async function runSickbayMonorepo(options: RunnerOptions = {}): Promise<MonorepoReport> {
  const rootPath = options.projectPath ?? process.cwd();
  const config = await loadConfig(rootPath);
  const configMeta = resolveConfigMeta(config);

  // ... existing logic ...

  return {
    // ... existing fields ...
    config: configMeta.hasCustomConfig ? configMeta : undefined,
  };
}
```

**Monorepo config propagation:** The root config is loaded once in `runSickbayMonorepo()`. To avoid each per-package `runSickbay()` call re-loading (and finding nothing), add a `_config` internal option to `RunnerOptions`:

```ts
export interface RunnerOptions {
  // ... existing fields ...
  /** Pre-loaded config — used internally by runSickbayMonorepo to avoid re-loading per package */
  _config?: SickbayConfig | null;
}
```

In `runSickbay()`, check for `options._config` before calling `loadConfig`:

```ts
const config = options._config !== undefined ? options._config : await loadConfig(projectPath);
```

In `runSickbayMonorepo()`, pass the root config through:

```ts
const config = await loadConfig(rootPath);
// ...
const report = await runSickbay({ ...options, projectPath: pkgPath, _config: config });
```

This ensures the root config's disabled checks apply to every package scan.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/core && pnpm vitest run src/runner.test.ts`
Expected: PASS

- [ ] **Step 6: Run full core test suite**

Run: `cd packages/core && pnpm test`
Expected: All tests pass. If snapshot tests break due to the new `config` field on reports, update them.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/runner.ts packages/core/src/runner.test.ts
git commit -m "feat(core): wire config loading into runner pipeline, filter disabled checks (KAN-99)"
```

---

## Task 5: CLI `defineConfig` Re-export

**Files:**
- Create: `apps/cli/src/config.ts`
- Modify: `apps/cli/package.json`
- Modify: `apps/cli/tsup.config.ts`

- [ ] **Step 1: Create CLI config entry point**

```ts
// apps/cli/src/config.ts
export { defineConfig } from '@nebulord/sickbay-core';
export type { SickbayConfig, CheckConfig, SuppressionRule, Category } from '@nebulord/sickbay-core';
```

- [ ] **Step 2: Add second tsup entry**

In `apps/cli/tsup.config.ts`, change entry from `['src/index.ts']` to `['src/index.ts', 'src/config.ts']`.

- [ ] **Step 3: Add `./config` export to package.json**

In `apps/cli/package.json`, update exports:

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
  },
  "./config": {
    "types": "./dist/config.d.ts",
    "import": "./dist/config.js"
  }
}
```

- [ ] **Step 4: Build and verify**

Run: `pnpm build`
Expected: Build succeeds. `apps/cli/dist/config.js` and `apps/cli/dist/config.d.ts` exist.

**Important:** The CLI's `tsup.config.ts` has `noExternal: ['@nebulord/sickbay-core']`, which inlines core into the CLI bundle. Since `loadConfig()` uses `await import('jiti')` (dynamic import), tsup won't try to bundle jiti — it stays as a runtime import. Verify this works at runtime in Task 9 smoke tests. If the build fails or jiti doesn't resolve at runtime, add `external: ['jiti']` to the CLI's tsup config.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/config.ts apps/cli/package.json apps/cli/tsup.config.ts
git commit -m "feat(cli): add sickbay/config entry point for defineConfig re-export (KAN-99)"
```

---

## Task 6: Update `sickbay init` to Generate Config File

**Files:**
- Modify: `apps/cli/src/commands/init.ts`
- Create: `apps/cli/src/commands/init.test.ts` (or add to existing)

- [ ] **Step 1: Write test for config generation**

```ts
// apps/cli/src/commands/init.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// We'll test the generateConfigFile function directly
import { generateConfigFile } from './init.js';

describe('generateConfigFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `sickbay-init-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    // Create a minimal package.json so detectContext works
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      name: 'test-app',
      dependencies: { react: '^19.0.0' },
    }));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates config file when none exists', async () => {
    await generateConfigFile(tempDir);
    const configPath = join(tempDir, 'sickbay.config.ts');
    expect(existsSync(configPath)).toBe(true);
    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain("import { defineConfig } from 'sickbay/config'");
    expect(content).toContain('knip: true');
  });

  it('skips generation when config already exists', async () => {
    const configPath = join(tempDir, 'sickbay.config.ts');
    writeFileSync(configPath, 'existing config');
    await generateConfigFile(tempDir);
    expect(readFileSync(configPath, 'utf-8')).toBe('existing config');
  });

  it('includes framework-specific checks for React projects', async () => {
    await generateConfigFile(tempDir);
    const content = readFileSync(join(tempDir, 'sickbay.config.ts'), 'utf-8');
    expect(content).toContain("'react-perf': true");
  });

  it('excludes framework-specific checks for non-matching frameworks', async () => {
    // Node-only project
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      name: 'test-api',
      dependencies: { express: '^5.0.0' },
    }));
    await generateConfigFile(tempDir);
    const content = readFileSync(join(tempDir, 'sickbay.config.ts'), 'utf-8');
    expect(content).not.toContain("'react-perf'");
    expect(content).toContain("'node-security': true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/cli && pnpm vitest run src/commands/init.test.ts`
Expected: FAIL — `generateConfigFile` not exported

- [ ] **Step 3: Implement config generation**

Extract a `generateConfigFile` function in `apps/cli/src/commands/init.ts`. The function:

1. Checks if `sickbay.config.ts` exists — if so, prints skip message and returns
2. Calls `detectContext(projectPath)` to get frameworks/runtime
3. Builds check list by iterating `ALL_RUNNERS` (imported from core) filtered by `isApplicableToContext(context)`
4. Groups checks by category
5. Writes the config file

The generated config template:

```ts
const template = `// Threshold overrides, suppressions, and more:
// https://nebulord-dev.github.io/sickbay/guide/configuration
import { defineConfig } from 'sickbay/config'

export default defineConfig({
  checks: {
${checkLines}
  },
})
`;
```

Where `checkLines` is built by grouping runners by category with comment headers.

To get the list of runner names, categories, and applicability, add `getAvailableChecks()` to `packages/core/src/runner.ts` and export from `index.ts`:

```ts
// packages/core/src/runner.ts
export function getAvailableChecks(context?: ProjectContext): { name: string; category: string }[] {
  const runners = context
    ? ALL_RUNNERS.filter((r) => r.isApplicableToContext(context))
    : ALL_RUNNERS;
  return runners.map((r) => ({ name: r.name, category: r.category }));
}
```

This accepts an optional `ProjectContext` to filter by framework/runtime. When called from `generateConfigFile`, pass the detected context so only applicable checks appear in the generated config. Add a test for this in `runner.test.ts`.

- [ ] **Step 4: Update `initSickbay` to call `generateConfigFile`**

At the top of the existing `initSickbay` function, before scaffolding `.sickbay/`, call:

```ts
await generateConfigFile(projectPath);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/cli && pnpm vitest run src/commands/init.test.ts`
Expected: PASS

- [ ] **Step 6: Run full CLI test suite**

Run: `cd apps/cli && pnpm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add apps/cli/src/commands/init.ts apps/cli/src/commands/init.test.ts packages/core/src/runner.ts
git commit -m "feat(cli): generate sickbay.config.ts from sickbay init with framework-aware checks (KAN-99)"
```

---

## Task 7: "Custom Config Active" Notices in CLI + TUI

**Files:**
- Modify: `apps/cli/src/components/Summary.tsx`
- Modify: `apps/cli/src/components/Summary.test.tsx`
- Modify: `apps/cli/src/components/tui/ScorePanel.tsx`
- Modify: `apps/cli/src/components/tui/ScorePanel.test.tsx`

- [ ] **Step 1: Write test for Summary config notice**

Add to `apps/cli/src/components/Summary.test.tsx`:

```ts
it('shows custom config notice when config is active', () => {
  const report = {
    ...baseReport,
    config: { hasCustomConfig: true, overriddenChecks: [], disabledChecks: ['knip'] },
  };
  const { lastFrame } = render(<Summary report={report} />);
  expect(lastFrame()).toContain('Custom config active');
});

it('does not show config notice when no custom config', () => {
  const { lastFrame } = render(<Summary report={baseReport} />);
  expect(lastFrame()).not.toContain('Custom config active');
});
```

- [ ] **Step 2: Write test for ScorePanel config badge**

Add to `apps/cli/src/components/tui/ScorePanel.test.tsx`:

```ts
it('shows custom config badge when config is active', () => {
  const report = {
    ...baseReport,
    config: { hasCustomConfig: true, overriddenChecks: [], disabledChecks: ['knip'] },
  };
  const { lastFrame } = render(<ScorePanel report={report} previousScore={null} animate={false} />);
  expect(lastFrame()).toContain('Custom config');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/cli && pnpm vitest run src/components/Summary.test.tsx src/components/tui/ScorePanel.test.tsx`
Expected: FAIL — no config notice rendered

- [ ] **Step 4: Add config notice to Summary**

In `apps/cli/src/components/Summary.tsx`, after the quote block, add:

```tsx
{report.config?.hasCustomConfig && (
  <Box marginTop={1}>
    <Text dimColor italic>
      ⚙ Custom config active
      {report.config.disabledChecks.length > 0 &&
        ` (${report.config.disabledChecks.length} check${report.config.disabledChecks.length === 1 ? '' : 's'} disabled)`}
    </Text>
  </Box>
)}
```

- [ ] **Step 5: Add config badge to ScorePanel**

In `apps/cli/src/components/tui/ScorePanel.tsx`, after the quote block, add:

```tsx
{report.config?.hasCustomConfig && (
  <Text dimColor italic>⚙ Custom config</Text>
)}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/cli && pnpm vitest run src/components/Summary.test.tsx src/components/tui/ScorePanel.test.tsx`
Expected: PASS

- [ ] **Step 7: Run full CLI test suite**

Run: `cd apps/cli && pnpm test`
Expected: All pass. Snapshot tests may need updating if Summary/ScorePanel snapshots exist.

- [ ] **Step 8: Commit**

```bash
git add apps/cli/src/components/Summary.tsx apps/cli/src/components/Summary.test.tsx apps/cli/src/components/tui/ScorePanel.tsx apps/cli/src/components/tui/ScorePanel.test.tsx
git commit -m "feat(cli): show custom config active notices in Summary and TUI ScorePanel (KAN-99)"
```

---

## Task 8: VitePress Configuration Reference Page `[Collab]`

**Files:**
- Create: `apps/docs/guide/configuration.md`
- Modify: `apps/docs/.vitepress/config.ts`

- [ ] **Step 1: Create the Configuration Reference page**

Create `apps/docs/guide/configuration.md` with:

- Getting started: `sickbay init` generates the config, `import { defineConfig } from 'sickbay/config'`
- Enable/disable checks: `true`/`false` examples
- Threshold overrides reference: every configurable runner with its threshold shape and defaults (from the spec)
- Category weight overrides: shape + normalization explanation
- Global and per-check exclude: glob patterns
- Suppression rules: per-check suppress with path/match/reason
- Full example config showing multiple features

- [ ] **Step 2: Add to VitePress sidebar**

In `apps/docs/.vitepress/config.ts`, add `{ text: 'Configuration', link: '/guide/configuration' }` to the Guide sidebar section.

- [ ] **Step 3: Build docs to verify**

Run: `cd apps/docs && pnpm run build` (or `pnpm run dev` to preview)
Expected: Docs build with the new Configuration page accessible

- [ ] **Step 4: Commit**

```bash
git add apps/docs/guide/configuration.md apps/docs/.vitepress/config.ts
git commit -m "docs: add Configuration Reference page to VitePress site (KAN-99)"
```

---

## Task 9: Build, Integration Test, Final Verification

**Files:** None new — verification only

- [ ] **Step 1: Full build**

Run: `pnpm build`
Expected: All packages build successfully

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass across core, cli, web

- [ ] **Step 3: Run snapshot regression tests**

Run: `pnpm test:snapshots`
Expected: Pass. If snapshots break due to the new `config` field, update them with `pnpm test:snapshots -- -u`.

- [ ] **Step 4: Manual smoke test — no config**

Run: `node apps/cli/dist/index.js --path fixtures/packages/react-app`
Expected: Runs normally, no "Custom config active" notice, all checks run as before.

- [ ] **Step 5: Manual smoke test — with config**

Create `fixtures/packages/react-app/sickbay.config.ts`:
```ts
import { defineConfig } from 'sickbay/config'
export default defineConfig({
  checks: { jscpd: false },
})
```

Run: `node apps/cli/dist/index.js --path fixtures/packages/react-app`
Expected: "Custom config active (1 check disabled)" in output, jscpd check does not appear.

Clean up: remove the test config file.

- [ ] **Step 6: Manual smoke test — `sickbay init`**

```bash
mkdir /tmp/sickbay-init-test && cd /tmp/sickbay-init-test
echo '{"name":"test","dependencies":{"react":"^19.0.0"}}' > package.json
node ~/Desktop/nebulord/sickbay/apps/cli/dist/index.js init --path .
```

Expected: `sickbay.config.ts` generated with React-applicable checks, `.sickbay/` folder created.

Clean up: `rm -rf /tmp/sickbay-init-test`

- [ ] **Step 7: Monorepo-architect review**

Run the monorepo-architect agent to verify no boundary violations were introduced (core types not leaking into web, CLI exports correct, etc.).

- [ ] **Step 8: Final commit if any fixups needed**

```bash
git add -A && git commit -m "chore: fixups from integration testing (KAN-99)"
```
