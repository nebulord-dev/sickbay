# Contributing to Vitals

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 8 — `npm install -g pnpm`
- **Git**

---

## Local Setup

```bash
git clone <repo-url>
cd vitals

# Install all workspace dependencies
pnpm install

# Build everything (core → cli → web, in dependency order)
pnpm build

# Link the CLI globally so you can run `vitals` anywhere
cd packages/cli && pnpm link --global
```

---

## Project Orientation

This is a pnpm workspace monorepo with three packages that have a strict build order:

```
@vitals/core   — analysis engine (all check runners, scoring, types)
     ↓
@vitals/cli    — terminal UI (Ink + Commander), depends on core
     ↓
@vitals/web    — web dashboard (Vite + React), served by cli
```

Always build `core` before `cli`. `turbo build` handles this automatically.

The `fixtures/` directory is a separate pnpm workspace used for testing — it is **not** part of the build pipeline. See [Test Fixtures](#test-fixtures) below.

### Key files to know

| File | What it does |
|------|-------------|
| `packages/core/src/types.ts` | All shared TypeScript interfaces (`VitalsReport`, `CheckResult`, `Issue`) |
| `packages/core/src/runner.ts` | Orchestrates checks — register new runners here |
| `packages/core/src/scoring.ts` | Weighted category scoring |
| `packages/core/src/integrations/` | One file per check runner |
| `packages/cli/src/index.ts` | CLI entry point (Commander flags) |
| `packages/cli/src/components/App.tsx` | Root Ink component, UI phases |
| `packages/web/src/App.tsx` | Web dashboard root, report loading |

---

## Running Tests

```bash
# All packages
pnpm test

# Per package
pnpm --filter @vitals/core test
pnpm --filter @vitals/cli test
pnpm --filter @vitals/web test

# Watch mode
pnpm --filter @vitals/core test -- --watch

# With coverage
pnpm --filter @vitals/core test -- --coverage
```

Tests are colocated with source files — `git.test.ts` lives next to `git.ts`. See `packages/core/src/integrations/git.test.ts` for the pattern.

---

## How to Add a New Check

All checks live in `packages/core/src/integrations/`. Each is a class that extends `BaseRunner`.

### 1. Create the runner file

```typescript
// packages/core/src/integrations/my-check.ts
import { BaseRunner } from './base.js';
import { timer } from '../utils/file-helpers.js';
import type { CheckResult, Issue, ProjectInfo } from '../types.js';

export class MyCheckRunner extends BaseRunner {
  name = 'my-check';
  category = 'code-quality' as const; // dependencies | security | code-quality | performance | git

  // Optional — return false to skip this check for non-applicable projects.
  // Default implementation returns true (runs everywhere).
  async isApplicable(_projectPath: string, info: ProjectInfo): Promise<boolean> {
    return info.framework === 'react'; // example: React-only check
  }

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    const issues: Issue[] = [];

    try {
      // Run your tool, parse output, build issues array
      // ...

      const score = issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 10);

      return {
        id: this.name,
        category: this.category,
        name: 'My Check',           // human-readable display name
        score,                       // 0–100
        status: score >= 80 ? 'pass' : score >= 60 ? 'warning' : 'fail',
        issues,
        toolsUsed: ['my-tool'],
        duration: elapsed(),
        metadata: {},                // optional — any extra data for the web dashboard
      };
    } catch (err) {
      return {
        id: this.name,
        category: this.category,
        name: 'My Check',
        score: 0,
        status: 'fail',
        issues: [{ severity: 'critical', message: `my-check failed: ${err}`, reportedBy: [this.name] }],
        toolsUsed: ['my-tool'],
        duration: elapsed(),
      };
    }
  }
}
```

### 2. Register it in `runner.ts`

```typescript
// packages/core/src/runner.ts
import { MyCheckRunner } from './integrations/my-check.js';

const ALL_RUNNERS: ToolRunner[] = [
  // ... existing runners ...
  new MyCheckRunner(),
];
```

### 3. Write a test

```typescript
// packages/core/src/integrations/my-check.test.ts
import { describe, it, expect } from 'vitest';
import { MyCheckRunner } from './my-check.js';

describe('MyCheckRunner', () => {
  it('returns a valid CheckResult', async () => {
    const runner = new MyCheckRunner();
    const result = await runner.run('/path/to/test/project');
    expect(result.id).toBe('my-check');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
```

Use `fixtures/packages/react-app` or `fixtures/packages/node-api` as real test targets.

### 4. Rebuild core

```bash
pnpm --filter @vitals/core build
```

### Notes

- If your check requires an external tool, add it as a **dependency in `packages/core/package.json`** — all tools must be bundled, not installed globally by the user
- Use `this.skipped('reason')` from `BaseRunner` to return a clean skip result rather than throwing
- Score thresholds: **80+** = pass, **60–79** = warning, **< 60** = fail

---

## How to Add a New Test Fixture

Test fixtures live in `fixtures/packages/`. They are intentionally flawed projects that verify Vitals catches real issues.

### Steps

1. **Create the package directory**

   ```bash
   mkdir fixtures/packages/my-fixture
   cd fixtures/packages/my-fixture
   ```

2. **Add a `package.json`** with a unique `name` field and the dependencies you want to test against. Use outdated or problematic versions intentionally.

3. **Write source files** with real issues baked in — the goal is to give Vitals something to find:
   - Hardcoded secrets (fake values — use patterns like `sk_live_...` or `AKIA...`)
   - Circular imports
   - Duplicate code blocks (jscpd needs ~5+ duplicated lines to flag)
   - Deep nested conditionals (complexity runner)
   - TODO/FIXME comments
   - No test files (coverage)

4. **Install from the fixtures root** to update the workspace lockfile:

   ```bash
   cd fixtures && pnpm install
   ```

5. **Verify Vitals catches what you intended:**

   ```bash
   vitals --path fixtures/packages/my-fixture
   vitals --path fixtures/packages/my-fixture --web
   ```

6. **Document the fixture** in `fixtures/README.md` — add a section with the framework/runtime, what issues are intentional, and what score range to expect.

### Guidelines

- Each fixture should test a **specific scenario** — standalone React, Node API, Python lib, etc.
- Avoid fixtures that are clean and healthy — that's not useful for catching regressions
- Use **fake but realistic-looking** secrets — real credentials should never be committed
- The `node_modules` directory is gitignored — commit the lockfile, not the modules

---

## How to Add a New Language *(stub for future contributors)*

> This section will be fleshed out once the polyglot architecture is established in `core` (Phase 4). The short version of the plan:

1. **Language detection** — extend `detectProject()` in `packages/core/src/utils/detect-project.ts` to identify the new language (e.g. `pyproject.toml` → Python)
2. **New runners** — create check runners in `packages/core/src/integrations/` scoped to the new language via `isApplicable()`
3. **New fixture** — add a fixture under `fixtures/packages/` for the new language with intentional issues
4. **Runner registration** — add the new runners to `ALL_RUNNERS` in `runner.ts`

Do not start language work until framework detection from the monorepo phase is stable — building language runners before that lands means rewriting them later.

---

## Development Workflow

### Iterating on a check

```bash
# Terminal 1 — rebuild core on changes
pnpm --filter @vitals/core dev

# Terminal 2 — rebuild cli on changes
pnpm --filter @vitals/cli dev

# Terminal 3 — test against a fixture
node packages/cli/dist/index.js --path fixtures/packages/node-api
node packages/cli/dist/index.js --path fixtures/packages/react-app --web
```

### Iterating on the terminal UI

```bash
pnpm --filter @vitals/cli dev
node packages/cli/dist/index.js --path fixtures/packages/react-app
```

### Iterating on the web dashboard

```bash
# Generate a report from a fixture and start the dev server
node packages/cli/dist/index.js --path fixtures/packages/react-app --json > packages/web/public/vitals-report.json
pnpm --filter @vitals/web dev
```

---

## Commit Style

We follow conventional commits — keep the subject line short and use the body for context:

```
feat: add complexity runner for cyclomatic complexity detection
fix: skip react-perf check on non-React projects
docs: add contributing guide
test: add coverage runner integration test
refactor: extract shared score calculation into util
```

Run lint and tests before submitting a PR:

```bash
pnpm lint
pnpm test
```
