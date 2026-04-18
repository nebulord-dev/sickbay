# Warning Presentation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix misleading warning counts by showing unique pattern counts, grouping duplicate issues, and using diminishing returns scoring in react-perf.

**Architecture:** Three independent changes: (1) sidebar summary shows unique issue types with raw total as secondary text, (2) issues table groups identical patterns into collapsible sections, (3) react-perf scoring uses log-scale diminishing returns per unique pattern. The grouping key is `${checkId}::${patternStem}` where `patternStem` strips the file-specific prefix from issue messages. The utility is duplicated in web and CLI since CLI cannot import from web.

**Tech Stack:** React (web dashboard), Ink (CLI terminal UI), Vitest, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-17-warning-presentation-redesign.md`

---

### Task 1: React-perf diminishing returns scoring

**Files:**
- Modify: `packages/core/src/integrations/react-perf.ts:73-75`
- Test: `packages/core/src/integrations/react-perf.test.ts`

- [ ] **Step 1: Write failing test — repeated identical warnings score higher than floor**

Add this test to the `run` describe block in `packages/core/src/integrations/react-perf.test.ts`:

```ts
it('uses diminishing returns: many identical warnings score higher than linear formula floor', async () => {
  // Create a file with 50 inline objects — old formula: 100 - 50*3 = floor 20
  // New formula should produce a score well above 20
  const lines = Array.from({ length: 50 }, () => '      <span style={{ color: "red" }}>A</span>');
  const content = [
    "import React from 'react';",
    '',
    'export function Big() {',
    '  return (',
    '    <div>',
    ...lines,
    '    </div>',
    '  );',
    '}',
  ].join('\n');

  mockReaddirSync.mockReturnValue(['Big.tsx'] as never);
  mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);
  mockReadFileSync.mockReturnValue(content as never);

  const result = await runner.run('/project');

  // 50 warnings of the same pattern → diminishing returns should give score > 40
  expect(result.score).toBeGreaterThan(40);
  // But still penalized — not a perfect score
  expect(result.score).toBeLessThan(90);
});
```

- [ ] **Step 2: Write failing test — diverse patterns score lower than repeated single pattern**

```ts
it('scores diverse warning patterns lower than repeated single pattern at same count', async () => {
  // Single pattern: 6 inline objects
  const singlePatternContent = [
    "import React from 'react';",
    'export function A() { return (<div>',
    '  <span style={{ a: 1 }}>1</span>',
    '  <span style={{ b: 2 }}>2</span>',
    '  <span style={{ c: 3 }}>3</span>',
    '  <span style={{ d: 4 }}>4</span>',
    '  <span style={{ e: 5 }}>5</span>',
    '  <span style={{ f: 6 }}>6</span>',
    '</div>); }',
  ].join('\n');

  mockReaddirSync.mockReturnValue(['A.tsx'] as never);
  mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);
  mockReadFileSync.mockReturnValue(singlePatternContent as never);

  const singleResult = await runner.run('/project');

  // Diverse patterns: 3 inline objects + 3 index-as-key (2 unique patterns, 6 total)
  vi.clearAllMocks();
  mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('/src'));

  const diverseContent = [
    "import React from 'react';",
    'export function B({ items }) { return (<div>',
    '  <span style={{ a: 1 }}>1</span>',
    '  <span style={{ b: 2 }}>2</span>',
    '  <span style={{ c: 3 }}>3</span>',
    '  {items.map((x, index) => <li key={index}>{x}</li>)}',
    '  {items.map((x, i) => <p key={i}>{x}</p>)}',
    '  {items.map((x, idx) => <span key={idx}>{x}</span>)}',
    '</div>); }',
  ].join('\n');

  mockReaddirSync.mockReturnValue(['B.tsx'] as never);
  mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);
  mockReadFileSync.mockReturnValue(diverseContent as never);

  const diverseResult = await runner.run('/project');

  // Diverse patterns should score lower (more penalty) than single pattern
  expect(diverseResult.score).toBeLessThan(singleResult.score);
});
```

- [ ] **Step 3: Run tests to verify both fail**

Run: `pnpm --filter sickbay-core test -- --run src/integrations/react-perf.test.ts`
Expected: The two new tests fail (score assertions don't match old linear formula)

- [ ] **Step 4: Implement diminishing returns scoring**

In `packages/core/src/integrations/react-perf.ts`, replace lines 73-75:

```ts
const warningCount = activeFindings.filter((f) => f.severity === 'warning').length;
const infoCount = activeFindings.filter((f) => f.severity === 'info').length;
const score = Math.max(20, 100 - warningCount * 3 - infoCount * 1);
```

With:

```ts
// Diminishing returns per unique pattern — pattern diversity is penalized
// harder than volume of a single repeated pattern.
const patternCounts = new Map<string, { warnings: number; infos: number }>();
for (const f of activeFindings) {
  const idx = f.pattern.indexOf(' \u2014 ');
  const key = idx >= 0 ? f.pattern.slice(idx + 3) : f.pattern;
  const entry = patternCounts.get(key) ?? { warnings: 0, infos: 0 };
  if (f.severity === 'warning') entry.warnings++;
  else entry.infos++;
  patternCounts.set(key, entry);
}

let penalty = 0;
for (const [, counts] of patternCounts) {
  if (counts.warnings > 0) penalty += 10 + Math.log2(counts.warnings) * 3;
  if (counts.infos > 0) penalty += 3 + Math.log2(counts.infos);
}
const score = Math.max(20, Math.round(100 - penalty));
```

- [ ] **Step 5: Update the existing score calculation test**

The test at line 227 `'calculates score correctly: 100 - warnings*3 - info*1, floor at 20'` uses 2 inline-object warnings and expects score 94. With the new formula: 1 unique warning pattern with 2 instances → `100 - (10 + log2(2)*3) = 100 - 13 = 87`.

Update the test name and assertion:

```ts
it('calculates score with diminishing returns per unique pattern', async () => {
  // 2 warnings of the same pattern (inline object)
  const content = [
    "import React from 'react';",
    '',
    'export function MyComponent() {',
    '  return (',
    '    <div>',
    '      <span style={{ color: "red" }}>A</span>',
    '      <span data={{ val: 1 }}>B</span>',
    '    </div>',
    '  );',
    '}',
  ].join('\n');

  mockReaddirSync.mockReturnValue(['MyComponent.tsx'] as never);
  mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);
  mockReadFileSync.mockReturnValue(content as never);

  const result = await runner.run('/project');

  // 1 unique pattern, 2 instances → 100 - (10 + log2(2)*3) = 100 - 13 = 87
  expect(result.score).toBe(87);
});
```

- [ ] **Step 6: Run all react-perf tests to verify they pass**

Run: `pnpm --filter sickbay-core test -- --run src/integrations/react-perf.test.ts`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/integrations/react-perf.ts packages/core/src/integrations/react-perf.test.ts
git commit -m "feat(core): use diminishing returns scoring in react-perf runner

Pattern diversity is penalized harder than volume of repeated patterns.
379 identical inline-object warnings now score ~64 instead of floor 20."
```

---

### Task 2: Web dashboard — issue grouping utilities

**Files:**
- Create: `apps/web/src/lib/issue-grouping.ts`
- Create: `apps/web/src/lib/issue-grouping.test.ts`

- [ ] **Step 1: Write failing tests for extractPatternStem**

Create `apps/web/src/lib/issue-grouping.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

import { extractPatternStem, countUniqueIssues, groupIssues } from './issue-grouping.js';

import type { CheckResult } from 'sickbay-core';

describe('extractPatternStem', () => {
  it('strips file:line prefix from react-perf messages', () => {
    const msg = 'src/App.tsx:27 \u2014 Inline object in JSX prop \u2014 creates new reference every render';
    expect(extractPatternStem(msg)).toBe('Inline object in JSX prop \u2014 creates new reference every render');
  });

  it('strips complexity file prefix', () => {
    const msg = 'src/components/Foo.tsx (component): 450 lines \u2014 consider splitting (threshold: 300)';
    expect(extractPatternStem(msg)).toBe('consider splitting (threshold: 300)');
  });

  it('returns full message when no delimiter', () => {
    const msg = 'Missing React.lazy() for code splitting';
    expect(extractPatternStem(msg)).toBe(msg);
  });
});

function makeCheck(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    id: 'test',
    name: 'Test Check',
    category: 'security',
    score: 80,
    status: 'pass',
    issues: [],
    toolsUsed: ['test'],
    duration: 100,
    ...overrides,
  };
}

describe('countUniqueIssues', () => {
  it('deduplicates identical patterns within the same check', () => {
    const check = makeCheck({
      id: 'react-perf',
      issues: [
        { severity: 'warning', message: 'src/A.tsx:1 \u2014 Inline object in JSX prop \u2014 new ref', reportedBy: ['react-perf'] },
        { severity: 'warning', message: 'src/B.tsx:5 \u2014 Inline object in JSX prop \u2014 new ref', reportedBy: ['react-perf'] },
        { severity: 'warning', message: 'src/C.tsx:10 \u2014 Inline object in JSX prop \u2014 new ref', reportedBy: ['react-perf'] },
      ],
    });
    const result = countUniqueIssues([check]);
    expect(result.warnings).toBe(1);
    expect(result.totalWarnings).toBe(3);
  });

  it('counts different patterns as separate', () => {
    const check = makeCheck({
      id: 'react-perf',
      issues: [
        { severity: 'warning', message: 'src/A.tsx:1 \u2014 Inline object \u2014 new ref', reportedBy: ['react-perf'] },
        { severity: 'warning', message: 'src/A.tsx:5 \u2014 Using index as key \u2014 issues', reportedBy: ['react-perf'] },
      ],
    });
    const result = countUniqueIssues([check]);
    expect(result.warnings).toBe(2);
    expect(result.totalWarnings).toBe(2);
  });

  it('returns equal unique and total when no duplicates', () => {
    const check = makeCheck({
      issues: [
        { severity: 'critical', message: 'CVE-2024-1234', reportedBy: ['npm-audit'] },
        { severity: 'warning', message: 'Outdated dep', reportedBy: ['outdated'] },
      ],
    });
    const result = countUniqueIssues([check]);
    expect(result.critical).toBe(1);
    expect(result.totalCritical).toBe(1);
    expect(result.warnings).toBe(1);
    expect(result.totalWarnings).toBe(1);
  });
});

describe('groupIssues', () => {
  it('groups identical patterns together', () => {
    const issues = [
      { severity: 'warning' as const, message: 'src/A.tsx:1 \u2014 Inline object \u2014 new ref', reportedBy: ['react-perf'], checkName: 'React Performance', checkId: 'react-perf' },
      { severity: 'warning' as const, message: 'src/B.tsx:5 \u2014 Inline object \u2014 new ref', reportedBy: ['react-perf'], checkName: 'React Performance', checkId: 'react-perf' },
    ];
    const groups = groupIssues(issues);
    expect(groups).toHaveLength(1);
    expect(groups[0].issues).toHaveLength(2);
    expect(groups[0].stem).toBe('Inline object \u2014 new ref');
  });

  it('keeps different patterns as separate groups', () => {
    const issues = [
      { severity: 'warning' as const, message: 'src/A.tsx:1 \u2014 Inline object \u2014 ref', reportedBy: ['react-perf'], checkName: 'React Performance', checkId: 'react-perf' },
      { severity: 'critical' as const, message: 'CVE found', reportedBy: ['npm-audit'], checkName: 'NPM Audit', checkId: 'npm-audit' },
    ];
    const groups = groupIssues(issues);
    expect(groups).toHaveLength(2);
  });

  it('sorts groups by severity (critical first), then count (descending)', () => {
    const issues = [
      { severity: 'warning' as const, message: 'W1', reportedBy: ['t'], checkName: 'T', checkId: 't' },
      { severity: 'warning' as const, message: 'W1', reportedBy: ['t'], checkName: 'T', checkId: 't' },
      { severity: 'critical' as const, message: 'C1', reportedBy: ['t'], checkName: 'T', checkId: 't' },
    ];
    const groups = groupIssues(issues);
    expect(groups[0].severity).toBe('critical');
    expect(groups[1].severity).toBe('warning');
  });

  it('returns single-issue groups for unique issues', () => {
    const issues = [
      { severity: 'info' as const, message: 'Just info', reportedBy: ['t'], checkName: 'T', checkId: 't' },
    ];
    const groups = groupIssues(issues);
    expect(groups).toHaveLength(1);
    expect(groups[0].issues).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter sickbay-web test -- --run src/lib/issue-grouping.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the utilities**

Create `apps/web/src/lib/issue-grouping.ts`:

```ts
import type { CheckResult, Issue } from 'sickbay-core';

/** Extract the stable pattern description from an issue message, stripping file-specific prefixes. */
export function extractPatternStem(message: string): string {
  const idx = message.indexOf(' \u2014 ');
  return idx >= 0 ? message.slice(idx + 3) : message;
}

/** Count unique issue patterns vs raw totals across checks. */
export function countUniqueIssues(checks: CheckResult[]): {
  critical: number;
  warnings: number;
  info: number;
  totalCritical: number;
  totalWarnings: number;
  totalInfo: number;
} {
  const seen = { critical: new Set<string>(), warning: new Set<string>(), info: new Set<string>() };
  const totals = { critical: 0, warning: 0, info: 0 };

  for (const check of checks) {
    for (const issue of check.issues) {
      const stem = extractPatternStem(issue.message);
      const key = `${check.id}::${stem}`;
      seen[issue.severity].add(key);
      totals[issue.severity]++;
    }
  }

  return {
    critical: seen.critical.size,
    warnings: seen.warning.size,
    info: seen.info.size,
    totalCritical: totals.critical,
    totalWarnings: totals.warning,
    totalInfo: totals.info,
  };
}

export interface IssueWithCheck extends Issue {
  checkName: string;
  checkId: string;
}

export interface IssueGroup {
  key: string;
  stem: string;
  severity: Issue['severity'];
  checkName: string;
  checkId: string;
  issues: IssueWithCheck[];
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

/** Group issues by check + pattern stem. Sorted by severity then count descending. */
export function groupIssues(issues: IssueWithCheck[]): IssueGroup[] {
  const map = new Map<string, IssueGroup>();

  for (const issue of issues) {
    const stem = extractPatternStem(issue.message);
    const key = `${issue.checkId}::${stem}`;
    const existing = map.get(key);
    if (existing) {
      existing.issues.push(issue);
    } else {
      map.set(key, {
        key,
        stem,
        severity: issue.severity,
        checkName: issue.checkName,
        checkId: issue.checkId,
        issues: [issue],
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    const sevDiff = (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2);
    if (sevDiff !== 0) return sevDiff;
    return b.issues.length - a.issues.length;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter sickbay-web test -- --run src/lib/issue-grouping.test.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/issue-grouping.ts apps/web/src/lib/issue-grouping.test.ts
git commit -m "feat(web): add issue grouping utilities for deduplicating warning counts

extractPatternStem strips file-specific prefixes from issue messages.
countUniqueIssues counts unique patterns vs raw totals.
groupIssues clusters issues by check+pattern for grouped display."
```

---

### Task 3: Web dashboard — sidebar summary unique counts

**Files:**
- Modify: `apps/web/src/components/Dashboard.tsx:167-171, 286-292`
- Modify: `apps/web/src/components/MonorepoOverview.tsx:70-80, 127-131`
- Test: `apps/web/src/components/Dashboard.test.tsx`

- [ ] **Step 1: Write failing test — sidebar shows unique warning count with raw total**

Add to `apps/web/src/components/Dashboard.test.tsx`:

```ts
it('shows unique warning count with raw total in parentheses when duplicates exist', () => {
  const report = makeReport({
    checks: [
      {
        id: 'react-perf',
        name: 'React Performance',
        category: 'performance',
        score: 60,
        status: 'warning',
        toolsUsed: ['react-perf'],
        duration: 100,
        issues: [
          { severity: 'warning', message: 'src/A.tsx:1 \u2014 Inline object \u2014 new ref', reportedBy: ['react-perf'] },
          { severity: 'warning', message: 'src/B.tsx:5 \u2014 Inline object \u2014 new ref', reportedBy: ['react-perf'] },
          { severity: 'warning', message: 'src/C.tsx:10 \u2014 Inline object \u2014 new ref', reportedBy: ['react-perf'] },
        ],
      },
    ],
    summary: { critical: 0, warnings: 3, info: 0 },
  });
  render(<Dashboard report={report} />);
  // Should show "1 warnings (3 total)" not "3 warnings"
  expect(screen.getByText(/1 warnings/)).toBeInTheDocument();
  expect(screen.getByText(/3 total/)).toBeInTheDocument();
});

it('shows plain warning count without parenthetical when no duplicates', () => {
  const report = makeReport({
    checks: [
      {
        id: 'knip',
        name: 'Unused Code',
        category: 'dependencies',
        score: 70,
        status: 'warning',
        toolsUsed: ['knip'],
        duration: 100,
        issues: [
          { severity: 'warning', message: 'Unused dep: lodash', reportedBy: ['knip'] },
          { severity: 'warning', message: 'Unused dep: moment', reportedBy: ['knip'] },
        ],
      },
    ],
    summary: { critical: 0, warnings: 2, info: 0 },
  });
  render(<Dashboard report={report} />);
  expect(screen.getByText(/2 warnings/)).toBeInTheDocument();
  // No "total" parenthetical when unique == total
  expect(screen.queryByText(/total/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter sickbay-web test -- --run src/components/Dashboard.test.tsx`
Expected: FAIL — still shows raw count from `report.summary.warnings`

- [ ] **Step 3: Update Dashboard.tsx sidebar to use unique counts**

In `apps/web/src/components/Dashboard.tsx`, add import at top:

```ts
import { countUniqueIssues } from '../lib/issue-grouping.js';
```

In the single-project sidebar (around line 286-292), replace the summary display. Change:

```tsx
<span className="text-red-400">{activeReport.summary.critical} critical</span>
{' · '}
<span className="text-yellow-400">{activeReport.summary.warnings} warnings</span>
{' · '}
<span className="text-gray-400">{activeReport.summary.info} info</span>
```

To a computed block. Before the return (after `filteredChecks`), add:

```ts
const uniqueCounts = activeReport ? countUniqueIssues(activeReport.checks) : null;
```

Then replace the summary spans with:

```tsx
<span className="text-red-400">
  {uniqueCounts?.critical ?? activeReport.summary.critical} critical
  {uniqueCounts && uniqueCounts.totalCritical > uniqueCounts.critical && (
    <span className="text-gray-600"> ({uniqueCounts.totalCritical} total)</span>
  )}
</span>
{' · '}
<span className="text-yellow-400">
  {uniqueCounts?.warnings ?? activeReport.summary.warnings} warnings
  {uniqueCounts && uniqueCounts.totalWarnings > uniqueCounts.warnings && (
    <span className="text-gray-600"> ({uniqueCounts.totalWarnings} total)</span>
  )}
</span>
{' · '}
<span className="text-gray-400">
  {uniqueCounts?.info ?? activeReport.summary.info} info
</span>
```

For the monorepo sidebar (around line 167-171), compute unique counts from all packages' checks:

```ts
const monorepoUniqueCounts = monorepo
  ? countUniqueIssues(monorepo.packages.flatMap((p) => p.checks))
  : null;
```

And apply the same pattern to the monorepo summary spans. **Note:** The monorepo sidebar has only `critical` and `warnings` spans — there is no `info` span. Do not add one.

- [ ] **Step 4: Update MonorepoOverview.tsx header and PackageScoreCard**

In `apps/web/src/components/MonorepoOverview.tsx`, add import:

```ts
import { countUniqueIssues } from '../lib/issue-grouping.js';
```

In `MonorepoOverview` component (header around line 127-131), compute:

```ts
const uniqueCounts = countUniqueIssues(report.packages.flatMap((p) => p.checks));
```

Replace the summary spans with:

```tsx
<span className="text-red-400">
  {uniqueCounts.critical} critical
  {uniqueCounts.totalCritical > uniqueCounts.critical && ` (${uniqueCounts.totalCritical} total)`}
</span>
<span className="text-yellow-400">
  {uniqueCounts.warnings} warnings
  {uniqueCounts.totalWarnings > uniqueCounts.warnings && ` (${uniqueCounts.totalWarnings} total)`}
</span>
<span className="text-gray-500">
  {uniqueCounts.info} info
</span>
```

In `PackageScoreCard` (around line 70-80), compute per-package unique counts:

```ts
const uniqueCounts = countUniqueIssues(pkg.checks);
```

And apply the same conditional parenthetical pattern.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter sickbay-web test -- --run src/components/Dashboard.test.tsx`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/Dashboard.tsx apps/web/src/components/MonorepoOverview.tsx
git commit -m "feat(web): show unique warning types in sidebar with raw total as secondary text

Sidebar summary now shows 'N warnings (M total)' when duplicates exist,
making it clear that repeated identical patterns aren't N separate problems."
```

---

### Task 4: Web dashboard — grouped issues table

**Files:**
- Modify: `apps/web/src/components/IssuesList.tsx`
- Test: `apps/web/src/components/IssuesList.test.tsx`

- [ ] **Step 1: Write failing test — duplicate issues are grouped**

Add to `apps/web/src/components/IssuesList.test.tsx`:

```ts
it('groups duplicate issues under a collapsible header', () => {
  const check = makeCheck({
    id: 'react-perf',
    name: 'React Performance',
    issues: [
      { severity: 'warning', message: 'src/A.tsx:1 \u2014 Inline object \u2014 new ref', reportedBy: ['react-perf'] },
      { severity: 'warning', message: 'src/B.tsx:5 \u2014 Inline object \u2014 new ref', reportedBy: ['react-perf'] },
      { severity: 'warning', message: 'src/C.tsx:10 \u2014 Inline object \u2014 new ref', reportedBy: ['react-perf'] },
    ],
  });
  render(<IssuesList checks={[check]} />);
  // Should show the group header with the pattern stem and count
  expect(screen.getByText(/Inline object/)).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument();
  // Individual messages should NOT be visible (collapsed by default)
  expect(screen.queryByText(/src\/A\.tsx/)).not.toBeInTheDocument();
});

it('expands a group to show individual issues when clicked', () => {
  const check = makeCheck({
    id: 'react-perf',
    name: 'React Performance',
    issues: [
      { severity: 'warning', message: 'src/A.tsx:1 \u2014 Inline object \u2014 new ref', reportedBy: ['react-perf'] },
      { severity: 'warning', message: 'src/B.tsx:5 \u2014 Inline object \u2014 new ref', reportedBy: ['react-perf'] },
    ],
  });
  render(<IssuesList checks={[check]} />);
  // Click the group header to expand
  fireEvent.click(screen.getByText(/Inline object/));
  // Now individual issues should be visible
  expect(screen.getByText(/src\/A\.tsx:1/)).toBeInTheDocument();
  expect(screen.getByText(/src\/B\.tsx:5/)).toBeInTheDocument();
});

it('renders single-issue groups as plain rows without expand affordance', () => {
  const check = makeCheck({
    id: 'knip',
    name: 'Unused Code',
    issues: [
      { severity: 'warning', message: 'Unused dep: lodash', reportedBy: ['knip'] },
    ],
  });
  render(<IssuesList checks={[check]} />);
  // Single issue renders directly, no count badge
  expect(screen.getByText('Unused dep: lodash')).toBeInTheDocument();
  expect(screen.queryByText('1')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Write failing test — filter counts show unique group counts**

```ts
it('shows unique group counts in filter buttons, not raw issue counts', () => {
  const check = makeCheck({
    id: 'react-perf',
    name: 'React Performance',
    issues: [
      { severity: 'warning', message: 'src/A.tsx:1 \u2014 Inline object \u2014 new ref', reportedBy: ['react-perf'] },
      { severity: 'warning', message: 'src/B.tsx:5 \u2014 Inline object \u2014 new ref', reportedBy: ['react-perf'] },
      { severity: 'critical', message: 'Critical thing', reportedBy: ['react-perf'] },
    ],
  });
  render(<IssuesList checks={[check]} />);
  // 2 unique groups total (1 critical + 1 warning group), not 3 raw issues
  expect(screen.getByText('all (2)')).toBeInTheDocument();
  expect(screen.getByText('warning (1)')).toBeInTheDocument();
  expect(screen.getByText('critical (1)')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter sickbay-web test -- --run src/components/IssuesList.test.tsx`
Expected: FAIL

- [ ] **Step 4: Implement grouped IssuesList**

Rewrite `apps/web/src/components/IssuesList.tsx`. The key changes:

1. Import `groupIssues`, `extractPatternStem` from `../lib/issue-grouping.js`
2. After building `allIssues` and filtering, call `groupIssues(filtered)` to get groups
3. Filter counts use group counts: count unique groups per severity
4. Render each group: if `group.issues.length === 1`, render a plain `IssueRow`; otherwise render an `IssueGroupRow` with collapsible header
5. `IssueGroupRow` shows: severity color border, pattern stem, check name, count badge, chevron; clicking expands to show individual `IssueRow` items
6. `IssueRow` component stays unchanged

Full implementation:

```tsx
import { useState } from 'react';

import { buildSuppressSnippet } from '../lib/suppress-snippet.js';
import { groupIssues } from '../lib/issue-grouping.js';

import type { CheckResult, Issue } from 'sickbay-core';
import type { IssueGroup, IssueWithCheck } from '../lib/issue-grouping.js';

interface IssuesListProps {
  checks: CheckResult[];
}

export function IssuesList({ checks }: IssuesListProps) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [showSuppressInfo, setShowSuppressInfo] = useState<boolean>(false);

  const allIssues: IssueWithCheck[] = checks.flatMap((c) =>
    c.issues.map((issue) => ({ ...issue, checkName: c.name, checkId: c.id })),
  );

  const filtered = filter === 'all' ? allIssues : allIssues.filter((i) => i.severity === filter);
  const groups = groupIssues(filtered);

  // Count unique groups per severity for filter buttons
  const allGroups = groupIssues(allIssues);
  const counts = {
    critical: allGroups.filter((g) => g.severity === 'critical').length,
    warning: allGroups.filter((g) => g.severity === 'warning').length,
    info: allGroups.filter((g) => g.severity === 'info').length,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 items-center">
        {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors
              ${filter === f ? 'bg-accent text-black' : 'bg-surface border border-border text-gray-400 hover:border-accent/50'}`}
          >
            {f === 'all' ? `all (${allGroups.length})` : `${f} (${counts[f]})`}
          </button>
        ))}
        <button
          onClick={() => setShowSuppressInfo(!showSuppressInfo)}
          className={`ml-auto text-xs transition-colors ${showSuppressInfo ? 'text-accent' : 'text-gray-500 hover:text-gray-300'}`}
          title="About suppress rules"
        >
          \u24d8
        </button>
      </div>

      {showSuppressInfo && (
        <div className="bg-surface border border-border rounded px-4 py-3 text-sm text-gray-300 space-y-2">
          <p>
            Click <span className="font-mono text-gray-400">\u2298 suppress</span> on any issue to copy a
            suppression rule to your clipboard.
          </p>
          <p>
            Paste it into the <span className="font-mono text-gray-400">suppress</span> array for
            that check in your <span className="font-mono text-gray-400">sickbay.config.ts</span> to
            hide accepted findings from future scans.
          </p>
          <a
            href="https://nebulord-dev.github.io/sickbay/guide/suppress-rules"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-accent hover:underline text-xs"
          >
            Learn more \u2192
          </a>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {groups.length === 0 && (
          <div className="text-gray-500 text-sm py-4 text-center">No issues found \u2713</div>
        )}
        {groups.map((group) =>
          group.issues.length === 1 ? (
            <IssueRow
              key={group.key}
              issue={group.issues[0]}
              checkName={group.issues[0].checkName}
              checkId={group.issues[0].checkId}
            />
          ) : (
            <IssueGroupRow key={group.key} group={group} />
          ),
        )}
      </div>
    </div>
  );
}

function IssueGroupRow({ group }: { group: IssueGroup }) {
  const [expanded, setExpanded] = useState(false);

  const color =
    group.severity === 'critical'
      ? 'border-l-red-500 bg-red-500/5'
      : group.severity === 'warning'
        ? 'border-l-yellow-500 bg-yellow-500/5'
        : 'border-l-gray-500 bg-gray-500/5';

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-3 px-3 py-2 border-l-2 rounded-r text-left transition-colors hover:bg-white/5 ${color}`}
      >
        <span className="text-xs text-gray-500 shrink-0">{group.checkName}</span>
        <span className="flex-1 text-sm">{group.stem}</span>
        <span className="text-xs bg-white/10 text-gray-400 px-1.5 py-0.5 rounded-sm font-mono">
          {group.issues.length}
        </span>
        <span className="text-xs text-gray-500">{expanded ? '\u25BC' : '\u25B6'}</span>
      </button>
      {expanded && (
        <div className="ml-4 flex flex-col gap-1 mt-1">
          {group.issues.map((issue) => (
            <IssueRow
              key={`${issue.checkId}-${issue.message}`}
              issue={issue}
              checkName={issue.checkName}
              checkId={issue.checkId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IssueRow({
  issue,
  checkName,
  checkId,
}: {
  issue: Issue & { checkId: string };
  checkName: string;
  checkId: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (issue.fix?.command) {
      navigator.clipboard.writeText(issue.fix.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const [suppressCopied, setSuppressCopied] = useState(false);

  const copySuppress = () => {
    const snippet = buildSuppressSnippet({
      checkId,
      suppressMatch: issue.suppressMatch,
      message: issue.message,
      file: issue.file,
    });
    navigator.clipboard.writeText(snippet).catch(() => {});
    setSuppressCopied(true);
    setTimeout(() => setSuppressCopied(false), 2000);
  };

  const color =
    issue.severity === 'critical'
      ? 'border-l-red-500 bg-red-500/5'
      : issue.severity === 'warning'
        ? 'border-l-yellow-500 bg-yellow-500/5'
        : 'border-l-gray-500 bg-gray-500/5';

  return (
    <div className={`flex flex-col gap-2 px-3 py-2 border-l-2 rounded-r ${color}`}>
      <div className="flex items-start gap-3">
        <span className="text-xs text-gray-500 shrink-0 pt-0.5">{checkName}</span>
        <span className="flex-1 text-sm">{issue.message}</span>
        {issue.fix?.command && (
          <button
            onClick={copy}
            className="shrink-0 text-xs text-gray-500 hover:text-accent font-mono transition-colors"
          >
            {copied ? '\u2713 copied' : issue.fix.command}
          </button>
        )}
        <button
          onClick={copySuppress}
          className="shrink-0 text-xs text-gray-500 hover:text-accent font-mono transition-colors"
        >
          {suppressCopied ? '\u2713 copied' : '\u2298 suppress'}
        </button>
      </div>

      {issue.file && (
        <div className="text-xs text-gray-500 font-mono flex items-center gap-1">
          <span>\uD83D\uDCC4</span>
          <span>{issue.file}</span>
        </div>
      )}

      {issue.fix?.codeChange && (
        <div className="bg-black/30 rounded-sm p-3 font-mono text-xs border border-red-800/30">
          <div className="text-red-400 mb-2 flex items-center gap-1.5">
            <span>\u26A0\uFE0F</span>
            <span className="font-semibold">Offensive code:</span>
          </div>
          <code className="text-gray-300 block whitespace-pre-wrap break-all">
            {issue.fix.codeChange.before}
          </code>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Update existing tests that assert raw counts in filter buttons**

The test `'shows correct counts in filter buttons'` at line 50 expects `all (3)`. With grouping, 3 unique messages = 3 groups, so this test should still pass. Verify.

The test `'aggregates issues from multiple checks'` at line 155 expects `all (2)`. Two unique issues from different checks = 2 groups. Should still pass.

- [ ] **Step 6: Run all IssuesList tests**

Run: `pnpm --filter sickbay-web test -- --run src/components/IssuesList.test.tsx`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/IssuesList.tsx
git commit -m "feat(web): group duplicate issues in issues table with collapsible sections

Identical issue patterns are now grouped under a single header with a count
badge. Click to expand and see individual file/line instances. Single-issue
groups render as plain rows unchanged from before."
```

---

### Task 5: CLI — unique counts in Summary, App, and ScorePanel

**Files:**
- Create: `apps/cli/src/lib/issue-grouping.ts`
- Create: `apps/cli/src/lib/issue-grouping.test.ts`
- Modify: `apps/cli/src/components/Summary.tsx:40-42`
- Modify: `apps/cli/src/components/App.tsx:376-378`
- Modify: `apps/cli/src/components/tui/ScorePanel.tsx:84-92`
- Test: `apps/cli/src/components/Summary.test.tsx`
- Test: `apps/cli/src/components/tui/ScorePanel.test.tsx`

- [ ] **Step 1: Create CLI issue-grouping utility (duplicate of web version)**

Create `apps/cli/src/lib/issue-grouping.ts`:

```ts
import type { CheckResult } from 'sickbay-core';

export function extractPatternStem(message: string): string {
  const idx = message.indexOf(' \u2014 ');
  return idx >= 0 ? message.slice(idx + 3) : message;
}

export function countUniqueIssues(checks: CheckResult[]): {
  critical: number;
  warnings: number;
  info: number;
  totalCritical: number;
  totalWarnings: number;
  totalInfo: number;
} {
  const seen = { critical: new Set<string>(), warning: new Set<string>(), info: new Set<string>() };
  const totals = { critical: 0, warning: 0, info: 0 };

  for (const check of checks) {
    for (const issue of check.issues) {
      const stem = extractPatternStem(issue.message);
      const key = `${check.id}::${stem}`;
      seen[issue.severity].add(key);
      totals[issue.severity]++;
    }
  }

  return {
    critical: seen.critical.size,
    warnings: seen.warning.size,
    info: seen.info.size,
    totalCritical: totals.critical,
    totalWarnings: totals.warning,
    totalInfo: totals.info,
  };
}
```

Create `apps/cli/src/lib/issue-grouping.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

import { extractPatternStem, countUniqueIssues } from './issue-grouping.js';

import type { CheckResult } from 'sickbay-core';

describe('extractPatternStem', () => {
  it('strips file prefix from react-perf messages', () => {
    expect(extractPatternStem('src/A.tsx:1 \u2014 Inline object \u2014 new ref'))
      .toBe('Inline object \u2014 new ref');
  });

  it('returns full message when no delimiter', () => {
    expect(extractPatternStem('No delimiter here')).toBe('No delimiter here');
  });
});

describe('countUniqueIssues', () => {
  it('deduplicates identical patterns', () => {
    const check: CheckResult = {
      id: 'react-perf', name: 'React Performance', category: 'performance',
      score: 60, status: 'warning', toolsUsed: ['react-perf'], duration: 100,
      issues: [
        { severity: 'warning', message: 'src/A.tsx:1 \u2014 Inline \u2014 ref', reportedBy: ['react-perf'] },
        { severity: 'warning', message: 'src/B.tsx:5 \u2014 Inline \u2014 ref', reportedBy: ['react-perf'] },
      ],
    };
    const result = countUniqueIssues([check]);
    expect(result.warnings).toBe(1);
    expect(result.totalWarnings).toBe(2);
  });
});
```

- [ ] **Step 2: Run CLI issue-grouping tests**

Run: `pnpm --filter sickbay test -- --run src/lib/issue-grouping.test.ts`
Expected: All pass

- [ ] **Step 3: Write failing test — Summary shows unique warning count**

Add to `apps/cli/src/components/Summary.test.tsx`:

```ts
it('shows unique warning count with total in parens when duplicates exist', () => {
  const report = createMockReport({
    checks: [
      {
        id: 'react-perf', name: 'React Performance', category: 'performance',
        score: 60, status: 'warning', toolsUsed: ['react-perf'], duration: 100,
        issues: [
          { severity: 'warning', message: 'src/A.tsx:1 \u2014 Inline object \u2014 new ref', reportedBy: ['react-perf'] },
          { severity: 'warning', message: 'src/B.tsx:5 \u2014 Inline object \u2014 new ref', reportedBy: ['react-perf'] },
          { severity: 'warning', message: 'src/C.tsx:10 \u2014 Inline object \u2014 new ref', reportedBy: ['react-perf'] },
        ],
      },
    ],
    summary: { critical: 0, warnings: 3, info: 0 },
  });
  const { lastFrame } = render(<Summary report={report} />);
  const output = lastFrame();
  expect(output).toContain('1 warnings');
  expect(output).toContain('3 total');
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter sickbay test -- --run src/components/Summary.test.tsx`
Expected: FAIL — still shows `3 warnings`

- [ ] **Step 5: Update Summary.tsx**

In `apps/cli/src/components/Summary.tsx`, add import:

```ts
import { countUniqueIssues } from '../lib/issue-grouping.js';
```

Replace lines 40-42:

```tsx
<Text color="red"> ✗ {report.summary.critical} critical</Text>
<Text color="yellow"> ⚠ {report.summary.warnings} warnings</Text>
<Text color="gray"> i {report.summary.info} info</Text>
```

With:

```tsx
{(() => {
  const u = countUniqueIssues(report.checks);
  return (
    <>
      <Text color="red"> ✗ {u.critical} critical{u.totalCritical > u.critical ? ` (${u.totalCritical} total)` : ''}</Text>
      <Text color="yellow"> ⚠ {u.warnings} warnings{u.totalWarnings > u.warnings ? ` (${u.totalWarnings} total)` : ''}</Text>
      <Text color="gray"> i {u.info} info</Text>
    </>
  );
})()}
```

- [ ] **Step 6: Update the existing Summary tests that assert raw counts**

The existing tests at lines 44-68 create reports with `summary: { critical: N, ... }` but empty `checks: []` arrays. With the new logic, `countUniqueIssues([])` returns all zeros. These tests need checks arrays that match their summary counts.

Update the `createMockReport` helper to auto-generate matching checks from summary:

```ts
const createMockReport = (overrides?: Partial<SickbayReport>): SickbayReport => {
  const summary = overrides?.summary ?? { critical: 2, warnings: 5, info: 10 };
  const autoIssues: Issue[] = [
    ...Array.from({ length: summary.critical }, (_, i) => ({
      severity: 'critical' as const, message: `Critical ${i}`, reportedBy: ['test'],
    })),
    ...Array.from({ length: summary.warnings }, (_, i) => ({
      severity: 'warning' as const, message: `Warning ${i}`, reportedBy: ['test'],
    })),
    ...Array.from({ length: summary.info }, (_, i) => ({
      severity: 'info' as const, message: `Info ${i}`, reportedBy: ['test'],
    })),
  ];
  return {
    timestamp: new Date().toISOString(),
    projectPath: '/test/project',
    projectInfo: {
      name: 'test-project', version: '1.0.0', framework: 'react', packageManager: 'npm',
      totalDependencies: 50, devDependencies: {}, dependencies: {},
      hasESLint: false, hasPrettier: false, hasTypeScript: false,
    },
    checks: overrides?.checks ?? [{
      id: 'test', name: 'Test', category: 'security', score: 80, status: 'pass',
      issues: autoIssues, toolsUsed: ['test'], duration: 100,
    }],
    overallScore: 85,
    summary,
    ...overrides,
  };
};
```

Also add the `Issue` type import:

```ts
import type { SickbayReport, Issue } from 'sickbay-core';
```

- [ ] **Step 7: Update App.tsx monorepo summary**

In `apps/cli/src/components/App.tsx`, add import:

```ts
import { countUniqueIssues } from '../lib/issue-grouping.js';
```

In `MonorepoSummaryTable` (around lines 376-378), replace:

```tsx
<Text color="red">{report.summary.critical} critical</Text>
<Text dimColor>· </Text>
<Text color="yellow">{report.summary.warnings} warnings</Text>
```

With:

```tsx
{(() => {
  const u = countUniqueIssues(report.packages.flatMap((p) => p.checks));
  return (
    <>
      <Text color="red">{u.critical} critical{u.totalCritical > u.critical ? ` (${u.totalCritical} total)` : ''}</Text>
      <Text dimColor>· </Text>
      <Text color="yellow">{u.warnings} warnings{u.totalWarnings > u.warnings ? ` (${u.totalWarnings} total)` : ''}</Text>
    </>
  );
})()}
```

Add `MonorepoReport` and `PackageReport` to the existing type imports if not already present.

- [ ] **Step 8: Update ScorePanel.tsx**

In `apps/cli/src/components/tui/ScorePanel.tsx`, add import:

```ts
import { countUniqueIssues } from '../../lib/issue-grouping.js';
```

Replace lines 83-93:

```tsx
<Box>
  <Text color="red">
    {'\u2717'} {report.summary.critical} critical
  </Text>
  <Text>{'  '}</Text>
  <Text color="yellow">
    {'\u26A0'} {report.summary.warnings} warn
  </Text>
  <Text>{'  '}</Text>
  <Text dimColor>i {report.summary.info} info</Text>
</Box>
```

With:

```tsx
{(() => {
  const u = countUniqueIssues(report.checks);
  return (
    <Box>
      <Text color="red">
        {'\u2717'} {u.critical} critical{u.totalCritical > u.critical ? ` (${u.totalCritical})` : ''}
      </Text>
      <Text>{'  '}</Text>
      <Text color="yellow">
        {'\u26A0'} {u.warnings} warn{u.totalWarnings > u.warnings ? ` (${u.totalWarnings})` : ''}
      </Text>
      <Text>{'  '}</Text>
      <Text dimColor>i {u.info} info</Text>
    </Box>
  );
})()}
```

- [ ] **Step 9: Update ScorePanel tests that assert raw counts**

In `apps/cli/src/components/tui/ScorePanel.test.tsx`, the `createMockReport` helper (line 10) creates reports with `checks: []`. Update it to include auto-generated issues similar to the Summary test fix. The tests `'shows warnings count in summary'` (line 121) and `'shows critical count in summary'` (line 113) pass summary counts but empty checks arrays.

Update `createMockReport`:

```ts
const createMockReport = (
  overallScore: number,
  summary: { critical: number; warnings: number; info: number } = {
    critical: 0, warnings: 0, info: 0,
  },
): SickbayReport => {
  const autoIssues: Issue[] = [
    ...Array.from({ length: summary.critical }, (_, i) => ({
      severity: 'critical' as const, message: `Critical ${i}`, reportedBy: ['test'],
    })),
    ...Array.from({ length: summary.warnings }, (_, i) => ({
      severity: 'warning' as const, message: `Warning ${i}`, reportedBy: ['test'],
    })),
    ...Array.from({ length: summary.info }, (_, i) => ({
      severity: 'info' as const, message: `Info ${i}`, reportedBy: ['test'],
    })),
  ];
  return {
    timestamp: new Date().toISOString(),
    projectPath: '/test/project',
    projectInfo: {
      name: 'test-project', version: '1.0.0', framework: 'react', packageManager: 'npm',
      totalDependencies: 50, devDependencies: {}, dependencies: {},
      hasESLint: false, hasPrettier: false, hasTypeScript: false,
    },
    checks: [{
      id: 'test', name: 'Test', category: 'security', score: 80, status: 'pass',
      issues: autoIssues, toolsUsed: ['test'], duration: 100,
    }],
    overallScore,
    summary,
  };
};
```

Add the `Issue` type import.

- [ ] **Step 10: Run all CLI tests**

Run: `pnpm --filter sickbay test -- --run src/components/Summary.test.tsx src/components/tui/ScorePanel.test.tsx src/lib/issue-grouping.test.ts`
Expected: All pass

**Note on App.test.tsx:** The existing `App.test.tsx` has no monorepo rendering tests — `MonorepoSummaryTable` is an internal component that only renders when `runSickbay` returns a `MonorepoReport`, which requires complex mock setup that doesn't exist. The `countUniqueIssues` utility is tested directly in `issue-grouping.test.ts`, and the monorepo display change is mechanically identical to the `Summary.tsx` change (same utility, same conditional parenthetical). Adding a dedicated `MonorepoSummaryTable` render test is deferred — it would require building out monorepo test infrastructure that doesn't exist yet.

- [ ] **Step 11: Commit**

```bash
git add apps/cli/src/lib/issue-grouping.ts apps/cli/src/lib/issue-grouping.test.ts \
  apps/cli/src/components/Summary.tsx apps/cli/src/components/App.tsx \
  apps/cli/src/components/tui/ScorePanel.tsx \
  apps/cli/src/components/Summary.test.tsx apps/cli/src/components/tui/ScorePanel.test.tsx
git commit -m "feat(cli): show unique warning types in Summary, App, and ScorePanel

All CLI summary displays now show 'N warnings (M total)' when duplicate
patterns exist, consistent with the web dashboard change."
```

---

### Task 6: Snapshot updates and final verification

**Files:**
- Modify: `tests/snapshots/__snapshots__/fixture-regression.test.ts.snap`

- [ ] **Step 1: Build all packages**

Run: `pnpm build`
Expected: Clean build

- [ ] **Step 2: Run core unit tests**

Run: `pnpm --filter sickbay-core test -- --run`
Expected: All pass

- [ ] **Step 3: Run CLI unit tests**

Run: `pnpm --filter sickbay test -- --run`
Expected: All pass

- [ ] **Step 4: Run web unit tests**

Run: `pnpm --filter sickbay-web test -- --run`
Expected: All pass

- [ ] **Step 5: Update snapshot tests**

Run: `pnpm test:snapshots -- --run --update`

The react-perf scores in the snapshots will change due to the diminishing returns formula. The snapshot for `react-app` fixture's `react-perf` check will have a different score. Review the diff to confirm:
- Score changed in the expected direction (higher for repeated patterns)
- Issues array is unchanged (still contains all individual issues)
- Other checks are unaffected

Expected: Snapshots updated

- [ ] **Step 6: Run snapshot tests again to confirm they pass**

Run: `pnpm test:snapshots -- --run`
Expected: All pass

- [ ] **Step 7: Run lint**

Run: `pnpm lint`
Expected: Clean

- [ ] **Step 8: Commit snapshots**

```bash
git add tests/snapshots/__snapshots__/fixture-regression.test.ts.snap
git commit -m "test: update snapshots for react-perf diminishing returns scoring"
```

- [ ] **Step 9: Run monorepo-architect review**

Dispatch `monorepo-architect` agent to verify no boundary violations were introduced:
- Web package only uses `import type` from core
- CLI doesn't import from web
- New `issue-grouping.ts` files live in their respective packages (not in core)

---

### Task 7: Knip and bundled deps check

- [ ] **Step 1: Run knip to check for unused exports**

Run: `pnpm knip`
Expected: No new unused exports from the new files

- [ ] **Step 2: Run bundled deps check**

Run: `pnpm check:bundled-deps`
Expected: Pass (no new runtime deps were added)

- [ ] **Step 3: Final commit if any fixes needed**

If knip or bundled-deps found issues, fix and commit.
