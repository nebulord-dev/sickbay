# Sickbay — Monorepo Support Design Notes

## Detection

Identify a monorepo by checking for the following signals at the project root:

| Signal | Tool |
|--------|------|
| `pnpm-workspace.yaml` | pnpm workspaces |
| `workspaces` field in root `package.json` | npm/yarn workspaces |
| `turbo.json` | Turborepo |
| `nx.json` | Nx |
| `lerna.json` | Lerna |
| `packages/` or `apps/` directories | Convention-based |

---

## Analysis Granularity

Three modes to consider:

| Mode | Description | Status |
|------|-------------|--------|
| **A — Whole repo** | Single report, aggregated results. Simple but loses per-package signal. | Not recommended |
| **B — Per package** | Discovers all packages, runs framework detection per-package, generates per-package reports. | ✅ Target approach |
| **C — Both** | Per-package detail + root-level summary rollup. | Ideal end state |

---

## Data Shape

```ts
interface MonorepoReport {
  root: string;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'nx' | 'turbo';
  packages: PackageReport[];
}

interface PackageReport {
  name: string;        // from package.json name
  path: string;        // relative path
  framework: Framework;
  checks: CheckResult[];
  score: number;
}
```

### `CheckResult` — add `description` field

As part of this work, move the human-readable check description onto `CheckResult` itself
(currently hardcoded in `CHECK_DESCRIPTIONS` in `web/src/components/About.tsx`). This
lets the About page render `check.description` dynamically rather than maintaining a
manual map — a prerequisite for any language beyond TypeScript showing up correctly.

```ts
interface CheckResult {
  // ... existing fields ...
  description: string;  // add this — set by each runner
}
```

---

## Monorepo-Specific Checks

Checks that only make sense at the root level:

- Consistent Node/package manager versions across packages (`engines` field)
- Packages referencing each other correctly (workspace protocol vs hardcoded versions)
- Shared deps duplicated at package level instead of hoisted
- Missing `turbo.json` pipeline config if Turborepo is detected but misconfigured
- Inconsistent `tsconfig` settings across packages

---

## Invocation Context

Sickbay should detect where it's being run from and behave accordingly:

- **At monorepo root** → walk all workspace packages, show summary + per-package results
- **Inside a workspace package** → treat as single-package mode, run normally
- **`--package=<name>` flag** → focus on a single named package from the root

---

## Terminal TUI Behaviour

The TUI (`sickbay tui`) is space-constrained. When a monorepo is detected, show a persistent
banner in one panel rather than trying to cram per-package detail in:

```
┌─ Monorepo Detected ──────────────────────────────┐
│ 📦 4 packages found (pnpm workspaces)            │
│                                                   │
│ Showing aggregated summary. For per-package       │
│ details run:  sickbay --web                        │
└───────────────────────────────────────────────────┘
```

Remaining panels show rolled-up data — total checks, total warnings/errors,
and a mini scoreboard:

```
@company/web-app     React    ████████░░  82%
@company/api         Node     ██████░░░░  61%  ⚠
@company/shared      vanilla  █████████░  91%
@company/admin       Angular  ███████░░░  74%
```

`--web` is the **recommended mode for monorepos**. The TUI summary is a
health snapshot, not a replacement for the full web view.

---

## Web UI — Tabbed Per-Package Reports

### Architecture

- Express server walks the monorepo and builds the full `MonorepoReport` on startup
- Entire payload served to the client upfront — no per-tab re-fetching
- Tab switching is client-side only — instant navigation

### UI Structure

```
[ Overview ] [ @company/web-app ] [ @company/api ] [ @company/shared ] [ @company/admin ]
```

- **Overview tab** — health score grid across all packages (scoreboard view)
- **Package tabs** — existing single-package check results component, reused per-package
- Selected tab controls which `PackageReport` is passed into the results component

### Key Implementation Notes

- Current single-package view becomes a reusable component — audit for hardcoded
  assumptions about there being one project before starting
- Load all data upfront on server start, not lazily per tab
- The backend change is minimal — serve `MonorepoReport` instead of a flat `CheckResult[]`

### Effort Estimate

| Task | Effort |
|------|--------|
| Monorepo detection + package walking | Small |
| Data shape refactor (incl. `description` on `CheckResult`) | Small |
| Tab UI | Small–Medium |
| Decoupling existing check components | Depends on current coupling |
| Coverage reporting per-package aggregation | Small–Medium |

---

## Coverage Reporting

Currently, running Vitest from the monorepo root instruments all source files — including
untested integration runners in `core` — producing a misleadingly low overall figure (~43%)
even though per-package coverage is 95%+.

The fix: run coverage per-package and aggregate the results into the report rather than
running a single root-level pass. This should be tackled as part of the monorepo work since
the infrastructure for per-package runs will already be in place.

---

## CI/CD Implications

The current single-project CI/CD template works as-is. Monorepo support will require:

- **Matrix builds** — run `sickbay --package=<name>` per package in parallel
- **Per-package thresholds** — different packages may have different acceptable score floors
- **Root-level summary step** — aggregate per-package results into a PR comment rollup

Plan for a v2 of the CI/CD templates once monorepo detection is stable. Do not try to
build a single template that handles both cases — keep them separate.

---

## What This Unlocks

Completing monorepo support unblocks the following backlog items (all explicitly blocked
until this work is done):

- Custom check API / plugin system
- VS Code extension (needs to know which package is active)
- `.sickbayrc` config file (per-package overrides require monorepo awareness)
- Multi-repo team dashboard (per-package drill-down depends on this)
- Context-aware tips in quick wins (requires reliable framework detection per-package)
- CI/CD template v2 (matrix builds)
- About page fully dynamic (once `description` is on `CheckResult`)

---

## Future: `sickbay-py`

Python projects don't fit the TS/Node model cleanly — different project roots
(`pyproject.toml`, `requirements.txt`), different tooling (`ruff`, `mypy`), no
`package.json`. Rather than bolt Python support onto Sickbay, treat it as a
sibling CLI:

- Same philosophy and TUI
- Implemented natively in Python (or a thin Node wrapper)
- Can use Python's `ast` module for code analysis, `importlib.metadata` for deps
- Polyglot monorepo view spanning both CLIs is a natural phase 3

**Phase order:**
1. Sickbay — TS/React/Angular/Node checks, framework detection, monorepo support ← current
2. Sickbay-py — Python/Django/FastAPI/Flask checks
3. Unified dashboard — polyglot monorepo view across both CLIs
