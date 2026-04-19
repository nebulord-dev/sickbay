---
name: audit-core
description: Use when auditing packages/core for check runner correctness, advisor contract, config safety, suppress-rule correctness, cross-platform path bugs, scoring edge cases, report privacy leaks, or error handling gaps in integrations. Run before merging any change that touches packages/core/.
---

# Audit: packages/core

Deep audit of the analysis engine. Focus on correctness, robustness, and what gets leaked into reports — this is what Sickbay runs against user projects, and reports are shared via URL and uploaded to Anthropic when AI is enabled.

## Checklist

### 1. BaseRunner Contract

Every runner in `src/integrations/` must correctly implement `BaseRunner`. Check:

- `name` and `category` are set as class fields (not in constructor)
- `run()` always returns a `CheckResult` — never throws. Errors must be caught and returned as a failed result with `status: 'fail'` and a meaningful issue message
- `isApplicable()` is used for I/O-based filtering only. Cheap pre-filters use declarative `applicableRuntimes` / `applicableFrameworks` fields
- Runners that call external tools (knip, madge, jscpd, etc.) handle tool-not-found gracefully — the tool may not be installed

### 2. Advisor Contract (src/advisors/)

Parallel subsystem to integrations — advisors generate best-practice recommendations rather than pass/fail checks. Easy to miss because they're less trafficked. Check:

- Each advisor extends `BaseAdvisor` and handles the no-config / no-source case cleanly
- Framework detection logic must match the integrations' detection — if `react-best-practices.ts` uses a different detector than `react-perf.ts`, one will fire where the other doesn't
- Advisors must not mutate project files. Recommendations go into the report; nothing on disk
- **Duplicate recommendation risk**: if the same practice is surfaced both as an integration issue and an advisor recommendation, the user sees it twice. Spot-check that advisors don't shadow integration output

### 3. Framework/Runtime Scoping

Misscoped runners silently skip checks or run them on the wrong projects.

- Review `applicableRuntimes` and `applicableFrameworks` for each runner — are they correct?
- Runners scoped to `['node']` must NOT accidentally run on React/Next/Angular projects
- Runners for `['react', 'next']` must not run on plain Node APIs
- Check `src/utils/detect-project.ts` — is framework detection reliable? Edge cases: projects with multiple frameworks, projects with no `package.json`

### 4. Cross-Platform Path Handling

This has caused silent Windows failures historically.

- Search for any `path.join` or `fullPath.replace(projectRoot + '/', '')` patterns — these break on Windows
- All relative path computation must use `relativeFromRoot()` from `src/utils/file-helpers.ts`
- Test files that mock `fs` and compare forward-slash paths must also mock `path` to use `path.posix`

### 5. Scoring Edge Cases

Review `src/scoring.ts`:

- What happens when zero checks run? (all skipped/failed to start)
- What happens when all checks in a category are skipped?
- Score of `NaN` or `Infinity` would corrupt the web dashboard and JSON output
- Category weight sum must equal 1.0 — verify `CATEGORY_WEIGHTS`
- Thresholds: 80+ = green, 60–79 = yellow, <60 = red — are these applied consistently everywhere?
- **Suppress interaction**: when users suppress issues, does the category score rise (issues effectively removed) or stay the same (suppressed but still counted)? Whichever the behaviour is, it must be consistent across report, CLI summary, and web dashboard

### 6. Runner Orchestration

Review `src/runner.ts`:

- Checks run via `Promise.allSettled` — a rejected promise must NOT crash the run
- `onCheckStart` / `onCheckComplete` callbacks — are they called correctly even when a check errors?
- Timeout handling — is there a timeout per check? A hung child process could stall the entire scan
- The `checks` option (subset of check IDs) — does it correctly filter without breaking unrelated checks?

### 7. Error Handling in Integrations

Pick 5 integrations at random and verify:

- What happens when the project has no `package.json`?
- What happens when the external tool (knip, madge, etc.) exits with a non-zero code for a legitimate reason (e.g., knip finding issues)?
- What happens when tool output is malformed JSON?
- Are child process errors (ENOENT, EPERM) caught and surfaced as issues, not crashes?
- **Parser robustness for structured tool output:** do parsers filter degenerate entries before producing issues? Common examples: `current === latest` (pnpm can report unchanged entries when catalogs drift), missing version fields, pre-release-only diffs. Do version comparison helpers (`getUpdateType` and friends) check **every** semver segment, not just the first differing one? A fallthrough in a 2-segment compare produces silently-wrong classifications (e.g. `4.1.3 → 4.1.3` labeled as a "patch update") that surface as confusing UI.

### 8. Config Safety (src/config.ts)

`sickbay.config.ts` is user-authored TypeScript, loaded at runtime. Treat it as a trust boundary — the user trusts their own config but shouldn't get a raw stack trace when it's broken.

- How is the config loaded (dynamic `import()`, jiti, vm sandbox)? Whichever mechanism, errors at load time must become a readable message, not a raw Node stack
- Validation of shape/types — missing required fields, wrong types, wrong literal values (e.g. unknown check ID in `checks: [...]`) must fail with a clear validation error, not silently revert to defaults
- What happens on `--help` or `--version`? Config loading should be lazy — don't execute user TS just to print help
- Path normalization inside the config (e.g. `ignore: ['src/**']`) must work cross-platform

### 9. Suppress Rules (src/utils/suppress.ts)

Users can suppress individual issues by rule/path. Subtle bugs here cause either under-reporting (silently hiding real issues) or noisy false negatives.

- Malformed suppress pattern (bad glob, unknown rule ID) — caught and warned, or crashes the run?
- Glob matching uses forward slashes internally — do patterns defined by users get normalized before matching on Windows?
- **Suppress-before-score-interaction**: if the runner produces the issue and the suppress filter removes it, does the category score reflect the filtered count? Or does the score use the raw count and the UI just hide? Whichever it is, behaviour must be documented and tested
- Pathological patterns (`**/**/**`, regex-like input passed where globs expected) — don't crash the scan

### 10. Report Privacy

Reports are persisted (`.sickbay/last-report.json`), shared via `?report=<base64>` URLs, and uploaded to Anthropic when AI is enabled. Audit what leaks out.

- **Absolute paths with usernames** — any runner embedding `/Users/alice/...` leaks operator identity. Every path in a report must come from `relativeFromRoot()`, never from raw `execa` stdout that retained absolute paths
- **.env values** — the `secrets` runner should *detect* them but must not *include* the matched string in the report's issue message. Verify the output redacts the secret
- **Environment variables** — grep for `process.env` in every integration. Any serialization of `process.env.*` into a report field is a leak
- **Stack traces** — if a runner fails and stashes the error, the stack trace can contain absolute paths and sometimes environment context. Scrub before embedding

### 11. Dep-Tree Generation (utils/dep-tree.ts)

Core computes the dep tree by shelling to the package manager via `getDependencyTree()`. Disk caching lives in the CLI layer (see `/audit-cli` §9 for `.sickbay/dep-tree.json` handling) — this section covers only core's generator.

- Package-manager output format differences — pnpm returns an array, npm/yarn return an object. Verify all three paths are exercised
- `bun` is intentionally skipped (`ls --json` not parseable). If bun gains support, the skip should be revisited
- `reject: false` + 30s timeout means silent failures produce an empty tree. Verify downstream consumers distinguish "no deps" from "generation failed" when that matters

### 12. Test Coverage

- Every runner in `src/integrations/` should have a corresponding `.test.ts`
- Every advisor in `src/advisors/` should have a corresponding `.test.ts`
- Check for runners with no tests or only smoke tests
- Critical utils (`file-helpers.ts`, `detect-project.ts`, `detect-monorepo.ts`, `scoring.ts`, `suppress.ts`, `dep-tree.ts`) should have thorough unit tests

### 13. Snapshot Regression Suite

`tests/snapshots/fixture-regression.test.ts` runs Sickbay against the `fixtures/` workspace and compares the JSON output to committed snapshots. After any change to a runner, advisor, or scoring:

- Run `pnpm test:snapshots`
- Intentional diffs get updated with `-u` and explained in the PR description
- A snapshot diff in a fixture you didn't intend to affect is a leak — trace it before updating

## Key Files

```
packages/core/src/
├── runner.ts              # Orchestrator — check this for allSettled handling
├── scoring.ts             # Weights and edge cases
├── config.ts              # User TS config — trust boundary
├── types.ts               # SickbayReport shape
├── index.ts               # Public API — verify no internals leak
├── integrations/          # 34 runners — sample 5–10 for contract compliance
├── advisors/              # 4 best-practice advisors — parallel contract
├── utils/
│   ├── file-helpers.ts    # relativeFromRoot — cross-platform critical
│   ├── detect-project.ts  # Framework detection
│   ├── detect-monorepo.ts # Monorepo detection
│   ├── suppress.ts        # Suppress rule evaluation
│   └── dep-tree.ts        # Cached dep graph
tests/snapshots/           # Cross-package regression suite
```

## Output Format

Dispatched reviewer should report findings as:

```
[Severity: High|Medium|Low] path/to/file.ts:123
What's wrong: <one-line description>
Why it matters: <impact on users or maintainers>
Suggested fix: <concrete change>
```

Skip style/formatting issues — oxlint and oxfmt handle those.

## How to Run

Dispatch a `feature-dev:code-reviewer` agent. Provide the checklist above and point it at the Key Files. Tell it to flag by severity and only report high-confidence findings.

## Related Audits

- Adding/removing a runtime dep in core → run **audit-cli** (bundled-deps mirror must update)
- Changing report `types.ts` → run **audit-web** (type imports must still compile)
- Adding a new file in a new directory → run **audit-architecture** (check pipeline/workspace registration)
