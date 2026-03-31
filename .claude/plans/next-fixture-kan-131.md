# Feature: Next.js Fixture + 6 Health Checks (KAN-131)

> **Roadmap Phase**: Phase 3 — Framework-specific runners
> **Blocked by**: Nothing. KAN-130 (Angular) is complete, establishing the exact pattern to follow.
> **Jira**: KAN-131 under epic KAN-5

Validate patterns and imports against the codebase before implementing. Pay close
attention to the ENOENT-safe file-walker pattern in `angular-change-detection.ts` and
the false-positive trap: fixture comments must NOT contain the literal strings the
runners search for.

## Feature Description

Add 6 Next.js-specific health checks plus an `fixtures/packages/next-app` test fixture
with intentional violations. Checks cover: raw image elements, raw anchor tags for
internal links, Google Fonts via HTML link (vs `next/font`), missing App Router
boundaries (`loading.tsx`/`error.tsx`), absent security headers config, and unnecessary
`"use client"` directives.

## User Story

As a Next.js developer running Sickbay,
I want framework-specific checks that catch Next.js anti-patterns,
So that I can improve performance, security, and bundle size without needing to
know every best-practice detail.

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: Medium
**Packages Affected**: `core` only (no types.ts changes, no CLI/web changes except `About.tsx` descriptions)
**New npm Dependencies**: none — all checks are pure file analysis
**Touches `types.ts`**: No
**Touches `About.tsx`**: Yes — add 6 entries to `CHECK_DESCRIPTIONS`

---

## CONTEXT REFERENCES

### Files to Read Before Implementing

- `packages/core/src/integrations/angular-change-detection.ts` — primary pattern reference: file walker with ENOENT-safe `isRoot` flag, `statSync` in try/catch, metadata shape
- `packages/core/src/integrations/angular-lazy-routes.ts` — secondary pattern reference: topLevel flag variant, inline try/catch in readdirSync calls
- `packages/core/src/integrations/base.ts` — `BaseRunner` interface, `applicableFrameworks` field, `skipped()` helper
- `packages/core/src/runner.ts` lines 53–79 — `ALL_RUNNERS` array, import order
- `packages/core/src/utils/detect-project.ts` lines 97–138 — `detectContext()` confirms `'next' in allDeps` pushes `['react', 'next']` into frameworks
- `packages/core/src/integrations/angular-change-detection.test.ts` — test structure to mirror: vi.mock('fs'), vi.mock('../utils/file-helpers.js'), applicableFrameworks assertion, pass/warning/scoring/error cases
- `tests/snapshots/fixture-regression.test.ts` lines 208–311 — `angular-app` describe block is the exact pattern for `next-app` snapshot tests
- `apps/web/src/components/About.tsx` lines 25–52 — `CHECK_DESCRIPTIONS` map to extend
- `fixtures/README.md` — document new fixture here
- `fixtures/packages/angular-app/` — reference fixture structure

### New Files to Create

**Runners (6):**

- `packages/core/src/integrations/next-images.ts`
- `packages/core/src/integrations/next-link.ts`
- `packages/core/src/integrations/next-fonts.ts`
- `packages/core/src/integrations/next-missing-boundaries.ts`
- `packages/core/src/integrations/next-security-headers.ts`
- `packages/core/src/integrations/next-client-components.ts`

**Tests (6):**

- `packages/core/src/integrations/next-images.test.ts`
- `packages/core/src/integrations/next-link.test.ts`
- `packages/core/src/integrations/next-fonts.test.ts`
- `packages/core/src/integrations/next-missing-boundaries.test.ts`
- `packages/core/src/integrations/next-security-headers.test.ts`
- `packages/core/src/integrations/next-client-components.test.ts`

**Fixture:**

- `fixtures/packages/next-app/package.json`
- `fixtures/packages/next-app/tsconfig.json`
- `fixtures/packages/next-app/next.config.js`
- `fixtures/packages/next-app/app/layout.tsx`
- `fixtures/packages/next-app/app/page.tsx`
- `fixtures/packages/next-app/app/about/page.tsx`
- `fixtures/packages/next-app/app/dashboard/page.tsx`
- `fixtures/packages/next-app/app/components/StaticHeader.tsx`

### Patterns to Follow

**Runner structure:**

```typescript
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { timer } from '../utils/file-helpers.js';
import { BaseRunner } from './base.js';
import type { CheckResult, Issue } from '../types.js';

export class NextImagesRunner extends BaseRunner {
  name = 'next-images';
  category = 'performance' as const;
  applicableFrameworks = ['next'] as const; // ← 'next', not 'react'

  async run(projectPath: string): Promise<CheckResult> {
    const elapsed = timer();
    try {
      // ... logic ...
    } catch (err) {
      return {
        id: this.name,
        category: this.category,
        name: 'Next.js Images',
        score: 0,
        status: 'fail',
        issues: [
          { severity: 'critical', message: `Check failed: ${err}`, reportedBy: [this.name] },
        ],
        toolsUsed: [this.name],
        duration: elapsed(),
      };
    }
  }
}
```

**File walker (ENOENT-safe, statSync-guarded):**

```typescript
function findTsxFiles(dir: string, projectRoot: string, isRoot = true): FileEntry[] {
  const files: FileEntry[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const fullPath = join(dir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        files.push(...findTsxFiles(fullPath, projectRoot, false));
      } else if (entry.endsWith('.tsx') || entry.endsWith('.jsx')) {
        files.push({ relPath: fullPath.replace(projectRoot + '/', ''), fullPath });
      }
    }
  } catch (err) {
    if (isRoot) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw err;
    }
  }
  return files;
}
```

**Test structure:**

```typescript
vi.mock('fs', () => ({ readdirSync: vi.fn(), statSync: vi.fn(), readFileSync: vi.fn() }));
vi.mock('../utils/file-helpers.js', () => ({ timer: vi.fn(() => () => 100) }));
// Import mocked fs AFTER vi.mock calls
import { readdirSync, statSync, readFileSync } from 'fs';
```

**Naming conventions:** kebab-case files (`next-images.ts`), PascalCase class (`NextImagesRunner`), check ID matches file name.

---

## IMPLEMENTATION PLAN

### Phase 1: Core Runners (6 runners)

No type changes needed. All runners are pure file analysis, no external tools.

#### Runner 1: `next-images`

**What it checks:** Raw `<img` elements in `.tsx`/`.jsx` files instead of `next/image`.

**Detection:** Regex `/[<]img[\s>]/` in file content (matches `<img ` and `<img>`).

**Scoring:** `Math.max(20, 100 - violations * 10)`

**Severity:** `warning`

**Fix description:** "Replace `<img>` with the `<Image>` component from `next/image` for automatic optimization, lazy loading, and Core Web Vitals improvements."

**Directories to scan:** `join(projectPath, 'app')` and `join(projectPath, 'src')` — use two separate `findTsxFiles` calls, silently skip missing dirs.

**GOTCHA:** The fixture comment about this must say "raw image element" or similar — NOT `<img` — to avoid false positives from comment scanning.

#### Runner 2: `next-link`

**What it checks:** Raw `<a href="...">` for internal links (starting with `/` or `./`) in `.tsx`/`.jsx` files.

**Detection:** Regex `/<a\s[^>]*href=["'](\/|\.\/)/` — matches `<a href="/about">` and `<a href="./dashboard">` but NOT `<a href="https://example.com">`.

**Scoring:** `Math.max(20, 100 - violations * 15)`

**Severity:** `warning`

**Fix description:** "Replace `<a href=\"/path\">` with `<Link href=\"/path\">` from `next/link` to enable client-side navigation and prefetching."

**Directories:** same as next-images.

**GOTCHA:** Fixture comments must not contain `<a href="/"` or similar patterns.

#### Runner 3: `next-fonts`

**What it checks:** Google Fonts loaded via HTML `<link>` tags in layout files, instead of `next/font/google`.

**Detection:** Look for the string `fonts.googleapis.com` OR `fonts.gstatic.com` in a targeted list of layout files:

- `app/layout.tsx`, `app/layout.jsx`
- `src/app/layout.tsx`, `src/app/layout.jsx`
- `pages/_document.tsx`, `pages/_document.jsx`, `pages/_document.js`
- `src/pages/_document.tsx`, `src/pages/_document.jsx`

Read each that exists; flag if it contains the font domain strings.

**Scoring:** Binary — either pass (100) or warning (40) per file found.
Use `Math.max(40, 100 - found.length * 30)`.

**Severity:** `warning`

**Fix description:** "Use `next/font/google` instead of a `<link>` stylesheet to self-host fonts and improve Core Web Vitals (eliminates render-blocking request)."

**GOTCHA:** Fixture comment in `layout.tsx` must NOT contain `fonts.googleapis.com` or `fonts.gstatic.com`. Use "Google Fonts loaded via external stylesheet" in the comment.

#### Runner 4: `next-missing-boundaries`

**What it checks:** App Router route segments (directories containing `page.tsx`) that are missing `loading.tsx` and/or `error.tsx` siblings.

**Detection:**

1. Walk `app/` directory (or `src/app/`)
2. For each subdirectory (not the root `app/` itself) that contains `page.tsx` or `page.jsx`:
   - Check for `loading.tsx` or `loading.jsx` in the same dir
   - Check for `error.tsx` or `error.jsx` in the same dir
   - Flag each missing file as a separate issue

**Why skip root:** `app/page.tsx` is the homepage — missing loading/error there is common and less impactful. Only nested route segments benefit significantly from boundaries.

**Scoring:** `Math.max(20, 100 - missingCount * 15)`

**Severity:** `info` — this is a best-practice improvement, not a bug.

**Fix description for loading:** "Add `loading.tsx` to show a skeleton UI while this route's data loads (App Router Suspense boundary)."
**Fix description for error:** "Add `error.tsx` to gracefully handle errors in this route segment (must be a Client Component with `'use error'` not needed — just add `'use client'` at top)."

**GOTCHA:** Walk only direct subdirs of `app/` for the first pass to avoid excessive noise on deeply nested segments. Or walk all levels but cap at depth 3.

Actually — walk all depths but skip root level. The "root level" is the `app/` directory itself.

#### Runner 5: `next-security-headers`

**What it checks:** Whether `next.config.js`/`.mjs`/`.ts` defines an `async headers()` function with key security headers.

**Detection (step 1):** Read `next.config.js`, `next.config.mjs`, `next.config.ts` from `projectPath`. If none exists: score 0, status `fail`, issue "No Next.js config file found".

**Detection (step 2):** If config file exists but has no `async headers(` pattern: score 30, issue "Missing `headers()` config — security headers (CSP, X-Frame-Options, etc.) are not set."

**Detection (step 3):** If `headers()` is present, check for specific header names in the content:

- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
  Score: `Math.max(40, 100 - missingHeaders.length * 15)`

**Pattern for detecting headers() function:** `/async\s+headers\s*\(\s*\)/` — requires `async` keyword + `headers` + `()`. A comment like `// no security headers config` does NOT match.

**Severity:** `warning` for missing headers() entirely, `info` for individual missing header names.

**GOTCHA:** Fixture `next.config.js` comment must NOT say `async headers()` or `headers()`. Use "response header customization is not configured" in the comment.

#### Runner 6: `next-client-components`

**What it checks:** Files with `"use client"` directive but no hooks or event handlers — meaning they don't actually need to be client components.

**Detection:**

1. Walk `app/` and `src/` for `.tsx`/`.jsx` files
2. Read content; trim it
3. Check if trimmed content starts with `"use client"` or `'use client'` (the directive MUST be first statement)
4. If yes, check for absence of any of: `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`, `useContext`, `useReducer`, and no `on[A-Z]` event handler pattern (`/\bon[A-Z][a-zA-Z]*=\{/`)
5. If a file has `"use client"` but none of these — it likely doesn't need it

**Scoring:** `Math.max(20, 100 - unnecessary * 15)`

**Severity:** `warning`

**Fix description:** "This component may not need `\"use client\"` — it contains no hooks or event handlers. Moving it to a Server Component reduces client bundle size."

**Issue message wording:** "... may not need 'use client' — no hooks or event handlers detected" (soft language, not definitive).

**GOTCHA:** The fixture file `StaticHeader.tsx` MUST start with the `"use client"` directive as the very first line (before any comments). Do NOT put a comment before the directive, as the trimmed detection would miss it. The comment explaining the intentional issue goes AFTER the directive.

---

### Phase 2: Register Runners in `runner.ts`

**ADD** 6 imports after the Angular runner imports (alphabetical within framework block):

```typescript
import { NextClientComponentsRunner } from './integrations/next-client-components.js';
import { NextFontsRunner } from './integrations/next-fonts.js';
import { NextImagesRunner } from './integrations/next-images.js';
import { NextLinkRunner } from './integrations/next-link.js';
import { NextMissingBoundariesRunner } from './integrations/next-missing-boundaries.js';
import { NextSecurityHeadersRunner } from './integrations/next-security-headers.js';
```

**ADD** to `ALL_RUNNERS` array after the Angular runners:

```typescript
new NextImagesRunner(),
new NextLinkRunner(),
new NextFontsRunner(),
new NextMissingBoundariesRunner(),
new NextSecurityHeadersRunner(),
new NextClientComponentsRunner(),
```

---

### Phase 3: About.tsx Descriptions

**ADD** 6 entries to `CHECK_DESCRIPTIONS` in `apps/web/src/components/About.tsx`:

```typescript
'next-images': 'Detects raw <img> elements that should use the next/image component for automatic optimization.',
'next-link': 'Finds raw <a> tags used for internal navigation that should use next/link for client-side routing.',
'next-fonts': 'Detects Google Fonts loaded via HTML link tags instead of next/font/google for self-hosting.',
'next-missing-boundaries': 'Checks App Router route segments for missing loading.tsx and error.tsx boundary files.',
'next-security-headers': 'Verifies that next.config.js defines security headers (CSP, X-Frame-Options, etc.).',
'next-client-components': 'Flags "use client" components with no hooks or event handlers that may not need client rendering.',
```

---

### Phase 4: Fixture Files

All files go in `fixtures/packages/next-app/`. The `fixtures/pnpm-workspace.yaml` already uses `packages/*` glob — no changes needed there.

#### `fixtures/packages/next-app/package.json`

```json
{
  "name": "next-app",
  "version": "0.0.1",
  "description": "Next.js test fixture for Sickbay — intentionally unhealthy",
  "private": true,
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "~5.4.0"
  }
}
```

**Note:** After creating the fixture, run `pnpm install` from `fixtures/` to update the lockfile and create `node_modules`.

#### `fixtures/packages/next-app/tsconfig.json`

Standard Next.js tsconfig:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

#### `fixtures/packages/next-app/next.config.js`

```js
// Intentional: no response header customization is configured.
// This triggers the next-security-headers check.
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
```

#### `fixtures/packages/next-app/app/layout.tsx`

```tsx
// Intentional: Google Fonts loaded via external stylesheet link.
// This triggers the next-fonts check.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

#### `fixtures/packages/next-app/app/page.tsx`

```tsx
// Intentional issues:
// 1. Raw image element used instead of the optimized image component — triggers next-images.
// 2. Raw anchor tag used for internal navigation — triggers next-link.
export default function HomePage() {
  return (
    <main>
      <h1>Welcome</h1>
      <img src="/hero.jpg" alt="Hero" width={800} height={400} />
      <nav>
        <a href="/about">About</a>
        <a href="/dashboard">Dashboard</a>
      </nav>
    </main>
  );
}
```

#### `fixtures/packages/next-app/app/about/page.tsx`

```tsx
// Intentional: route segment has no loading or error boundary files.
// This triggers the next-missing-boundaries check.
export default function AboutPage() {
  return <div>About</div>;
}
```

#### `fixtures/packages/next-app/app/dashboard/page.tsx`

```tsx
// Intentional: route segment has no loading or error boundary files.
// This triggers the next-missing-boundaries check.
export default function DashboardPage() {
  return <div>Dashboard</div>;
}
```

#### `fixtures/packages/next-app/app/components/StaticHeader.tsx`

```tsx
'use client';

// Intentional: this component has no hooks and no event handlers.
// Marking it as a client-only module is unnecessary — triggers next-client-components.
export function StaticHeader() {
  return (
    <header>
      <h1>My App</h1>
      <nav>Home | About | Dashboard</nav>
    </header>
  );
}
```

---

### Phase 5: Snapshot Tests

**UPDATE** `tests/snapshots/fixture-regression.test.ts`

Add a `describe('next-app', ...)` block following the exact pattern of `describe('angular-app', ...)` (lines 208–311). The 6 Next.js checks all produce deterministic results on static files, so they get **structural assertions** (not full snapshots — consistent with the Angular block approach):

```typescript
describe('next-app', () => {
  let report: SickbayReport;

  beforeAll(async () => {
    report = await runSickbay({
      projectPath: resolve(FIXTURES_DIR, 'next-app'),
    });
  }, 120_000);

  it('projectInfo', () => {
    expect(normalizeProjectInfo(report.projectInfo)).toMatchSnapshot();
  });

  const NEXT_CHECKS = [
    { id: 'next-images', category: 'performance' },
    { id: 'next-link', category: 'performance' },
    { id: 'next-fonts', category: 'performance' },
    { id: 'next-missing-boundaries', category: 'code-quality' },
    { id: 'next-security-headers', category: 'security' },
    { id: 'next-client-components', category: 'performance' },
  ];

  for (const { id, category } of NEXT_CHECKS) {
    it(`${id} runs and is not skipped`, () => {
      const check = report.checks.find((c) => c.id === id);
      expect(check).toBeDefined();
      expect(check?.status).not.toBe('skipped');
      expect(check?.category).toBe(category);
      expect(check?.score).toBeGreaterThanOrEqual(0);
      expect(check?.score).toBeLessThanOrEqual(100);
    });
  }

  // Each check should detect the intentional violations we baked in
  it('next-images reports raw image elements', () => {
    const check = report.checks.find((c) => c.id === 'next-images');
    expect(check?.status).toBe('warning');
    expect(check?.issues.length).toBeGreaterThan(0);
  });

  it('next-link reports raw anchor tags for internal links', () => {
    const check = report.checks.find((c) => c.id === 'next-link');
    expect(check?.status).toBe('warning');
    expect(check?.issues.length).toBeGreaterThan(0);
  });

  it('next-fonts reports external font stylesheet', () => {
    const check = report.checks.find((c) => c.id === 'next-fonts');
    expect(check?.status).toBe('warning');
    expect(check?.issues.length).toBeGreaterThan(0);
  });

  it('next-missing-boundaries reports route segments without boundaries', () => {
    const check = report.checks.find((c) => c.id === 'next-missing-boundaries');
    expect(check?.status).not.toBe('pass');
    expect(check?.issues.length).toBeGreaterThan(0);
  });

  it('next-security-headers reports missing security config', () => {
    const check = report.checks.find((c) => c.id === 'next-security-headers');
    expect(check?.status).not.toBe('pass');
    expect(check?.issues.length).toBeGreaterThan(0);
  });

  it('next-client-components reports unnecessary use-client directives', () => {
    const check = report.checks.find((c) => c.id === 'next-client-components');
    expect(check?.status).toBe('warning');
    expect(check?.issues.length).toBeGreaterThan(0);
  });

  // Framework exclusions
  it('angular-change-detection is absent or skipped', () => {
    const check = report.checks.find((c) => c.id === 'angular-change-detection');
    if (check) expect(check.status).toBe('skipped');
  });

  it('node-security is absent or skipped', () => {
    const check = report.checks.find((c) => c.id === 'node-security');
    if (check) expect(check.status).toBe('skipped');
  });

  // Environment-sensitive checks
  for (const { id, category } of ENVIRONMENT_SENSITIVE_CHECKS) {
    it(`${id} has valid structure`, () => assertUnstableCheck(report, id, category));
  }

  it('overall score is in expected range', () => {
    expect(report.overallScore).toBeGreaterThanOrEqual(20);
    expect(report.overallScore).toBeLessThanOrEqual(90);
  });

  it('summary shape', () => {
    expect(report.summary).toMatchObject({
      critical: expect.any(Number),
      warnings: expect.any(Number),
      info: expect.any(Number),
    });
  });

  it('checks array exists', () => {
    expect(Array.isArray(report.checks)).toBe(true);
    expect(report.checks.length).toBeGreaterThan(0);
  });
});
```

---

### Phase 6: Update `fixtures/README.md`

**ADD** a new `next-app` section documenting the fixture, its intentional issues, and expected score range — following the angular-app section pattern.

---

## STEP-BY-STEP TASKS

Execute in order.

### CREATE `packages/core/src/integrations/next-images.ts`

- **IMPLEMENT**: Walk `app/` and `src/` dirs for `.tsx`/`.jsx`; detect `/<img[\s>]/` in file content
- **PATTERN**: `angular-change-detection.ts` — ENOENT-safe walker with `isRoot` flag and `statSync` in try/catch
- **SCORING**: `Math.max(20, 100 - violations.length * 10)`
- **GOTCHA**: Fixture comment in `app/page.tsx` must say "raw image element" NOT contain `<img`

### CREATE `packages/core/src/integrations/next-images.test.ts`

- **IMPLEMENT**: Mock `fs` + `file-helpers`; test applicableFrameworks, pass/warning/scoring/error cases
- **PATTERN**: `angular-change-detection.test.ts` — same vi.mock structure

### CREATE `packages/core/src/integrations/next-link.ts`

- **IMPLEMENT**: Walk same dirs; detect `/<a\s[^>]*href=["'](\/|\.\/)/` (internal hrefs only)
- **SCORING**: `Math.max(20, 100 - violations.length * 15)`
- **GOTCHA**: Do NOT flag external links (`http://`, `https://`)

### CREATE `packages/core/src/integrations/next-link.test.ts`

- Test internal link detection; verify external links are NOT flagged

### CREATE `packages/core/src/integrations/next-fonts.ts`

- **IMPLEMENT**: Check a fixed list of layout file paths for `fonts.googleapis.com` or `fonts.gstatic.com`
- **PATTERN**: No file walker needed — check specific known paths with `existsSync` + `readFileSync`
- **SCORING**: `Math.max(40, 100 - found.length * 30)`
- **GOTCHA**: Fixture comment must NOT mention the font domain strings

### CREATE `packages/core/src/integrations/next-fonts.test.ts`

- Test with mock `existsSync` and `readFileSync`; pass when no font links; warning when found

### CREATE `packages/core/src/integrations/next-missing-boundaries.ts`

- **IMPLEMENT**: Walk `app/` and `src/app/` dirs; for each non-root subdir containing `page.tsx`/`page.jsx`, check for `loading.tsx`/`loading.jsx` and `error.tsx`/`error.jsx` siblings
- **SCORING**: `Math.max(20, 100 - missingCount * 15)`
- **SEVERITY**: `info`
- **GOTCHA**: Skip the root `app/` level itself; only check subdirectories

### CREATE `packages/core/src/integrations/next-missing-boundaries.test.ts`

- Test: segment with both boundaries → pass; segment missing loading → issue; segment missing error → issue; root level not flagged

### CREATE `packages/core/src/integrations/next-security-headers.ts`

- **IMPLEMENT**: Try reading `next.config.js`, `next.config.mjs`, `next.config.ts` in order; check for `/async\s+headers\s*\(\s*\)/` pattern; if present also check for 4 header name strings
- **PATTERN**: `existsSync` checks, `readFileSync` on first found config file
- **SCORING**: 30 if headers() absent; `Math.max(40, 100 - missing * 15)` if headers() present but specific headers missing
- **GOTCHA**: Pattern must be `/async\s+headers\s*\(\s*\)/` — NOT just `headers` — to avoid false positive from comments

### CREATE `packages/core/src/integrations/next-security-headers.test.ts`

- Mock `fs`; test: no config file → fail; config without headers() → warning; config with headers() + all headers → pass; partial headers → warning

### CREATE `packages/core/src/integrations/next-client-components.ts`

- **IMPLEMENT**: Walk `app/` and `src/`; for each `.tsx`/`.jsx`, check if `content.trim()` starts with `"use client"` or `'use client'`; if so check for absence of hooks/handlers
- **HOOKS to check**: `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`, `useContext`, `useReducer`
- **HANDLERS to check**: `/\bon[A-Z][a-zA-Z]*=\{/`
- **SCORING**: `Math.max(20, 100 - unnecessary.length * 15)`
- **GOTCHA**: Fixture `StaticHeader.tsx` MUST have `"use client"` as the very first line (before any comments)

### CREATE `packages/core/src/integrations/next-client-components.test.ts`

- Test: no use-client files → pass; file with use-client + useState → pass (has hooks); file with use-client + no hooks/handlers → warning; issue message uses "may not need" wording

### UPDATE `packages/core/src/runner.ts`

- **ADD** 6 imports in the Angular runner block (keep alphabetical by runner name within next group)
- **ADD** 6 instances to `ALL_RUNNERS` array after Angular runners

### CREATE fixture files

- Execute in order: `package.json`, `tsconfig.json`, `next.config.js`, `app/layout.tsx`, `app/page.tsx`, `app/about/page.tsx`, `app/dashboard/page.tsx`, `app/components/StaticHeader.tsx`
- **VALIDATE**: `pnpm install` from `fixtures/` directory

### UPDATE `tests/snapshots/fixture-regression.test.ts`

- **ADD** `describe('next-app', ...)` block at end of file

### UPDATE `apps/web/src/components/About.tsx`

- **ADD** 6 entries to `CHECK_DESCRIPTIONS`
- **VALIDATE**: No value imports from core added

### UPDATE `fixtures/README.md`

- **ADD** `next-app` section with fixture description, intentional issues table, expected score range

---

## VALIDATION COMMANDS

### Level 1: Type checking

```bash
pnpm --filter @nebulord/sickbay-core build
pnpm --filter @nebulord/sickbay-web build
pnpm lint
```

### Level 2: Unit tests

```bash
pnpm --filter @nebulord/sickbay-core test
```

### Level 3: Snapshot tests

```bash
pnpm test:snapshots
# Expect: 6 new next-app test cases to generate new snapshots on first run
# Re-run to confirm snapshots are stable
```

### Level 4: Manual validation

```bash
pnpm build
node apps/cli/dist/index.js --path fixtures/packages/next-app
# Expect: next-images, next-link, next-fonts, next-missing-boundaries,
#         next-security-headers, next-client-components all show warnings
# Expect: angular-* checks do NOT appear
# Expect: react-perf DOES appear (next is a superset of react)
```

---

## ACCEPTANCE CRITERIA

- [ ] All 6 runners created with `applicableFrameworks = ['next'] as const`
- [ ] All 6 runners registered in `ALL_RUNNERS` in `runner.ts`
- [ ] All 6 runners have colocated unit tests
- [ ] `fixtures/packages/next-app/` created with all intentional violations
- [ ] `pnpm install` run in `fixtures/` to update lockfile
- [ ] All 6 checks fire on the fixture (not skipped)
- [ ] Each check correctly detects its intentional violation
- [ ] Angular-specific checks do NOT fire on the Next.js fixture
- [ ] Snapshot tests pass (`pnpm test:snapshots`)
- [ ] `CHECK_DESCRIPTIONS` updated in `About.tsx`
- [ ] `fixtures/README.md` updated
- [ ] `pnpm build` passes (all packages)
- [ ] `pnpm test` passes for core + web
- [ ] `pnpm lint` passes
- [ ] No value imports from core added to web

---

## MONOREPO FUTURE-PROOFING NOTES

These runners follow the same scoping pattern as Angular runners — they operate on a
single `projectPath`. The monorepo runner wraps `runSickbay` per package, so Next.js
checks in a monorepo with a Next.js package will naturally scope to that package only.
No changes needed for Phase 3 monorepo support.

---

## NOTES

### Why `applicableFrameworks = ['next']` and not `['react', 'next']`?

`isApplicableToContext` does `.some()` — so declaring `['next']` means "only run when
`next` is in the frameworks list." Since `detectContext` only pushes `'next'` when
`'next'` is in deps (not for plain React), this correctly scopes all 6 runners to
Next.js projects only.

### Why not snapshot the scores?

Next.js ecosystem tooling changes (eslint rules, type definitions) can cause score
drift between environments. Structural assertions ("check ran and found violations")
are stable where exact scores aren't. This is the same decision made for the
Angular fixture.

### `react-perf` on Next.js fixtures

`react-perf` has `applicableFrameworks = ['react']` (or similar). Next.js projects
have `'react'` in their frameworks array. So `react-perf` WILL run on the Next.js
fixture — this is correct and expected behavior. The snapshot tests should not assert
that react-perf is absent.

### `next-security-headers` config file search order

Check `next.config.js` first (most common), then `.mjs`, then `.ts`. Use the first
one found. If none exists, that itself is an issue (return fail with a specific message).

### `next-missing-boundaries` depth

Walk the `app/` tree to arbitrary depth but skip root level. A deeply nested segment
like `app/dashboard/settings/profile/page.tsx` missing boundaries is less impactful,
but the check is cheap and the signal is valid. Cap at reasonable depth if performance
becomes an issue.
