---
name: audit-core
description: Use when auditing packages/core for check runner correctness, BaseRunner contract violations, cross-platform path bugs, scoring edge cases, or error handling gaps in integrations.
---

# Audit: packages/core

Deep audit of the analysis engine. Focus on correctness and robustness — this is what Sickbay runs against user projects.

## Checklist

### 1. BaseRunner Contract

Every runner in `src/integrations/` must correctly implement `BaseRunner`. Check:

- `name` and `category` are set as class fields (not in constructor)
- `run()` always returns a `CheckResult` — never throws. Errors must be caught and returned as a failed result with `status: 'fail'` and a meaningful issue message
- `isApplicable()` is used for I/O-based filtering only. Cheap pre-filters use declarative `applicableRuntimes` / `applicableFrameworks` fields
- Runners that call external tools (knip, madge, jscpd, etc.) handle tool-not-found gracefully — the tool may not be installed

### 2. Framework/Runtime Scoping

Misscoped runners silently skip checks or run them on the wrong projects.

- Review `applicableRuntimes` and `applicableFrameworks` for each runner — are they correct?
- Runners scoped to `['node']` must NOT accidentally run on React/Next/Angular projects
- Runners for `['react', 'next']` must not run on plain Node APIs
- Check `src/utils/detect-project.ts` — is framework detection reliable? Edge cases: projects with multiple frameworks, projects with no `package.json`

### 3. Cross-Platform Path Handling

This has caused silent Windows failures historically (see `docs/audit-2026-04-07.md`).

- Search for any `path.join` or `fullPath.replace(projectRoot + '/', '')` patterns — these break on Windows
- All relative path computation must use `relativeFromRoot()` from `src/utils/file-helpers.ts`
- Test files that mock `fs` and compare forward-slash paths must also mock `path` to use `path.posix`

### 4. Scoring Edge Cases

Review `src/scoring.ts`:

- What happens when zero checks run? (all skipped/failed to start)
- What happens when all checks in a category are skipped?
- Score of `NaN` or `Infinity` would corrupt the web dashboard and JSON output
- Category weight sum must equal 1.0 — verify `CATEGORY_WEIGHTS`
- Thresholds: 80+ = green, 60–79 = yellow, <60 = red — are these applied consistently everywhere?

### 5. Runner Orchestration

Review `src/runner.ts`:

- Checks run via `Promise.allSettled` — a rejected promise must NOT crash the run
- `onCheckStart` / `onCheckComplete` callbacks — are they called correctly even when a check errors?
- Timeout handling — is there a timeout per check? A hung child process could stall the entire scan
- The `checks` option (subset of check IDs) — does it correctly filter without breaking unrelated checks?

### 6. Error Handling in Integrations

Pick 5 integrations at random and verify:

- What happens when the project has no `package.json`?
- What happens when the external tool (knip, madge, etc.) exits with a non-zero code for a legitimate reason (e.g., knip finding issues)?
- What happens when tool output is malformed JSON?
- Are child process errors (ENOENT, EPERM) caught and surfaced as issues, not crashes?
- **Parser robustness for structured tool output:** do parsers filter degenerate entries before producing issues? Common examples: `current === latest` (pnpm can report unchanged entries when catalogs drift), missing version fields, pre-release-only diffs. Do version comparison helpers (`getUpdateType` and friends) check **every** semver segment, not just the first differing one? A fallthrough in a 2-segment compare produces silently-wrong classifications (e.g. `4.1.3 → 4.1.3` labeled as a "patch update") that surface as confusing UI.

### 7. Test Coverage

- Every runner in `src/integrations/` should have a corresponding `.test.ts`
- Check for runners with no tests or only smoke tests
- Critical utils (`file-helpers.ts`, `detect-project.ts`, `detect-monorepo.ts`, `scoring.ts`) should have thorough unit tests

## Key Files

```
packages/core/src/
├── runner.ts          # Orchestrator — check this for allSettled handling
├── scoring.ts         # Weights and edge cases
├── types.ts           # SickbayReport shape
├── integrations/      # 34 runners — sample 5–10 for contract compliance
├── utils/
│   ├── file-helpers.ts      # relativeFromRoot — cross-platform critical
│   ├── detect-project.ts    # Framework detection
│   └── detect-monorepo.ts   # Monorepo detection
```

## How to Run

Dispatch a `feature-dev:code-reviewer` agent. Provide key files from the checklist above. Ask it to flag issues by severity — only report high-confidence findings.
