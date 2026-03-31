# Sickbay Test Fixtures

A pnpm monorepo of intentionally flawed projects for testing Sickbay against real-world scenarios. Running Sickbay against this workspace tests both monorepo detection and per-package analysis.

## Structure

```
fixtures/
├── pnpm-workspace.yaml
├── package.json
└── packages/
    ├── react-app/     — Vite + React + TypeScript app (moderately healthy)
    └── node-api/      — Express REST API (intentionally broken)
```

## Running Sickbay Against the Fixtures

```bash
# Full monorepo (tests monorepo detection — Phase 3)
sickbay --path fixtures/

# Standalone React app
sickbay --path fixtures/packages/react-app

# Standalone Node API (expect a low score)
sickbay --path fixtures/packages/node-api

# With web dashboard
sickbay --path fixtures/packages/node-api --web
```

---

## Packages

### `react-app` — Vite + React + TypeScript

A moderately healthy React app. Has tests, ESLint, and TypeScript configured. Intentional issues include heavy dependencies (`moment`, `lodash`, `jquery`, `faker`) and some outdated packages. Useful for verifying React-specific checks fire correctly and healthy checks don't false-positive.

**Expect:** warnings on heavy deps and outdated packages; passes on most code quality checks.

### `node-api` — Express REST API

A deliberately broken Node.js REST API. Used to verify that Sickbay catches a broad range of real issues and that Node-appropriate checks run instead of React-specific ones.

**Intentional issues baked in:**

| Check             | What's broken                                                                  |
| ----------------- | ------------------------------------------------------------------------------ |
| `secrets`         | Hardcoded AWS keys, Stripe secret, JWT secret in `src/config.js`               |
| `npm-audit`       | `jsonwebtoken@8.5.1` has known CVEs                                            |
| `outdated`        | `axios@0.27`, `mongoose@6`, `dotenv@14`, `nodemon@2` — all well behind current |
| `madge`           | Circular dependency: `src/utils/helpers.js` ↔ `src/utils/format.js`            |
| `jscpd`           | `processUserData` and `processAdminData` in `helpers.js` are near-identical    |
| `complexity`      | 4-level nested conditionals in `processUserData`                               |
| `todo-scanner`    | ~12 TODO/FIXME comments across routes and helpers                              |
| `depcheck`/`knip` | `colors` and `left-pad` in `package.json` but never imported                   |
| `coverage`        | No test files                                                                  |
| `heavy-deps`      | `moment`, `lodash`, `mongoose`                                                 |

**Expect:** a low overall score with failures across most categories.

### `angular-app` — Angular v17+ Standalone

A modern Angular app using standalone components. Has intentional issues to verify Angular-specific checks fire correctly.

**Expect:** warnings on missing OnPush, static routes, disabled strict mode, and unguarded subscriptions; passes on generic code quality checks.

| Check | What's broken |
| --- | --- |
| `angular-change-detection` | All 4 components omit `ChangeDetectionStrategy.OnPush` |
| `angular-lazy-routes` | All routes use `component:` (static), none use `loadComponent:` |
| `angular-strict` | `strict: false` in tsconfig; no `angularCompilerOptions` block |
| `angular-subscriptions` | `user-list` and `product-card` subscribe without cleanup |

### `next-app` — Next.js 14 App Router

A Next.js 14 App Router project with intentional issues to verify Next.js-specific checks fire correctly.

**Expect:** warnings on raw image elements, raw anchor tags, external Google Fonts, missing route boundaries, absent security headers, and unnecessary client components.

| Check | What's broken |
| --- | --- |
| `next-images` | `app/page.tsx` uses raw image elements instead of next/image component |
| `next-link` | `app/page.tsx` uses raw anchor tags for internal navigation instead of next/link |
| `next-fonts` | `app/layout.tsx` loads Google Fonts via an external stylesheet link |
| `next-missing-boundaries` | `app/about/` and `app/dashboard/` route segments have no loading or error boundary files |
| `next-security-headers` | `next.config.js` has no response header customization |
| `next-client-components` | `app/components/StaticHeader.tsx` has use-client directive but no hooks or event handlers |

---

## Adding a New Fixture

1. Create a new package under `fixtures/packages/<name>/`
2. Add a `package.json` with a unique `name` field
3. Run `pnpm install` from the `fixtures/` root to update the workspace lockfile
4. Add intentional issues relevant to the framework/runtime you're testing
5. Document what the fixture tests and what score range to expect in this README

Each fixture should test a specific scenario — avoid making a fixture that's just a clean healthy project (the react-app already covers that baseline). The goal is to verify Sickbay catches real problems, not to show off a green dashboard.

