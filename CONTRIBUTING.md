# Contributing to Sickbay

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 8 — `npm install -g pnpm`
- **Git**

---

## Local Setup

```bash
git clone https://github.com/nebulord-dev/sickbay.git
cd sickbay

# Install all workspace dependencies
pnpm install

# Build everything (core → cli → web, in dependency order)
pnpm build

# Link the CLI globally so you can run `sickbay` anywhere
cd apps/cli && pnpm link --global
```

---

## Project Orientation

This is a pnpm workspace monorepo with three packages that have a strict build order:

```
sickbay-core   — analysis engine (all check runners, scoring, types)
     ↓
sickbay                  — terminal UI (Ink + Commander), depends on core; published as the unscoped `sickbay` npm package
     ↓
sickbay-web    — web dashboard (Vite + React), served by cli
```

Always build `core` before `cli`. `turbo build` handles this automatically.

The `fixtures/` directory is a separate pnpm workspace used for testing — it is **not** part of the build pipeline. See [Test Fixtures](#test-fixtures) below.

### Key files to know

| File                              | What it does                                                               |
| --------------------------------- | -------------------------------------------------------------------------- |
| `packages/core/src/types.ts`      | All shared TypeScript interfaces (`SickbayReport`, `CheckResult`, `Issue`) |
| `packages/core/src/runner.ts`     | Orchestrates checks — register new runners here                            |
| `packages/core/src/scoring.ts`    | Weighted category scoring                                                  |
| `packages/core/src/integrations/` | One file per check runner                                                  |
| `apps/cli/src/index.ts`           | CLI entry point (Commander flags)                                          |
| `apps/cli/src/components/App.tsx` | Root Ink component, UI phases                                              |
| `apps/web/src/App.tsx`            | Web dashboard root, report loading                                         |

---

## Running Tests

```bash
# All packages
pnpm test

# Per package
pnpm --filter sickbay-core test
pnpm --filter sickbay test
pnpm --filter sickbay-web test

# Watch mode
pnpm --filter sickbay-core test -- --watch

# With coverage
pnpm --filter sickbay-core test -- --coverage
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
import type { CheckResult, Issue } from '../types.js';

export class MyCheckRunner extends BaseRunner {
  name = 'my-check';
  category = 'code-quality' as const; // dependencies | security | code-quality | performance | git

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
        name: 'My Check', // human-readable display name
        score, // 0–100
        status: score >= 80 ? 'pass' : score >= 60 ? 'warning' : 'fail',
        issues,
        toolsUsed: ['my-tool'],
        duration: elapsed(),
        metadata: {}, // optional — any extra data for the web dashboard
      };
    } catch (err) {
      return {
        id: this.name,
        category: this.category,
        name: 'My Check',
        score: 0,
        status: 'fail',
        issues: [
          { severity: 'critical', message: `my-check failed: ${err}`, reportedBy: [this.name] },
        ],
        toolsUsed: ['my-tool'],
        duration: elapsed(),
      };
    }
  }
}
```

### 2. Scope it to the right runtime or framework (if applicable)

If a check only makes sense for a specific runtime or framework, declare that on the class using the built-in scoping fields. The orchestrator filters runners using these before any I/O runs — cheap and automatic.

```typescript
// Only runs on Node projects (no React/Vue/Angular/etc. in deps)
applicableRuntimes = ['node'] as const;

// Only runs on React/Next/Remix projects
applicableFrameworks = ['react', 'next', 'remix'] as const;
```

Runtime is derived automatically from `detectContext()`:

- Projects with no recognised UI framework → `runtime: 'node'`
- Projects with React/Vue/Angular/etc. → `runtime: 'browser'`
- Projects without a `package.json` → `runtime: 'unknown'` (all scoped runners silently skipped)

You can use both fields together. A check that declares `applicableRuntimes = ['node']` will never run on a React app, even if it's technically a valid check.

For checks that need additional I/O-based gating on top (e.g. "only if a specific config file exists"), override `isApplicable()` as well — but still set the declarative fields for the cheap pre-filter:

```typescript
applicableRuntimes = ['node'] as const;

async isApplicable(projectPath: string, context: ProjectContext): Promise<boolean> {
  return fileExists(projectPath, 'some-config.json');
}
```

Omit both fields entirely if the check applies to all projects universally.

### 3. Register it in `runner.ts`

```typescript
// packages/core/src/runner.ts
import { MyCheckRunner } from './integrations/my-check.js';

const ALL_RUNNERS: ToolRunner[] = [
  // ... existing runners ...
  new MyCheckRunner(),
];
```

### 4. Write a test

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

Use `fixtures/packages/react-app` or `fixtures/packages/node-api` as real test targets. Verify that scoped runners don't appear in the wrong fixture's output.

### 5. Rebuild core

```bash
pnpm --filter sickbay-core build
```

### Notes

- If your check requires an external tool, add it as a **dependency in `packages/core/package.json`** — all tools must be bundled, not installed globally by the user
- Use `this.skipped('reason')` from `BaseRunner` to return a clean skip result rather than throwing
- Score thresholds: **80+** = pass, **60–79** = warning, **< 60** = fail
- All new `ProjectContext` types (`Framework`, `Runtime`, `BuildTool`, `TestFramework`) and `detectContext` are exported from `sickbay-core` public API

---

## How to Add a New Test Fixture

Test fixtures live in `fixtures/packages/`. They are intentionally flawed projects that verify Sickbay catches real issues.

### Steps

1. **Create the package directory**

   ```bash
   mkdir fixtures/packages/my-fixture
   cd fixtures/packages/my-fixture
   ```

2. **Add a `package.json`** with a unique `name` field and the dependencies you want to test against. Use outdated or problematic versions intentionally.

3. **Write source files** with real issues baked in — the goal is to give Sickbay something to find:
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

5. **Verify Sickbay catches what you intended:**

   ```bash
   sickbay --path fixtures/packages/my-fixture
   sickbay --path fixtures/packages/my-fixture --web
   ```

6. **Document the fixture** in `fixtures/README.md` — add a section with the framework/runtime, what issues are intentional, and what score range to expect.

### Guidelines

- Each fixture should test a **specific scenario** — standalone React, Node API, Python lib, etc.
- Avoid fixtures that are clean and healthy — that's not useful for catching regressions
- Use **fake but realistic-looking** secrets — real credentials should never be committed
- The `node_modules` directory is gitignored — commit the lockfile, not the modules

---

## How to Add a New Language _(stub for future contributors)_

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
pnpm --filter sickbay-core dev

# Terminal 2 — rebuild cli on changes
pnpm --filter sickbay dev

# Terminal 3 — test against a fixture
node apps/cli/dist/index.js --path fixtures/packages/node-api
node apps/cli/dist/index.js --path fixtures/packages/react-app --web
```

### Iterating on the terminal UI

```bash
pnpm --filter sickbay dev
node apps/cli/dist/index.js --path fixtures/packages/react-app
```

### Iterating on the web dashboard

```bash
# Generate a report from a fixture and start the dev server
node apps/cli/dist/index.js --path fixtures/packages/react-app --json > apps/web/public/sickbay-report.json
pnpm --filter sickbay-web dev
```

---

## Using Claude Code

This project is set up for [Claude Code](https://claude.ai/claude-code) with custom skills, and plans. If you have Claude Code installed, start your session with:

```
/prime
```

This loads the full project context — architecture, file locations, domain model, and gotchas — so Claude can assist effectively from the first prompt.

Other useful entry points:

- `/plan-feature` — create an implementation plan before writing code
- `/review-project` — scan the project for issues
- `/sync-docs` — check if docs need updating after recent changes

Project-specific configuration lives in `CLAUDE.md` and `.claude/`.

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

Run lint, format check, and tests before submitting a PR:

```bash
pnpm lint          # oxlint
pnpm format:check  # oxfmt
pnpm test
```
