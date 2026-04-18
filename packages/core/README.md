# sickbay-core

The analysis engine for Sickbay. Orchestrates all health checks in parallel and returns a structured `SickbayReport`.

## Overview

`sickbay-core` exposes a single `runSickbay()` function that:

1. Detects project metadata (framework, package manager, tooling)
2. Runs all enabled checks concurrently via `Promise.allSettled`
3. Calculates weighted scores per category
4. Returns a `SickbayReport` with issues and fix suggestions

## API

### `runSickbay(options)`

```typescript
import { runSickbay } from 'sickbay-core';

const report = await runSickbay({
  projectPath: '/path/to/project',
  checks: ['knip', 'npm-audit'], // optional — runs all if omitted
  verbose: false,
  onCheckStart: (name) => console.log(`Starting ${name}`),
  onCheckComplete: (result) => console.log(`Done: ${result.id}`),
});
```

**Options:**

| Option            | Type                            | Description                               |
| ----------------- | ------------------------------- | ----------------------------------------- |
| `projectPath`     | `string`                        | Absolute path to the project root         |
| `checks`          | `string[]`                      | Subset of check IDs to run (default: all) |
| `verbose`         | `boolean`                       | Pass through tool output                  |
| `onCheckStart`    | `(name: string) => void`        | Called when a check begins                |
| `onCheckComplete` | `(result: CheckResult) => void` | Called when a check finishes              |

### Key Types

```typescript
interface SickbayReport {
  timestamp: string;
  projectPath: string;
  projectInfo: ProjectInfo;
  checks: CheckResult[];
  overallScore: number;
  summary: { critical: number; warnings: number; info: number };
}

interface CheckResult {
  id: string;
  category: 'dependencies' | 'performance' | 'code-quality' | 'security' | 'git';
  name: string;
  score: number; // 0–100
  status: 'pass' | 'warning' | 'fail' | 'skipped';
  issues: Issue[];
  toolsUsed: string[];
  duration: number; // milliseconds
  metadata?: Record<string, unknown>;
}

interface Issue {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  file?: string;
  fix?: { description: string; command: string };
  reportedBy: string[];
}
```

## Checks

Each check lives in `src/integrations/` and extends `BaseRunner`:

| File                     | Check ID              | External tool             |
| ------------------------ | --------------------- | ------------------------- |
| `knip.ts`                | `knip`                | `knip`                    |
| `depcheck.ts`            | `depcheck`            | `depcheck`                |
| `npm-check-updates.ts`   | `npm-check-updates`   | `ncu`                     |
| `npm-audit.ts`           | `npm-audit`           | `npm`                     |
| `license-checker.ts`     | `license-checker`     | `license-checker`         |
| `madge.ts`               | `madge`               | `madge`                   |
| `jscpd.ts`               | `jscpd`               | `jscpd`                   |
| `coverage.ts`            | `coverage`            | _(auto-runs vitest/jest)_ |
| `source-map-explorer.ts` | `source-map-explorer` | `source-map-explorer`     |
| `git.ts`                 | `git`                 | `git`                     |

### Adding a new check

1. Create `src/integrations/my-check.ts` extending `BaseRunner`
2. Implement `async run(projectPath): Promise<CheckResult>`
3. Optionally implement `async isApplicable(projectPath): Promise<boolean>`
4. Register it in `src/runner.ts` in the `ALL_RUNNERS` array

```typescript
export class MyCheckRunner extends BaseRunner {
  name = 'my-check';
  category = 'code-quality' as const;

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    // ... run tool, parse output, build issues array
    return {
      id: 'my-check',
      category: this.category,
      name: 'My Check',
      score: 100,
      status: 'pass',
      issues: [],
      toolsUsed: ['my-tool'],
      duration: elapsed(),
    };
  }
}
```

## Scoring Weights

```typescript
const CATEGORY_WEIGHTS = {
  security: 0.3,
  dependencies: 0.25,
  'code-quality': 0.25,
  performance: 0.15,
  git: 0.05,
};
```

## Build

```bash
pnpm build   # tsdown → dist/
pnpm dev     # watch mode
```
