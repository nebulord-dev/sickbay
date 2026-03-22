# Sickbay Scoring Reference

This document explains how every score in Sickbay is calculated — from individual check scores up to the overall project health score. Audience: developers integrating with the JSON output, building config overrides, or debugging why a project scored the way it did.

---

## Score scale

| Range  | Label     | Color  | Meaning                            |
| ------ | --------- | ------ | ---------------------------------- |
| 90–100 | Excellent | green  | Healthy, no meaningful issues      |
| 80–89  | Good      | green  | Minor issues, nothing urgent       |
| 60–79  | Fair      | yellow | Notable problems worth addressing  |
| 0–59   | Poor/Bad  | red    | Serious issues requiring attention |

Thresholds live in `packages/constants/src/index.ts` as `SCORE_EXCELLENT = 90`, `SCORE_GOOD = 80`, `SCORE_FAIR = 60`.

---

## Overall score

The overall score is a **weighted average** of all non-skipped check scores, grouped by category:

```
overallScore = Σ(checkScore × categoryWeight) / Σ(categoryWeight for active checks)
```

### Category weights

| Category       | Weight | Rationale                                           |
| -------------- | ------ | --------------------------------------------------- |
| `security`     | 30%    | Vulnerabilities have immediate production impact    |
| `dependencies` | 25%    | Missing/broken deps cause runtime failures          |
| `code-quality` | 25%    | Maintainability directly affects velocity           |
| `performance`  | 15%    | Performance matters but rarely causes outages       |
| `git`          | 5%     | Activity signal, low-stakes compared to the others  |

Skipped checks are excluded from both the numerator and denominator, so a skipped check doesn't drag down the score. Unknown categories default to weight `0.1`.

### Category score

Each category's score displayed in the UI is the **unweighted average** of all non-skipped checks in that category.

---

## Check reference

### Dependencies (25% weight)

---

#### Unused Code (`knip`)

Runs [Knip](https://knip.dev) to find unused files, dependencies, devDependencies, and exports.

**Score formula**: `max(0, 100 − totalIssues × 5)`

**Status thresholds**:
- `pass` — 0 issues
- `warning` — 1–10 issues
- `fail` — >10 issues

**Issue severities**:
| Finding              | Severity |
| -------------------- | -------- |
| Unused file          | warning  |
| Unused dependency    | warning  |
| Unused devDependency | info     |
| Unused export        | info     |

> **Note**: `@testing-library/*` packages are suppressed when a test runner (`vitest`, `jest`) is detected — Knip can't see test-only devDeps when test files are excluded from its entry points.

---

#### Dependency Health (`depcheck`)

Runs [depcheck](https://github.com/depcheck/depcheck) to find **missing** dependencies (used in code but not declared in `package.json`). Unused dependency reporting is intentionally skipped — Knip handles that more comprehensively.

Virtual modules (`virtual:*`) and Node built-ins (`node:*`) are ignored.

**Score formula**: `max(0, 100 − missingCount × 5)`

**Status thresholds**:
- `pass` — no missing deps
- `warning` — other issues
- `fail` — any missing dependencies

**Issue severities**: all missing deps are `critical`.

---

#### Outdated Packages (`outdated`)

Runs `npm outdated --json` or `pnpm outdated --json` to find packages with newer versions available.

> **Skipped** for yarn and bun (their `outdated` output isn't machine-parseable).

**Score formula**: `max(0, 100 − count × 3)`

**Status thresholds**:
- `pass` — 0 outdated packages
- `warning` — 1–15 outdated packages
- `fail` — >15 outdated packages

**Issue severities**: major version bump (current major < latest major) → `warning`; minor/patch → `info`.

---

#### Tests & Coverage (`coverage`)

Runs the project's own test runner (Vitest or Jest) with `--reporter=json --outputFile=<tmp>` to capture test counts, then reads `coverage/coverage-summary.json` for coverage percentages.

Falls back to reading an existing `coverage/coverage-summary.json` without running tests if no test runner is detected.

**Score formula**:
```
if (failedTests > 0):
  baseScore = round(100 × passedTests / totalTests)
else:
  baseScore = 100

if (coverageData exists):
  covAvg = (lines + statements + functions + branches) / 4
  score = round(baseScore × 0.6 + covAvg × 0.4)
else:
  score = baseScore
```

**Status thresholds**:
- `fail` — any failing tests, OR line coverage < 50%
- `warning` — line coverage < 80%, OR no coverage provider installed
- `pass` — all tests pass, line coverage ≥ 80%

**Coverage issue thresholds**:
| Condition              | Severity |
| ---------------------- | -------- |
| Line coverage < 50%    | critical |
| Line coverage < 80%    | warning  |
| Function coverage < 80% | warning |
| No `@vitest/coverage-v8` | info   |

---

### Security (30% weight)

---

#### Security Vulnerabilities (`npm-audit`)

Runs `npm audit --json` against the project.

**Score formula**:
```
critical = criticalVulns + highVulns
if (critical > 0):
  score = max(0, 60 − critical × 15)
else:
  score = max(0, 100 − moderateVulns × 10 − lowVulns × 2)
```

**Status thresholds**:
- `fail` — any critical or high severity vulnerabilities
- `warning` — any moderate or low vulnerabilities
- `pass` — no vulnerabilities

**Issue severities**: critical/high → `critical`; moderate/low → `warning`.

---

#### Secrets Detection (`secrets`)

Scans `src/` for hardcoded secrets using regex patterns. Also checks whether `.env`, `.env.local`, `.env.production` are committed without being in `.gitignore`.

**Patterns detected**: AWS access keys, GitHub tokens, Slack tokens, Google API keys, Stripe live keys, PEM private keys, hardcoded `password=`, `api_key=`, `secret=` assignments.

**Skips**: comments, lines referencing `process.env` or `import.meta.env`, lock files, `.env.example`/`.env.sample`/`.env.template`, test files.

**Score formula**: `max(0, 100 − count × 25)`

**Status**: any finding → `fail`; none → `pass`. All findings are `critical` severity.

---

#### License Compliance (`license-checker`)

Runs [license-checker](https://github.com/davglass/license-checker) against production dependencies to flag licenses that may be incompatible with commercial use.

**Flagged licenses**: GPL-2.0, GPL-3.0, AGPL-3.0, LGPL-2.1, LGPL-3.0, CC-BY-NC.

**Score formula**: `issues === 0 ? 100 : max(60, 100 − issues × 10)`

> Score floor of 60 — license issues are flagged but not project-killers on their own.

**Status**: any flagged license → `warning`; none → `pass`. All issues are `warning` severity.

---

#### Node Security Middleware (`node-security`)

**Applies to**: Node.js projects with an HTTP server framework (`express`, `fastify`, `koa`, `hapi`, `nestjs`, etc.) in dependencies.

Checks for presence of three security middleware families:

| Middleware         | Packages checked                                         | Score contribution |
| ------------------ | -------------------------------------------------------- | ------------------ |
| Security headers   | `helmet`, `koa-helmet`, `fastify-helmet`                  | +35                |
| CORS               | `cors`, `@koa/cors`, `@fastify/cors`, `koa2-cors`        | +30                |
| Rate limiting      | `express-rate-limit`, `rate-limiter-flexible`, `@fastify/rate-limit`, `koa-ratelimit` | +35 |

**Score formula**: additive — start at 0, add each component's points if the package is present.

**Status thresholds**: ≥80 → `pass`; ≥50 → `warning`; <50 → `fail`.

**Issue severities**: missing helmet → `critical`; missing CORS or rate limiting → `warning`.

---

### Code Quality (25% weight)

---

#### Lint (`eslint`)

Runs `eslint <srcDirs> --format json` against `src/`, `lib/`, or `app/` (whichever exist). Skipped if no ESLint config file is found.

**Score formula**: `max(0, 100 − errors × 5 − warnings × 0.5)`

**Status thresholds**:
- `fail` — >10 errors
- `warning` — any errors or warnings
- `pass` — 0 errors and 0 warnings

**Issue severities**: files with errors → `warning`; files with warnings only → `info`.

---

#### Type Safety (`typescript`)

Runs `tsc --noEmit` and counts `: error TS` lines. Skipped if no `tsconfig.json` is present.

**Score formula**: `max(0, 100 − errorCount × 5)`

**Status thresholds**:
- `pass` — 0 type errors
- `warning` — 1–20 type errors
- `fail` — >20 type errors

All issues are `warning` severity. Output is capped at 25 displayed errors.

---

#### Circular Dependencies (`madge`)

Runs [madge](https://github.com/pahen/madge) on `src/` to build a module dependency graph, then performs DFS to find cycles. Uses `tsconfig.app.json` if present (Vite projects), falling back to `tsconfig.json`.

**Score formula**: `circles === 0 ? 100 : max(0, 100 − circles × 10)`

**Status thresholds**:
- `pass` — 0 circular dependencies
- `warning` — 1–5 circular dependencies
- `fail` — >5 circular dependencies

All issues are `warning` severity.

---

#### Code Duplication (`jscpd`)

Runs [jscpd](https://github.com/kucherenko/jscpd) on `src/` and reads the duplication percentage from its JSON output.

**Score formula**: `max(0, 100 − percentage × 3)`

**Status thresholds**:
- `pass` — 0% or ≤5% duplication
- `warning` — >5% duplication
- `fail` — >20% duplication

**Issue severities**: >5% → `warning`; >20% → `critical`.

---

#### File Complexity (`complexity`)

Scans `src/` for source files (`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`), counts non-blank lines, and flags files that exceed line thresholds.

**Thresholds** (from `@sickbay/constants`):
| Lines       | Issue severity |
| ----------- | -------------- |
| ≥ 400 lines | info           |
| ≥ 600 lines | warning        |

**Score formula**: `max(0, 100 − oversizedFiles × 10)` (oversized = ≥400 lines)

**Status**: any oversized files → `warning`; none → `pass`.

Test files (`*.test.*`, `*.spec.*`) are excluded.

---

#### Technical Debt (`todo-scanner`)

Scans `src/` source files for `TODO`, `FIXME`, and `HACK` comments.

**Score formula**: `max(50, 100 − todos × 3)`

> Score floor of 50 — TODOs alone can't tank the score below 50.

**Status**:
- `warning` — >5 FIXMEs/HACKs, OR >20 total comments
- `pass` — everything else (including projects with some TODOs)

**Issue severities**: FIXME/HACK → `warning`; TODO → `info`.

---

#### Async Error Handling (`node-async-errors`)

**Applies to**: Node.js projects only (runtime detection).

Scans route files for async handlers (`app.get(... async`) and checks whether they're wrapped in `try/catch`. Also detects `express-async-errors` (which patches all handlers globally) and 4-parameter error middleware `(err, req, res, next)`.

**Score formula**:
```
baseScore = round(protectedFiles / routeFiles × 80)
score = min(100, baseScore + (hasErrorMiddleware ? 20 : 0))
```

**Status thresholds**: ≥80 → `pass`; ≥50 → `warning`; <50 → `fail`.

**Issue severities**: unprotected async routes → `critical` (if all unprotected) or `warning`; missing error middleware → `warning`.

> If `express-async-errors` is in deps, returns score 100 immediately — all handlers are covered.

---

#### Input Validation (`node-input-validation`)

**Applies to**: Node.js projects with an HTTP server framework in dependencies.

Checks whether a validation library is present: `zod`, `joi`, `express-validator`, `yup`, `ajv`, `@sinclair/typebox`, `valibot`.

**Scoring**: binary.
| Condition                   | Score | Status  |
| --------------------------- | ----- | ------- |
| Validation library detected | 85    | pass    |
| No validation library found | 20    | warning |

---

### Performance (15% weight)

---

#### Heavy Dependencies (`heavy-deps`)

Reads `package.json` and checks all dependencies against a hardcoded list of known heavy or unnecessary packages.

**Score formula**: `max(30, 100 − warningCount × 10 − infoCount × 5)`

> Score floor of 30.

**Status**: any flagged packages → `warning`; none → `pass`.

**Flagged packages** (warning = significant weight/maintenance concern):

| Package         | Severity | Alternative                          |
| --------------- | -------- | ------------------------------------ |
| `moment`        | warning  | dayjs or date-fns (~2KB)             |
| `moment-timezone` | warning | Intl.DateTimeFormat or date-fns-tz  |
| `lodash`        | warning  | lodash-es or individual imports      |
| `underscore`    | warning  | native JS methods                    |
| `jquery`        | warning  | native DOM APIs                      |
| `request`       | warning  | native fetch or undici (deprecated)  |
| `axios`         | info     | native fetch (Node 18+, all browsers)|
| `bluebird`      | info     | native Promises                      |
| `node-fetch`    | info     | native fetch (Node 18+)              |
| `classnames`    | info     | clsx                                 |
| `uuid`          | info     | crypto.randomUUID()                  |
| `left-pad`      | info     | String.prototype.padStart()          |
| `is-even`       | info     | n % 2 === 0                          |
| `is-odd`        | info     | n % 2 !== 0                          |
| `is-number`     | info     | typeof n === "number"                |
| `rimraf`        | info     | fs.rm({ recursive: true })           |
| `mkdirp`        | info     | fs.mkdir({ recursive: true })        |
| `qs`            | info     | URLSearchParams                      |

---

#### React Performance (`react-perf`)

**Applies to**: React, Next.js, and Remix projects only (framework detection).

Scans `.tsx` and `.jsx` files in `src/` for three anti-patterns:

| Pattern                        | Detection                                      | Severity |
| ------------------------------ | ---------------------------------------------- | -------- |
| Inline object in JSX prop      | `propName={{` (excludes `className={{`)        | warning  |
| Index as key in list           | `key={index}`, `key={i}`, `key={idx}`          | warning  |
| Large component file           | File > 400 lines                               | info     |
| Route without lazy loading     | Route file with >3 static imports and no `React.lazy` | info |

If the React Compiler (`babel-plugin-react-compiler` or `@react-compiler/babel`) is detected in deps, inline object warnings are suppressed — the compiler handles those automatically.

**Score formula**: `max(20, 100 − warnings × 3 − infos × 1)`

**Status**: any findings → `warning`; none → `pass`.

---

#### Asset Sizes (`asset-size`)

**Applies to**: browser projects only (runtime detection).

Scans `public/`, `src/assets/`, `static/`, and `assets/` for images, SVGs, and fonts. Video/audio files are skipped.

**Per-file thresholds**:
| Asset type | Warning threshold | Critical threshold |
| ---------- | ----------------- | ------------------ |
| Images (png, jpg, gif, webp, bmp, ico) | 500KB | 2MB |
| SVG        | 100KB             | —                  |
| Fonts (woff, woff2, ttf, otf, eot)     | 500KB | —  |

**Total asset size thresholds**: >5MB → `warning`; >10MB → `critical`.

**Score formula**: `max(20, 100 − criticalCount × 20 − warningCount × 8)`

**Status**: any critical issues → `fail`; any warnings → `warning`; none → `pass`.

---

#### Bundle Size (`source-map-explorer`)

**Applies to**: browser projects only (runtime detection). Requires a `dist/` or `build/` directory.

Uses [source-map-explorer](https://github.com/danvk/source-map-explorer) when source maps (`.js.map`) are present. Falls back to summing raw `.js` file sizes when source maps are absent or the tool fails.

**Size thresholds** (applied to total JS bundle size):
| Size       | Score | Status  |
| ---------- | ----- | ------- |
| ≤ 500KB    | 100   | pass    |
| 500KB–1MB  | 70    | warning |
| > 1MB      | 40    | fail    |

**Issue severities**: >1MB → `critical`; >500KB → `warning`.

> **Known limitation**: the current scoring sums all chunks, which can over-penalize projects with proper code splitting. A future fix will score the largest *initial* chunk rather than the combined total.

---

### Git (5% weight)

---

#### Git Health (`git`)

**Applies to**: repositories with a `.git` directory.

Collects: last commit date (`git log -1 --format=%cr`), total commit count (`git rev-list --count HEAD`), contributor count (`git shortlog -sn`), and remote branch count (`git branch -r`).

**Issues detected**:
| Condition                   | Severity |
| --------------------------- | -------- |
| Last commit > 6 months ago  | warning  |
| >20 remote branches         | info     |

**Score**: `issues.length === 0 ? 100 : 80`

**Status**: any issues → `warning`; none → `pass`.

---

## Check applicability

Not every check runs against every project. Runners are filtered in two phases:

**1. Declarative (synchronous, no I/O)**

Runners declare `applicableRuntimes` or `applicableFrameworks` on the class. Runtime is derived from the project's dependencies (React/Vue/Angular/etc. → `browser`; no UI framework → `node`). Projects without `package.json` get `unknown` and all scoped runners are skipped.

| Runner                | Scope                          |
| --------------------- | ------------------------------ |
| `react-perf`          | Frameworks: react, next, remix |
| `asset-size`          | Runtime: browser               |
| `source-map-explorer` | Runtime: browser               |
| `node-security`       | Runtime: node                  |
| `node-async-errors`   | Runtime: node                  |
| `node-input-validation` | Runtime: node                |

**2. `isApplicable()` (async, can do I/O)**

Runners that need file-system checks before deciding whether to run:

| Runner               | Condition                                           |
| -------------------- | --------------------------------------------------- |
| `eslint`             | ESLint config file exists                           |
| `typescript`         | `tsconfig.json` exists                              |
| `git`                | `.git` directory exists                             |
| `coverage`           | Test runner in deps, OR `coverage-summary.json` exists |
| `todo-scanner`       | `src/` directory exists                             |
| `complexity`         | `src/` directory exists                             |
| `heavy-deps`         | `package.json` exists                               |
| `node-security`      | HTTP server framework in deps                       |
| `node-input-validation` | HTTP server framework in deps                    |

---

## JSON output structure

```typescript
interface SickbayReport {
  timestamp: string;
  projectPath: string;
  projectInfo: ProjectInfo;
  overallScore: number;        // 0–100, weighted average
  summary: {
    critical: number;
    warnings: number;
    info: number;
  };
  checks: CheckResult[];
}

interface CheckResult {
  id: string;                  // e.g. "npm-audit", "coverage"
  name: string;                // e.g. "Security Vulnerabilities"
  category: string;            // "dependencies" | "security" | "code-quality" | "performance" | "git"
  score: number;               // 0–100
  status: string;              // "pass" | "warning" | "fail" | "skipped"
  issues: Issue[];
  toolsUsed: string[];
  duration: number;            // milliseconds
  metadata?: Record<string, unknown>;  // check-specific data
}

interface Issue {
  severity: "critical" | "warning" | "info";
  message: string;
  file?: string;
  fix?: {
    description: string;
    command?: string;
  };
  reportedBy: string[];
}
```
