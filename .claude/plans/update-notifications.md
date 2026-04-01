# Update Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a non-blocking update notification when a newer version of `sickbay` exists on npm.

**Architecture:** A background fetch to the npm registry on CLI startup, cached for 24 hours in `~/.sickbay/update-check.json`. If a newer version is found, render a boxed Ink component between the header and scan progress. Shown on default scan, `--web`, and `tui` only.

**Tech Stack:** Node built-in `fetch`, Ink (React for terminals), Vitest

**Spec:** `docs/superpowers/specs/2026-04-01-update-notifications-design.md`

**Note:** The spec was written before publishing was simplified. The version source is now `__VERSION__` (build-time constant from tsup), not `createRequire`. The npm package name is `sickbay` (no scope). These are already correct in the spec's registry URL.

---

### Task 1: Core update-check logic with tests

**Files:**

- Create: `apps/cli/src/lib/update-check.ts`
- Create: `apps/cli/src/lib/update-check.test.ts`

- [ ] **Step 1: Write tests for `isNewerVersion`**

Create `apps/cli/src/lib/update-check.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

import { isNewerVersion } from './update-check.js';

describe('isNewerVersion', () => {
  it('returns true when latest has higher major', () => {
    expect(isNewerVersion('1.3.1', '2.0.0')).toBe(true);
  });

  it('returns true when latest has higher minor', () => {
    expect(isNewerVersion('1.3.1', '1.4.0')).toBe(true);
  });

  it('returns true when latest has higher patch', () => {
    expect(isNewerVersion('1.3.1', '1.3.2')).toBe(true);
  });

  it('returns false when versions are equal', () => {
    expect(isNewerVersion('1.3.1', '1.3.1')).toBe(false);
  });

  it('returns false when current is newer', () => {
    expect(isNewerVersion('2.0.0', '1.3.1')).toBe(false);
  });

  it('returns false for invalid version strings', () => {
    expect(isNewerVersion('1.3.1', 'not-a-version')).toBe(false);
    expect(isNewerVersion('bad', '1.3.1')).toBe(false);
  });

  it('strips prerelease suffix before comparing', () => {
    expect(isNewerVersion('1.3.1', '1.4.0-beta.1')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter sickbay test -- --reporter=verbose update-check
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `isNewerVersion`**

Create `apps/cli/src/lib/update-check.ts`:

```typescript
/**
 * Non-blocking update check against the npm registry.
 * Caches results in ~/.sickbay/update-check.json with a 24-hour TTL.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
}

interface UpdateCache {
  latestVersion: string;
  checkedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REGISTRY_URL = 'https://registry.npmjs.org/sickbay/latest';

function getCacheFilePath(): string {
  return join(homedir(), '.sickbay', 'update-check.json');
}

/**
 * Compare two semver version strings (major.minor.patch).
 * Returns true if `latest` is newer than `current`.
 * Strips prerelease suffixes before comparing.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string): number[] | null => {
    const clean = v.split('-')[0]; // strip prerelease
    const parts = clean.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return parts;
  };

  const c = parse(current);
  const l = parse(latest);
  if (!c || !l) return false;

  for (let i = 0; i < 3; i++) {
    if (l[i] > c[i]) return true;
    if (l[i] < c[i]) return false;
  }
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter sickbay test -- --reporter=verbose update-check
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Write tests for `checkForUpdate`**

Add to `apps/cli/src/lib/update-check.test.ts`:

```typescript
import { vi, beforeEach } from 'vitest';

import { checkForUpdate } from './update-check.js';

// Mock fs and fetch
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { existsSync, readFileSync, writeFileSync } from 'fs';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);

describe('checkForUpdate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns null when cache is fresh and versions match', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ latestVersion: '1.3.1', checkedAt: Date.now() }),
    );

    const result = await checkForUpdate('1.3.1');
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns update info when cache shows newer version', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ latestVersion: '2.0.0', checkedAt: Date.now() }),
    );

    const result = await checkForUpdate('1.3.1');
    expect(result).toEqual({ currentVersion: '1.3.1', latestVersion: '2.0.0' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches from registry when cache is stale', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ latestVersion: '1.3.1', checkedAt: Date.now() - 25 * 60 * 60 * 1000 }),
    );

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '1.4.0' }),
    } as Response);

    const result = await checkForUpdate('1.3.1');
    expect(result).toEqual({ currentVersion: '1.3.1', latestVersion: '1.4.0' });
    expect(fetch).toHaveBeenCalledWith(
      'https://registry.npmjs.org/sickbay/latest',
      expect.any(Object),
    );
  });

  it('fetches from registry when no cache file exists', async () => {
    mockExistsSync.mockReturnValue(false);

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '1.3.1' }),
    } as Response);

    const result = await checkForUpdate('1.3.1');
    expect(result).toBeNull(); // same version
    expect(fetch).toHaveBeenCalled();
  });

  it('returns null when fetch fails', async () => {
    mockExistsSync.mockReturnValue(false);
    vi.mocked(fetch).mockRejectedValue(new Error('network error'));

    const result = await checkForUpdate('1.3.1');
    expect(result).toBeNull();
  });

  it('returns null when registry returns non-ok response', async () => {
    mockExistsSync.mockReturnValue(false);
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);

    const result = await checkForUpdate('1.3.1');
    expect(result).toBeNull();
  });

  it('writes cache after successful fetch', async () => {
    mockExistsSync.mockReturnValue(false);

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '1.4.0' }),
    } as Response);

    await checkForUpdate('1.3.1');
    expect(mockWriteFileSync).toHaveBeenCalled();
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.latestVersion).toBe('1.4.0');
    expect(written.checkedAt).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 6: Implement `checkForUpdate`**

Add to `apps/cli/src/lib/update-check.ts`:

```typescript
/**
 * Check the npm registry for a newer version.
 * Uses a 24-hour cache at ~/.sickbay/update-check.json.
 * Returns UpdateInfo if a newer version exists, null otherwise.
 * Never throws — all failures are silently swallowed.
 */
export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    // Try reading cache first
    const cachePath = getCacheFilePath();
    if (existsSync(cachePath)) {
      const cache: UpdateCache = JSON.parse(readFileSync(cachePath, 'utf-8'));
      const age = Date.now() - cache.checkedAt;
      if (age < CACHE_TTL_MS) {
        // Cache is fresh — use cached result
        return isNewerVersion(currentVersion, cache.latestVersion)
          ? { currentVersion, latestVersion: cache.latestVersion }
          : null;
      }
    }

    // Cache is stale or missing — fetch from registry
    const response = await fetch(REGISTRY_URL, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { version?: string };
    const latestVersion = data.version;
    if (!latestVersion) return null;

    // Write cache
    try {
      const cacheDir = join(homedir(), '.sickbay');
      if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
      }
      writeFileSync(
        cachePath,
        JSON.stringify({ latestVersion, checkedAt: Date.now() } satisfies UpdateCache),
      );
    } catch {
      // Cache write failure is non-critical
    }

    return isNewerVersion(currentVersion, latestVersion) ? { currentVersion, latestVersion } : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 7: Run all tests**

```bash
pnpm --filter sickbay test -- --reporter=verbose update-check
```

Expected: All 14 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/cli/src/lib/update-check.ts apps/cli/src/lib/update-check.test.ts
git commit -m "feat: add update check logic with npm registry fetch and caching"
```

---

### Task 2: UpdateNotice Ink component with tests

**Files:**

- Create: `apps/cli/src/components/UpdateNotice.tsx`
- Create: `apps/cli/src/components/UpdateNotice.test.tsx`

- [ ] **Step 1: Write tests for UpdateNotice**

Create `apps/cli/src/components/UpdateNotice.test.tsx`:

```typescript
import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';

import { UpdateNotice } from './UpdateNotice.js';

describe('UpdateNotice', () => {
  it('renders version delta and upgrade command', () => {
    const { lastFrame } = render(
      <UpdateNotice currentVersion="1.3.1" latestVersion="1.4.0" />,
    );
    const output = lastFrame()!;
    expect(output).toContain('1.3.1');
    expect(output).toContain('1.4.0');
    expect(output).toContain('npx sickbay@latest');
  });

  it('renders box border characters', () => {
    const { lastFrame } = render(
      <UpdateNotice currentVersion="1.0.0" latestVersion="2.0.0" />,
    );
    const output = lastFrame()!;
    expect(output).toContain('╭');
    expect(output).toContain('╰');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter sickbay test -- --reporter=verbose UpdateNotice
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement UpdateNotice**

Create `apps/cli/src/components/UpdateNotice.tsx`:

```tsx
import React from 'react';

import { Box, Text } from 'ink';

interface UpdateNoticeProps {
  currentVersion: string;
  latestVersion: string;
}

export function UpdateNotice({ currentVersion, latestVersion }: UpdateNoticeProps) {
  const line1 = `  Update available: ${currentVersion} → ${latestVersion}  `;
  const line2 = `  Run "npx sickbay@latest" to upgrade  `;
  const width = Math.max(line1.length, line2.length);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="yellow" dimColor>
        {'  ╭' + '─'.repeat(width) + '╮'}
      </Text>
      <Text color="yellow" dimColor>
        {'  │' + line1.padEnd(width) + '│'}
      </Text>
      <Text color="yellow" dimColor>
        {'  │' + line2.padEnd(width) + '│'}
      </Text>
      <Text color="yellow" dimColor>
        {'  ╰' + '─'.repeat(width) + '╯'}
      </Text>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter sickbay test -- --reporter=verbose UpdateNotice
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/components/UpdateNotice.tsx apps/cli/src/components/UpdateNotice.test.tsx
git commit -m "feat: add UpdateNotice Ink component"
```

---

### Task 3: Wire update check into the default scan (App.tsx)

**Files:**

- Modify: `apps/cli/src/index.ts:48` (default scan action)
- Modify: `apps/cli/src/components/App.tsx:17-25` (AppProps) and `apps/cli/src/components/App.tsx:229` (render)

- [ ] **Step 1: Add updateInfo prop to App**

In `apps/cli/src/components/App.tsx`:

1. Add the import at the top (after existing imports):

```typescript
import { UpdateNotice } from './UpdateNotice.js';
import type { UpdateInfo } from '../lib/update-check.js';
```

2. Add `updatePromise` to `AppProps`:

```typescript
interface AppProps {
  projectPath: string;
  checks?: string[];
  openWeb?: boolean;
  enableAI?: boolean;
  verbose?: boolean;
  quotes?: boolean;
  isMonorepo?: boolean;
  updatePromise?: Promise<UpdateInfo | null>;
}
```

3. Add state and effect to resolve the promise inside the component. After the existing state declarations (around line 60):

```typescript
const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
```

Add a `useEffect` near the other effects:

```typescript
useEffect(() => {
  if (updatePromise) {
    updatePromise.then((info) => {
      if (info) setUpdateInfo(info);
    });
  }
}, [updatePromise]);
```

4. Render `<UpdateNotice>` between `<Header>` and the phase content (after line 229):

```tsx
<Header projectName={projectName} />

{updateInfo && (
  <UpdateNotice
    currentVersion={updateInfo.currentVersion}
    latestVersion={updateInfo.latestVersion}
  />
)}

{phase === 'loading' && (
```

- [ ] **Step 2: Wire up in index.ts**

In `apps/cli/src/index.ts`:

1. At the top of the default scan `.action(async (options) => {` handler (line 48), add the update check as a fire-and-forget promise. Add this after the `.env` loading block (after line 53):

```typescript
// Non-blocking update check
const updatePromise = (async () => {
  try {
    const { checkForUpdate } = await import('./lib/update-check.js');
    return await checkForUpdate(__VERSION__);
  } catch {
    return null;
  }
})();
```

2. Pass `updatePromise` to the `<App>` component in both render calls (the single-package render around line 91 and the main render around line 146):

Add `updatePromise` to both `React.createElement(App, { ... })` calls:

```typescript
updatePromise: options.json ? undefined : updatePromise,
```

(Skip passing it when `--json` is used since the JSON path exits before rendering App.)

- [ ] **Step 3: Build and manually verify**

```bash
pnpm --filter sickbay build
node apps/cli/dist/index.js --version
```

Expected: Shows version. The update check won't show a notification unless a newer version actually exists on npm.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter sickbay test
```

Expected: All tests pass (existing App.test.tsx tests should still pass since `updatePromise` is optional).

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/index.ts apps/cli/src/components/App.tsx
git commit -m "feat: wire update notification into default scan"
```

---

### Task 4: Wire update check into the TUI

**Files:**

- Modify: `apps/cli/src/components/tui/TuiApp.tsx`

- [ ] **Step 1: Add update check to TuiApp**

In `apps/cli/src/components/tui/TuiApp.tsx`:

1. Add imports after existing imports:

```typescript
import { UpdateNotice } from '../UpdateNotice.js';
import { checkForUpdate } from '../../lib/update-check.js';
import type { UpdateInfo } from '../../lib/update-check.js';
```

2. Add `__VERSION__` declaration at the top of the file (after imports):

```typescript
declare const __VERSION__: string;
```

3. Add state inside the `TuiApp` function (after existing state declarations, around line 52):

```typescript
const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
```

4. Add effect to run the check on mount (near the other useEffects):

```typescript
useEffect(() => {
  checkForUpdate(__VERSION__).then((info) => {
    if (info) setUpdateInfo(info);
  });
}, []);
```

5. Render `<UpdateNotice>` at the top of the TUI layout. Find the outermost `<Box>` return and add the notice right after it opens (before the panel grid):

```tsx
{
  updateInfo && (
    <UpdateNotice
      currentVersion={updateInfo.currentVersion}
      latestVersion={updateInfo.latestVersion}
    />
  );
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter sickbay test
```

Expected: All tests pass. TuiApp.test.tsx should still pass since the update check is async and non-blocking.

- [ ] **Step 3: Commit**

```bash
git add apps/cli/src/components/tui/TuiApp.tsx
git commit -m "feat: wire update notification into TUI dashboard"
```

---

### Task 5: Build, full test suite, and lint

**Files:** None (verification only)

- [ ] **Step 1: Full build**

```bash
pnpm build
```

Expected: All packages build successfully.

- [ ] **Step 2: Run all tests**

```bash
pnpm test && pnpm test:snapshots
```

Expected: All tests pass including snapshots.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```

Expected: No errors (warnings are OK).

- [ ] **Step 4: Commit if any fixes were needed, otherwise skip**

If lint or tests required fixes, commit them:

```bash
git add -A
git commit -m "fix: address lint/test issues in update notification"
```
