# Health Checks

Sickbay includes 21 checks across 5 categories. Each check is framework-aware — only checks relevant to your project type will run.

## How Applicability Works

Before running, each check is filtered in two phases:

1. **Declarative scope** — Runners declare `applicableRuntimes` (e.g., `node`, `browser`) or `applicableFrameworks` (e.g., `react`, `next`). Runtime is derived from your project's dependencies: React/Vue/Angular projects get `browser`, everything else gets `node`.
2. **`isApplicable()` check** — Some runners also inspect the filesystem (e.g., "does `tsconfig.json` exist?") before deciding to run.

Projects without a `package.json` get runtime `unknown` and all scoped runners are skipped.

---

## Dependencies <Badge type="info" text="25% weight" />

### Unused Code

- **Tool:** [knip](https://knip.dev)
- **Applies to:** All projects
- **What it detects:** Unused files, dependencies, devDependencies, exports, and types across the project.
- **Scoring:** `max(0, 100 - issueCount * 5)`. Pass at 0 issues, warning at 1--10, fail above 10.

::: details Issue severities
| Finding | Severity |
|---------|----------|
| Unused file | warning |
| Unused dependency | warning |
| Unused devDependency | info |
| Unused export | info |

`@testing-library/*` packages are suppressed when a test runner (vitest, jest) is detected to avoid false positives.
:::

### Dependency Health

- **Tool:** [depcheck](https://github.com/depcheck/depcheck)
- **Applies to:** All projects
- **What it detects:** Missing dependencies -- packages used in code but not declared in `package.json`. Unused dependency reporting is intentionally skipped since knip handles that more comprehensively.
- **Scoring:** `max(0, 100 - missingCount * 5)`. Fail if any missing dependencies exist. Virtual modules (`virtual:*`) and Node built-ins (`node:*`) are ignored.

### Outdated Packages

- **Tool:** `npm outdated` or `pnpm outdated`
- **Applies to:** All projects (skipped for yarn and bun)
- **What it detects:** Dependencies with newer versions available, distinguishing between major, minor, and patch updates.
- **Scoring:** `max(0, 100 - count * 3)`. Pass at 0 outdated, warning at 1--15, fail above 15. Major version bumps are `warning` severity; minor/patch are `info`.

### Heavy Dependencies

- **Tool:** Built-in package list analysis
- **Applies to:** All projects with a `package.json`
- **What it detects:** Known heavy or unnecessary packages that have lighter modern alternatives (e.g., `moment` -> `dayjs`, `lodash` -> `lodash-es`, `request` -> native `fetch`).
- **Scoring:** `max(30, 100 - warningCount * 10 - infoCount * 5)`. Score floor of 30.

::: details Flagged packages
| Package | Severity | Alternative |
|---------|----------|-------------|
| `moment` | warning | dayjs or date-fns |
| `moment-timezone` | warning | Intl.DateTimeFormat or date-fns-tz |
| `lodash` | warning | lodash-es or individual imports |
| `underscore` | warning | native JS methods |
| `jquery` | warning | native DOM APIs |
| `request` | warning | native fetch or undici |
| `axios` | info | native fetch (Node 18+) |
| `bluebird` | info | native Promises |
| `node-fetch` | info | native fetch (Node 18+) |
| `classnames` | info | clsx |
| `uuid` | info | crypto.randomUUID() |
| `left-pad` | info | String.prototype.padStart() |
| `is-even` / `is-odd` | info | n % 2 === 0 |
| `is-number` | info | typeof n === "number" |
| `rimraf` | info | fs.rm({ recursive: true }) |
| `mkdirp` | info | fs.mkdir({ recursive: true }) |
| `qs` | info | URLSearchParams |
:::

---

## Security <Badge type="warning" text="30% weight" />

### Security Vulnerabilities

- **Tool:** `npm audit`
- **Applies to:** All projects
- **What it detects:** Known security vulnerabilities in dependencies by querying the npm advisory database. Reports severity levels and whether automatic fixes are available.
- **Scoring:** If any critical/high vulnerabilities: `max(0, 60 - criticalCount * 15)`. Otherwise: `max(0, 100 - moderateCount * 10 - lowCount * 2)`. Critical/high findings are `critical` severity; moderate/low are `warning`.

### Secrets Detection

- **Tool:** Built-in regex scanner
- **Applies to:** All projects
- **What it detects:** Hardcoded secrets in source code -- AWS access keys, GitHub tokens, Slack tokens, Google API keys, Stripe live keys, PEM private keys, hardcoded passwords, API keys, and secrets. Also flags `.env` files not listed in `.gitignore`.
- **Scoring:** `max(0, 100 - count * 25)`. Any finding is a `fail` with `critical` severity. Skips comments, lines referencing `process.env` or `import.meta.env`, lock files, and test files.

### License Compliance

- **Tool:** [license-checker](https://github.com/davglass/license-checker)
- **Applies to:** All projects
- **What it detects:** Production dependencies using licenses that may be incompatible with commercial use: GPL-2.0, GPL-3.0, AGPL-3.0, LGPL-2.1, LGPL-3.0, CC-BY-NC.
- **Scoring:** `issues === 0 ? 100 : max(60, 100 - issues * 10)`. Score floor of 60. All flagged licenses are `warning` severity.

### Node Security Middleware

- **Tool:** Built-in dependency analysis
- **Applies to:** Node.js projects with an HTTP server framework (Express, Fastify, Koa, Hapi, NestJS, etc.)
- **What it detects:** Missing security middleware -- checks for helmet (security headers, +35 points), CORS middleware (+30 points), and rate limiting (+35 points).
- **Scoring:** Additive from 0. Score >= 80 passes, >= 50 warns, < 50 fails. Missing helmet is `critical`; missing CORS or rate limiting is `warning`.

---

## Code Quality <Badge type="tip" text="25% weight" />

### Lint

- **Tool:** [ESLint](https://eslint.org)
- **Applies to:** Projects with an ESLint config file (`.eslintrc.*` or `eslint.config.*`)
- **What it detects:** Linting errors and warnings across `src/`, `lib/`, and `app/` directories using the project's own ESLint configuration.
- **Scoring:** `max(0, 100 - errors * 5 - warnings * 0.5)`. Fail above 10 errors, warning if any errors or warnings exist, pass at 0.

### Code Duplication

- **Tool:** [jscpd](https://github.com/kucherenko/jscpd)
- **Applies to:** All projects
- **What it detects:** Duplicate code blocks in `src/`, reporting the duplication percentage and number of clones found.
- **Scoring:** `max(0, 100 - percentage * 3)`. Pass at 0--5% duplication, warning above 5%, fail above 20%.

### Type Safety

- **Tool:** `tsc` (TypeScript compiler)
- **Applies to:** Projects with a `tsconfig.json`
- **What it detects:** TypeScript type errors by running `tsc --noEmit`. Output is capped at 25 displayed errors.
- **Scoring:** `max(0, 100 - errorCount * 5)`. Pass at 0 errors, warning at 1--20, fail above 20.

### Technical Debt

- **Tool:** Built-in comment scanner
- **Applies to:** Projects with a `src/` directory
- **What it detects:** `TODO`, `FIXME`, and `HACK` comments in source files, categorized by type.
- **Scoring:** `max(50, 100 - count * 3)`. Score floor of 50. Warning if >5 FIXMEs/HACKs or >20 total comments. FIXME/HACK are `warning` severity; TODO is `info`.

### File Complexity

- **Tool:** Built-in line counter
- **Applies to:** Projects with a `src/` directory
- **What it detects:** Source files with high line counts that indicate complexity and maintenance challenges. Files >= 400 non-blank lines trigger `info`; >= 600 lines trigger `warning`.
- **Scoring:** `max(0, 100 - oversizedFiles * 10)`. Test files are excluded.

### Circular Dependencies

- **Tool:** [madge](https://github.com/pahen/madge)
- **Applies to:** All projects
- **What it detects:** Circular import cycles in `src/` by building a module dependency graph and performing depth-first search. Uses `tsconfig.app.json` if present (Vite projects), falling back to `tsconfig.json`.
- **Scoring:** `circles === 0 ? 100 : max(0, 100 - circles * 10)`. Pass at 0 cycles, warning at 1--5, fail above 5.

### Input Validation

- **Tool:** Built-in dependency analysis
- **Applies to:** Node.js projects with an HTTP server framework
- **What it detects:** Whether an input validation library is present in dependencies: zod, joi, express-validator, yup, ajv, @sinclair/typebox, or valibot.
- **Scoring:** Binary -- 85 (pass) if a validation library is found, 20 (warning) if not.

### Async Error Handling

- **Tool:** Built-in source code analysis
- **Applies to:** Node.js projects only
- **What it detects:** Async route handlers without try/catch protection, missing Express error handling middleware (4-parameter function), and whether `express-async-errors` is installed.
- **Scoring:** `min(100, round(protectedFiles / routeFiles * 80) + (hasErrorMiddleware ? 20 : 0))`. If `express-async-errors` is detected, scores 100 immediately. Score >= 80 passes, >= 50 warns, < 50 fails.

### Tests & Coverage

- **Tool:** Vitest or Jest (auto-detected)
- **Applies to:** Projects with a test runner in dependencies or an existing coverage report
- **What it detects:** Runs the project's test suite, captures pass/fail counts, and reads coverage percentages from `coverage/coverage-summary.json`.
- **Scoring:**
  ```
  baseScore = failedTests > 0 ? round(100 * passed / total) : 100
  score = coverageData ? round(baseScore * 0.6 + coverageAvg * 0.4) : baseScore
  ```
  Fail if any tests fail or line coverage < 50%. Warning if line coverage < 80%. Pass if all tests pass and line coverage >= 80%.

---

## Performance <Badge type="danger" text="15% weight" />

### Bundle Size

- **Tool:** [source-map-explorer](https://github.com/danvk/source-map-explorer) (with file-size fallback)
- **Applies to:** Browser projects only (requires `dist/` or `build/` directory)
- **What it detects:** JavaScript bundle sizes using source map analysis when `.js.map` files are present. Falls back to summing raw `.js` file sizes when source maps are unavailable.
- **Scoring:** <= 500KB scores 100 (pass), 500KB--1MB scores 70 (warning), > 1MB scores 40 (fail).

### React Performance

- **Tool:** Built-in JSX analyzer
- **Applies to:** React, Next.js, and Remix projects only
- **What it detects:** Common performance anti-patterns in `.tsx` and `.jsx` files: inline objects in JSX props, using array index as key in lists, large component files (> 400 lines), and route files without lazy loading.
- **Scoring:** `max(20, 100 - warnings * 3 - infos * 1)`. If the React Compiler is detected, inline object warnings are automatically suppressed.

### Asset Sizes

- **Tool:** Built-in file size scanner
- **Applies to:** Browser projects only
- **What it detects:** Oversized images, SVGs, and fonts in `public/`, `src/assets/`, `static/`, and `assets/` directories. Video/audio files are skipped.
- **Scoring:** `max(20, 100 - criticalCount * 20 - warningCount * 8)`.

::: details Per-file thresholds
| Asset type | Warning | Critical |
|-----------|---------|----------|
| Images (png, jpg, gif, webp, bmp, ico) | 500KB | 2MB |
| SVG | 100KB | -- |
| Fonts (woff, woff2, ttf, otf, eot) | 500KB | -- |
| **Total assets** | **5MB** | **10MB** |
:::

---

## Git <Badge type="info" text="5% weight" />

### Git Health

- **Tool:** `git` CLI
- **Applies to:** Repositories with a `.git` directory
- **What it detects:** Repository activity and hygiene -- last commit date, total commit count, contributor count, and remote branch count. Flags stale repos (last commit > 6 months ago) and excessive remote branches (> 20).
- **Scoring:** 100 if no issues, 80 if any issues found. Stale repo is `warning` severity; excessive branches is `info`.
