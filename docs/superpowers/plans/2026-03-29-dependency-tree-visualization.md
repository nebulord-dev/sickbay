# Dependency Tree Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive npm dependency graph overlay to the web dashboard's Dependencies tab, showing package relationships with vulnerability/outdated/unused annotations.

**Architecture:** New `getDependencyTree()` utility in core runs the package manager's `ls` command and caches the result to `.sickbay/dep-tree.json`. The CLI serves this via a new HTTP endpoint. A new React overlay component in the web package renders the tree with `@xyflow/react` + `dagre`, cross-referencing runner data for node annotations.

**Tech Stack:** TypeScript, execa, @xyflow/react, dagre, React, Tailwind CSS, Vitest

---

### Task 1: Core — getDependencyTree utility

**Files:**
- Create: `packages/core/src/utils/dep-tree.ts`
- Create: `packages/core/src/utils/dep-tree.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the types and empty function**

```typescript
// packages/core/src/utils/dep-tree.ts
import { execa } from 'execa';
import type { ProjectInfo } from '../types.js';

export interface DependencyTreeNode {
  name: string;
  version: string;
  dependencies?: Record<string, DependencyTreeNode>;
}

export interface DependencyTree {
  name: string;
  version: string;
  packageManager: string;
  dependencies: Record<string, DependencyTreeNode>;
}

export interface MonorepoDependencyTree {
  packages: Record<string, DependencyTree>;
}

export async function getDependencyTree(
  projectPath: string,
  packageManager: ProjectInfo['packageManager'],
): Promise<DependencyTree> {
  // TODO: implement
  return { name: '', version: '', packageManager, dependencies: {} };
}
```

- [ ] **Step 2: Write failing tests for pnpm**

```typescript
// packages/core/src/utils/dep-tree.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { execa } from 'execa';
import { getDependencyTree } from './dep-tree.js';

const mockExeca = vi.mocked(execa);

describe('getDependencyTree', () => {
  it('parses pnpm ls --json --depth 1 output', async () => {
    const pnpmOutput = JSON.stringify([{
      name: 'my-app',
      version: '1.0.0',
      dependencies: {
        react: {
          from: 'react',
          version: '19.0.0',
          resolved: '',
          dependencies: {
            'loose-envify': { from: 'loose-envify', version: '1.4.0', resolved: '' },
          },
        },
        lodash: { from: 'lodash', version: '4.17.21', resolved: '' },
      },
    }]);

    mockExeca.mockResolvedValueOnce({ stdout: pnpmOutput } as any);

    const tree = await getDependencyTree('/test', 'pnpm');

    expect(tree.name).toBe('my-app');
    expect(tree.packageManager).toBe('pnpm');
    expect(tree.dependencies.react.version).toBe('19.0.0');
    expect(tree.dependencies.react.dependencies?.['loose-envify'].version).toBe('1.4.0');
    expect(tree.dependencies.lodash.version).toBe('4.17.21');
  });

  it('parses npm ls --json --depth 1 output', async () => {
    const npmOutput = JSON.stringify({
      name: 'my-app',
      version: '1.0.0',
      dependencies: {
        express: {
          version: '4.18.2',
          dependencies: {
            'body-parser': { version: '1.20.1' },
          },
        },
      },
    });

    mockExeca.mockResolvedValueOnce({ stdout: npmOutput } as any);

    const tree = await getDependencyTree('/test', 'npm');

    expect(tree.name).toBe('my-app');
    expect(tree.dependencies.express.version).toBe('4.18.2');
    expect(tree.dependencies.express.dependencies?.['body-parser'].version).toBe('1.20.1');
  });

  it('returns empty tree on error', async () => {
    mockExeca.mockRejectedValueOnce(new Error('command not found'));

    const tree = await getDependencyTree('/test', 'pnpm');

    expect(tree.dependencies).toEqual({});
  });

  it('returns empty tree for unsupported package manager (bun)', async () => {
    const tree = await getDependencyTree('/test', 'bun');
    expect(tree.dependencies).toEqual({});
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/core && pnpm vitest run src/utils/dep-tree.test.ts`
Expected: FAIL — the function returns an empty tree for all cases.

- [ ] **Step 4: Implement getDependencyTree**

```typescript
// packages/core/src/utils/dep-tree.ts
import { execa } from 'execa';
import type { ProjectInfo } from '../types.js';

export interface DependencyTreeNode {
  name: string;
  version: string;
  dependencies?: Record<string, DependencyTreeNode>;
}

export interface DependencyTree {
  name: string;
  version: string;
  packageManager: string;
  dependencies: Record<string, DependencyTreeNode>;
}

export interface MonorepoDependencyTree {
  packages: Record<string, DependencyTree>;
}

function normalizeDeps(
  raw: Record<string, any> | undefined,
): Record<string, DependencyTreeNode> {
  if (!raw) return {};
  const result: Record<string, DependencyTreeNode> = {};
  for (const [name, info] of Object.entries(raw)) {
    result[name] = {
      name,
      version: info.version ?? 'unknown',
      ...(info.dependencies && Object.keys(info.dependencies).length > 0
        ? { dependencies: normalizeDeps(info.dependencies) }
        : {}),
    };
  }
  return result;
}

export async function getDependencyTree(
  projectPath: string,
  packageManager: ProjectInfo['packageManager'],
): Promise<DependencyTree> {
  const empty: DependencyTree = {
    name: '',
    version: '',
    packageManager,
    dependencies: {},
  };

  // bun doesn't support ls --json in a parseable way
  if (packageManager === 'bun') return empty;

  try {
    const args =
      packageManager === 'yarn'
        ? ['list', '--json', '--depth', '1']
        : ['ls', '--json', '--depth', '1'];

    const { stdout } = await execa(packageManager, args, {
      cwd: projectPath,
      reject: false,
      timeout: 30_000,
    });

    const parsed = JSON.parse(stdout);

    // pnpm returns an array, npm/yarn return an object
    const root = Array.isArray(parsed) ? parsed[0] : parsed;

    return {
      name: root.name ?? '',
      version: root.version ?? '',
      packageManager,
      dependencies: normalizeDeps(root.dependencies),
    };
  } catch {
    return empty;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/core && pnpm vitest run src/utils/dep-tree.test.ts`
Expected: PASS — all 4 tests pass.

- [ ] **Step 6: Export from core index**

Add to `packages/core/src/index.ts`:

```typescript
export { getDependencyTree } from './utils/dep-tree.js';
export type { DependencyTree, DependencyTreeNode, MonorepoDependencyTree } from './utils/dep-tree.js';
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/utils/dep-tree.ts packages/core/src/utils/dep-tree.test.ts packages/core/src/index.ts
git commit -m "feat(core): add getDependencyTree utility for npm package tree"
```

---

### Task 2: Core — Add vulnerablePackages metadata to npm-audit runner

**Files:**
- Modify: `packages/core/src/integrations/npm-audit.ts`
- Modify: `packages/core/src/integrations/npm-audit.test.ts`

- [ ] **Step 1: Write a failing test**

Add a test to `packages/core/src/integrations/npm-audit.test.ts` that asserts `metadata.vulnerablePackages` is a `Record<string, number>` mapping package names to vulnerability counts:

```typescript
it('includes vulnerablePackages in metadata', async () => {
  // Use existing mock setup pattern from this test file
  // Mock npm audit output with 2 vulns for lodash, 1 for express
  const result = await runner.run('/test');
  expect(result.metadata?.vulnerablePackages).toEqual({
    lodash: 2,
    express: 1,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm vitest run src/integrations/npm-audit.test.ts`
Expected: FAIL — `vulnerablePackages` is undefined.

- [ ] **Step 3: Add vulnerablePackages to the runner**

In `packages/core/src/integrations/npm-audit.ts`, build the map from the vulnerabilities object and spread it into metadata. Add after line 48 (`const meta = data.metadata?.vulnerabilities;`):

```typescript
// Build package → advisory count map for graph annotation.
// Each vulnerability entry has a `via` array where objects with `title`
// represent distinct advisories. Strings in `via` are transitive references
// and should not be counted.
const vulnerablePackages: Record<string, number> = {};
for (const [pkgName, vuln] of Object.entries(data.vulnerabilities ?? {})) {
  const advisoryCount = Array.isArray(vuln.via)
    ? vuln.via.filter((v: unknown) => typeof v === 'object' && v !== null && 'title' in v).length
    : 0;
  vulnerablePackages[pkgName] = Math.max(advisoryCount, 1);
}
```

Then update the metadata line (line 79) to include it:

```typescript
metadata: { ...meta, vulnerablePackages },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && pnpm vitest run src/integrations/npm-audit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/integrations/npm-audit.ts packages/core/src/integrations/npm-audit.test.ts
git commit -m "feat(core): add vulnerablePackages metadata to npm-audit runner"
```

---

### Task 3: CLI — Cache dep tree and serve via HTTP endpoint

**Files:**
- Modify: `apps/cli/src/lib/history.ts`
- Modify: `apps/cli/src/components/App.tsx`
- Modify: `apps/cli/src/components/tui/TuiApp.tsx`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/commands/web.ts`

- [ ] **Step 1: Add saveDepTree to history.ts**

Follow the same pattern as `saveLastReport`. Add to `apps/cli/src/lib/history.ts`:

```typescript
export function saveDepTree(projectPath: string, tree: unknown): void {
  mkdirSync(join(projectPath, ".sickbay"), { recursive: true });
  writeFileSync(
    join(projectPath, ".sickbay", "dep-tree.json"),
    JSON.stringify(tree, null, 2),
  );
}
```

- [ ] **Step 2: Write a test for saveDepTree**

Add to `apps/cli/src/lib/history.test.ts`:

```typescript
it('writes dep tree JSON to dep-tree.json', () => {
  saveDepTree('/my/project', { name: 'test', dependencies: {} });
  expect(mockWriteFileSync).toHaveBeenCalledWith(
    '/my/project/.sickbay/dep-tree.json',
    expect.any(String),
  );
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd apps/cli && pnpm vitest run src/lib/history.test.ts`
Expected: PASS

- [ ] **Step 4: Call saveDepTree from App.tsx after scan**

In `apps/cli/src/components/App.tsx`, add the dep tree save alongside the existing `saveLastReport` call (around line 163-165). Import `getDependencyTree` from `@sickbay/core`.

**Single-project path** (when `report` is a `SickbayReport`):
```typescript
// After saveEntry(r) and saveLastReport(r):
const { getDependencyTree } = await import("@sickbay/core");
const { saveDepTree } = await import("../lib/history.js");
const tree = await getDependencyTree(projectPath, r.projectInfo.packageManager);
saveDepTree(projectPath, tree);
```

**Monorepo path** (when the scan produces a `MonorepoReport` — look for the existing monorepo branch in App.tsx):
```typescript
// Build a MonorepoDependencyTree with per-package entries
const { getDependencyTree } = await import("@sickbay/core");
const { saveDepTree } = await import("../lib/history.js");
const packages: Record<string, any> = {};
for (const pkg of monorepoResult.packages) {
  packages[pkg.name] = await getDependencyTree(pkg.path, monorepoResult.packageManager);
}
saveDepTree(projectPath, { packages });
```

The key difference: `MonorepoReport` has `packageManager` at the top level (not inside `projectInfo`), and we iterate all packages to build the `{ packages: Record<string, DependencyTree> }` shape.

Apply the same single/monorepo pattern in `TuiApp.tsx` and the `--json` path in `index.ts`.

- [ ] **Step 5: Add /sickbay-dep-tree.json endpoint to web.ts**

In `apps/cli/src/commands/web.ts`, add a new route after the `/sickbay-history.json` handler (after line 123). Follow the same pattern:

```typescript
// Serve dependency tree
if (url === "/sickbay-dep-tree.json") {
  const basePath = "isMonorepo" in report ? report.rootPath : report.projectPath;
  const treePath = join(basePath, ".sickbay", "dep-tree.json");
  if (existsSync(treePath)) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(treePath, "utf-8"));
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end("{}");
  }
  return;
}
```

- [ ] **Step 6: Add web endpoint test**

Add to `apps/cli/src/commands/web.test.ts` a test verifying the endpoint serves the cached file and returns 404 when missing. Follow the existing test pattern for `/sickbay-history.json`.

- [ ] **Step 7: Run all CLI tests**

Run: `cd apps/cli && pnpm vitest run`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/cli/src/lib/history.ts apps/cli/src/lib/history.test.ts apps/cli/src/components/App.tsx apps/cli/src/components/tui/TuiApp.tsx apps/cli/src/index.ts apps/cli/src/commands/web.ts apps/cli/src/commands/web.test.ts
git commit -m "feat(cli): cache dep tree to .sickbay/ and serve via HTTP endpoint"
```

---

### Task 4: Web — DependencyTreeOverlay component

**Files:**
- Create: `apps/web/src/components/DependencyTreeOverlay.tsx`
- Create: `apps/web/src/components/DependencyTreeOverlay.test.tsx`

This is the largest task. It includes: overlay shell, ReactFlow graph with dagre layout, custom node component with status pills, filter bar, side detail panel, expand/collapse behavior, loading/error states.

- [ ] **Step 1: Write the test file with mocks**

Create `apps/web/src/components/DependencyTreeOverlay.test.tsx`. Mock `@xyflow/react` and `dagre` using the same pattern as `DependencyGraph.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, edges, nodeTypes }: any) => (
    <div data-testid="react-flow">
      {nodes.map((n: any) => {
        const NodeComponent = nodeTypes?.[n.type];
        return NodeComponent
          ? <NodeComponent key={n.id} data={n.data} />
          : <div key={n.id} data-testid="flow-node">{n.data.label}</div>;
      })}
    </div>
  ),
  Background: () => <div data-testid="flow-background" />,
  Position: { Top: 'top', Bottom: 'bottom' },
  Handle: () => null,
}));

vi.mock('dagre', () => ({
  default: {
    graphlib: {
      Graph: class {
        setDefaultEdgeLabel = vi.fn();
        setGraph = vi.fn();
        setNode = vi.fn();
        setEdge = vi.fn();
        node = vi.fn(() => ({ x: 100, y: 100 }));
      },
    },
    layout: vi.fn(),
  },
}));
```

Import the component **after** mocks are set up (same pattern as `DependencyGraph.test.tsx` line 35):

```typescript
// Import after mocks
const { DependencyTreeOverlay } = await import('./DependencyTreeOverlay.js');
```

Write tests for:
- Renders loading state when tree is null
- Renders error state when fetch fails (404)
- Renders nodes from tree data
- Shows status pills on vulnerable/outdated/unused nodes
- Filter toggles dim non-matching nodes
- Side panel opens on node click
- Close button dismisses overlay

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && pnpm vitest run src/components/DependencyTreeOverlay.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement the overlay component**

Create `apps/web/src/components/DependencyTreeOverlay.tsx`. Key implementation details:

**Props:**
```typescript
interface DependencyTreeOverlayProps {
  report: SickbayReport;
  onClose: () => void;
  packageName?: string; // for monorepo: which package tree to show
}
```

**State:**
- `tree: DependencyTree | null` — fetched from `/sickbay-dep-tree.json`
- `loading: boolean`
- `error: string | null`
- `filter: 'all' | 'vulnerable' | 'outdated' | 'unused'`
- `selectedNode: string | null` — package name for side panel
- `expandedNodes: Set<string>` — which nodes have transitive deps visible

**Data fetching:** `useEffect` on mount fetches `/sickbay-dep-tree.json`. For monorepo, reads `tree.packages[packageName]`.

**Annotation building:** A `useMemo` that builds a `Map<string, NodeStatus>` by cross-referencing:
- `report.checks` with id `'npm-audit'` → `metadata.vulnerablePackages` map
- `report.checks` with id `'outdated'` → parse issue messages with same regex as `DependencyList.tsx` line 35
- `report.checks` with id `'knip'` or `'depcheck'` → parse unused dep messages with same regex as `DependencyList.tsx` line 27
- `report.checks` with id `'heavy-deps'` → `metadata.heavyDeps` array

**Custom node (`DepTreeNode`):** Registered via ReactFlow `nodeTypes`. Renders:
- Package name in monospace
- Version in smaller muted text
- Status pills below (colored backgrounds matching the spec)
- Border color based on worst status
- Expand indicator (+/−) if node has transitive deps in the tree data
- `onClick` → set `selectedNode`
- Expand click → toggle node in `expandedNodes` set, re-run dagre layout

**Dagre layout:** Top-down (`TB` rankdir). Recompute `useMemo` when `expandedNodes` changes. Only include transitive dep nodes for expanded parents.

**Filter behavior:** Nodes not matching the active filter get `style.opacity = 0.2`. All nodes remain interactive.

**Side panel:** Absolutely positioned on the right. Shows details for `selectedNode` by looking up the node's status from the annotation map and the tree data. Includes fix command button if available from the report's issue data.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && pnpm vitest run src/components/DependencyTreeOverlay.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/DependencyTreeOverlay.tsx apps/web/src/components/DependencyTreeOverlay.test.tsx
git commit -m "feat(web): add DependencyTreeOverlay component with graph, filters, detail panel"
```

---

### Task 5: Web — Wire overlay into DependencyList

**Files:**
- Modify: `apps/web/src/components/DependencyList.tsx`
- Modify: `apps/web/src/components/DependencyList.test.tsx`

- [ ] **Step 1: Write a failing test**

Add to `apps/web/src/components/DependencyList.test.tsx`:

```typescript
it('renders a "View Graph" button', () => {
  render(<DependencyList report={makeReport()} />);
  expect(screen.getByText(/view graph/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/components/DependencyList.test.tsx`
Expected: FAIL — no "View Graph" text.

- [ ] **Step 3: Add the View Graph button and overlay**

In `apps/web/src/components/DependencyList.tsx`:

1. Add state: `const [showGraph, setShowGraph] = useState(false);`
2. Add a "View Graph" button in the header area (next to the "Dependencies" title, around line 174):

```tsx
<button
  onClick={() => setShowGraph(true)}
  className="px-3 py-1 rounded text-sm font-mono text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 transition-colors"
>
  view graph
</button>
```

3. Lazy-import and render the overlay when `showGraph` is true:

```tsx
const DependencyTreeOverlay = lazy(() =>
  import('./DependencyTreeOverlay.js').then(m => ({ default: m.DependencyTreeOverlay }))
);

// At the end of the component return, before closing </div>:
{showGraph && (
  <Suspense fallback={null}>
    <DependencyTreeOverlay
      report={report}
      onClose={() => setShowGraph(false)}
    />
  </Suspense>
)}
```

Add `lazy, Suspense` to the React import at top.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && pnpm vitest run src/components/DependencyList.test.tsx`
Expected: PASS

- [ ] **Step 5: Run all web tests**

Run: `cd apps/web && pnpm vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/DependencyList.tsx apps/web/src/components/DependencyList.test.tsx
git commit -m "feat(web): add View Graph button to DependencyList, wire overlay"
```

---

### Task 6: Build verification and manual testing

**Files:** None (verification only)

- [ ] **Step 1: Build all packages**

Run: `pnpm build`
Expected: Clean build, no errors.

- [ ] **Step 2: Run full test suite**

Run: `pnpm vitest run` (from root, runs all packages)
Expected: All tests pass.

- [ ] **Step 3: Manual smoke test**

Run against the react-app fixture:
```bash
node apps/cli/dist/index.js --path fixtures/packages/react-app --web
```

Verify:
1. `.sickbay/dep-tree.json` is created in the fixture directory
2. The web dashboard opens, navigate to Dependencies tab
3. "View Graph" button is visible
4. Clicking it opens the overlay with the dependency tree
5. Nodes show correct status pills (check against the dependency list)
6. Filter toggles work (vulnerable/outdated/unused dim non-matching)
7. Clicking a node opens the side detail panel
8. Close button dismisses the overlay

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

---

### Task 7: Monorepo-architect review

Per project conventions, run the monorepo-architect agent as a final review step before considering the work complete. It should verify:
- Core exports are correct
- Web package only uses `import type` from core (no value imports)
- No boundary violations between packages

- [ ] **Step 1: Run monorepo-architect review**

Dispatch the monorepo-architect agent to review all changed files.

- [ ] **Step 2: Address any findings and commit**
