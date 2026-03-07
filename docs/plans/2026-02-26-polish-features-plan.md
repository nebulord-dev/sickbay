# Polish Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship three polish features: auto-save last report to `.vitals/last-report.json`, TUI score reveal animation, and TUI panel entrance animations.

**Architecture:** Auto-save adds one function to `history.ts` and hooks it into three call sites. Score animation adds `displayScore` state to `ScorePanel.tsx` driven by a self-clearing `setInterval`. Panel entrance adds `visiblePanels` state to `TuiApp.tsx` with staggered `setTimeout` calls and a `visible` prop on `PanelBorder`.

**Tech Stack:** TypeScript, React/Ink (React for terminals), Vitest, ink-testing-library

---

## Task 1: `saveLastReport` in history.ts

**Files:**
- Modify: `apps/cli/src/lib/history.ts`
- Modify: `apps/cli/src/lib/history.test.ts`

### Step 1: Write the failing tests

Add to the `describe('saveLastReport')` block in `apps/cli/src/lib/history.test.ts` (after the existing `detectRegressions` describe block):

```typescript
describe('saveLastReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates the .vitals directory', () => {
    saveLastReport(makeReport());

    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('.vitals'),
      { recursive: true },
    );
  });

  it('writes report JSON to last-report.json', () => {
    const report = makeReport({ overallScore: 72 });

    saveLastReport(report);

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('last-report.json'),
      expect.stringContaining('"overallScore": 72'),
    );
  });

  it('overwrites on second call (always latest)', () => {
    saveLastReport(makeReport({ overallScore: 70 }));
    saveLastReport(makeReport({ overallScore: 85 }));

    // Both calls write to last-report.json
    const paths = mockWriteFileSync.mock.calls.map((c) => c[0] as string);
    expect(paths.every((p) => p.endsWith('last-report.json'))).toBe(true);
    expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
  });

  it('writes to projectPath/.vitals/last-report.json', () => {
    const report = makeReport({ projectPath: '/my/project' });

    saveLastReport(report);

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/my/project/.vitals/last-report.json',
      expect.any(String),
    );
  });
});
```

Also add `saveLastReport` to the import at the top of the file:
```typescript
import { loadHistory, saveEntry, detectRegressions, saveLastReport } from './history.js';
```

### Step 2: Run to verify failure

```bash
cd /Users/chmc-gd9nn2t4fv/Documents/code/vitals && pnpm --filter @vitals/cli test -- --reporter=verbose history
```

Expected: FAIL — `saveLastReport is not a function`

### Step 3: Implement `saveLastReport` in `apps/cli/src/lib/history.ts`

Add after the `saveEntry` function (around line 68):

```typescript
export function saveLastReport(report: VitalsReport): void {
  mkdirSync(join(report.projectPath, ".vitals"), { recursive: true });
  writeFileSync(
    join(report.projectPath, ".vitals", "last-report.json"),
    JSON.stringify(report, null, 2),
  );
}
```

### Step 4: Run tests to verify they pass

```bash
pnpm --filter @vitals/cli test -- --reporter=verbose history
```

Expected: all `saveLastReport` tests PASS

### Step 5: Commit

```bash
git add apps/cli/src/lib/history.ts apps/cli/src/lib/history.test.ts
git commit -m "feat: add saveLastReport to write .vitals/last-report.json"
```

---

## Task 2: Hook auto-save into App.tsx, index.ts, and TuiApp.tsx

**Files:**
- Modify: `apps/cli/src/components/App.tsx:153-163`
- Modify: `apps/cli/src/index.ts:108-117`
- Modify: `apps/cli/src/components/tui/TuiApp.tsx:65-98`

No new tests needed — these are non-critical fire-and-forget calls following the same pattern as the existing `saveEntry` calls.

### Step 1: Update `App.tsx`

Find the existing try/catch block around `saveEntry` (~line 157):

```typescript
// Auto-save to trend history
try {
  const { saveEntry } = await import("../lib/history.js");
  saveEntry(r);
} catch {
  // Non-critical — silently ignore history save failures
}
```

Replace with:

```typescript
// Auto-save to trend history and last-report snapshot
try {
  const { saveEntry, saveLastReport } = await import("../lib/history.js");
  saveEntry(r);
  saveLastReport(r);
} catch {
  // Non-critical — silently ignore history save failures
}
```

### Step 2: Update `index.ts`

Find the existing try/catch block around `saveEntry` in the `--json` path (~line 109):

```typescript
// Auto-save to trend history
try {
  const { saveEntry } = await import("./lib/history.js");
  saveEntry(report);
} catch {
  // Non-critical
}
```

Replace with:

```typescript
// Auto-save to trend history and last-report snapshot
try {
  const { saveEntry, saveLastReport } = await import("./lib/history.js");
  saveEntry(report);
  saveLastReport(report);
} catch {
  // Non-critical
}
```

### Step 3: Update `TuiApp.tsx`

Find the `handleScanComplete` callback (~line 65). After the `setLastScanTime(new Date())` call, add:

```typescript
// Auto-save last report snapshot
try {
  const { saveLastReport } = await import("../../lib/history.js");
  saveLastReport(result);
} catch {
  // Non-critical
}
```

The full updated block looks like:

```typescript
const handleScanComplete = useCallback(
  async (result: VitalsReport) => {
    const prevScore = reportRef.current?.overallScore ?? null;
    if (prevScore !== null) setPreviousScore(prevScore);
    setLastScanTime(new Date());

    // Auto-save last report snapshot
    try {
      const { saveLastReport } = await import("../../lib/history.js");
      saveLastReport(result);
    } catch {
      // Non-critical
    }

    const delta =
      prevScore !== null ? result.overallScore - prevScore : null;
    addActivity(
      "scan-complete",
      `Scan complete: ${result.overallScore}/100${delta !== null ? ` (${delta >= 0 ? "+" : ""}${delta})` : ""}`,
    );
    // ... rest of function unchanged
```

### Step 4: Run the full CLI test suite

```bash
pnpm --filter @vitals/cli test
```

Expected: all existing tests still pass

### Step 5: Commit

```bash
git add apps/cli/src/components/App.tsx apps/cli/src/index.ts apps/cli/src/components/tui/TuiApp.tsx
git commit -m "feat: auto-save last report to .vitals/last-report.json on every scan"
```

---

## Task 3: Score reveal animation in ScorePanel

**Files:**
- Modify: `apps/cli/src/components/tui/ScorePanel.tsx`
- Modify: `apps/cli/src/components/tui/ScorePanel.test.tsx`

### Step 1: Update existing tests to use fake timers

The animation starts at 0 and counts up, so `lastFrame()` immediately after render won't show the final score. Update `ScorePanel.test.tsx`:

At the top of the file, add these imports:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
```

Wrap the tests that check the final score value in fake timers. Replace the `"displays score as X/100"` test and update all tests that check the rendered score number:

```typescript
describe("ScorePanel — animation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at 0 before animation completes", () => {
    // No fake timers — check the initial render
    const report = createMockReport(85);
    const { lastFrame } = render(
      <ScorePanel report={report} previousScore={null} />
    );
    // Score should start animating from 0
    expect(lastFrame()).toContain("0/100");
  });

  it("reaches target score after animation completes", async () => {
    vi.useFakeTimers();
    const report = createMockReport(85);
    const { lastFrame } = render(
      <ScorePanel report={report} previousScore={null} />
    );
    // 85 ticks × 20ms = 1700ms; advance past that
    await vi.advanceTimersByTimeAsync(2000);
    expect(lastFrame()).toContain("85/100");
  });

  it("animates from previous score on re-scan, not from 0", async () => {
    vi.useFakeTimers();
    const { rerender, lastFrame } = render(
      <ScorePanel report={createMockReport(80)} previousScore={null} />
    );
    // Let first animation complete
    await vi.advanceTimersByTimeAsync(2000);
    expect(lastFrame()).toContain("80/100");

    // Re-scan: score goes 80 → 85
    rerender(<ScorePanel report={createMockReport(85)} previousScore={80} />);
    // After a short time (5 ticks × 20ms = 100ms) should be partway through
    await vi.advanceTimersByTimeAsync(60);
    const mid = lastFrame() ?? "";
    // Should be between 80 and 85 — not back at 0
    expect(mid).not.toContain("0/100");
    // Complete animation
    await vi.advanceTimersByTimeAsync(200);
    expect(lastFrame()).toContain("85/100");
  });
});
```

Also update these existing tests that check score display to advance timers:

```typescript
it("displays score as X/100", async () => {
  vi.useFakeTimers();
  const report = createMockReport(85);
  const { lastFrame } = render(
    <ScorePanel report={report} previousScore={null} />
  );
  await vi.advanceTimersByTimeAsync(2000);
  expect(lastFrame()).toContain("85/100");
});

it("renders score of 0", () => {
  // Score 0 — no animation needed (already at 0)
  const report = createMockReport(0);
  const { lastFrame } = render(
    <ScorePanel report={report} previousScore={null} />
  );
  expect(lastFrame()).toContain("0/100");
});

it("renders score of 100", async () => {
  vi.useFakeTimers();
  const report = createMockReport(100);
  const { lastFrame } = render(
    <ScorePanel report={report} previousScore={null} />
  );
  await vi.advanceTimersByTimeAsync(2500);
  expect(lastFrame()).toContain("100/100");
});

it("renders score bar characters for non-zero score", async () => {
  vi.useFakeTimers();
  const report = createMockReport(85);
  const { lastFrame } = render(
    <ScorePanel report={report} previousScore={null} />
  );
  await vi.advanceTimersByTimeAsync(2000);
  expect(lastFrame()).toContain("█");
});
```

The remaining tests (delta display, critical/warnings/info counts, waiting state) do not depend on the animated score number and need no changes.

### Step 2: Run to verify failures

```bash
pnpm --filter @vitals/cli test -- --reporter=verbose ScorePanel
```

Expected: several tests FAIL because animation not implemented yet

### Step 3: Implement animation in `ScorePanel.tsx`

Replace the entire file contents:

```typescript
import React, { useState, useEffect, useRef } from "react";
import { Box, Text } from "ink";
import type { VitalsReport } from "@vitals/core";

interface ScorePanelProps {
  report: VitalsReport | null;
  previousScore: number | null;
}

function scoreColor(score: number): string {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  return "red";
}

function scoreBar(score: number, width = 15): string {
  const filled = Math.round((score / 100) * width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

export function ScorePanel({ report, previousScore }: ScorePanelProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const prevTargetRef = useRef(0);

  useEffect(() => {
    if (!report) {
      setDisplayScore(0);
      prevTargetRef.current = 0;
      return;
    }

    const target = report.overallScore;
    const start = prevTargetRef.current;
    prevTargetRef.current = target;

    if (start === target) return;

    let current = start;
    const step = target > start ? 1 : -1;

    const id = setInterval(() => {
      current += step;
      setDisplayScore(current);
      if (current === target) clearInterval(id);
    }, 20);

    return () => clearInterval(id);
  }, [report]);

  if (!report) {
    return (
      <Box>
        <Text dimColor>Waiting for scan...</Text>
      </Box>
    );
  }

  const delta = previousScore !== null ? report.overallScore - previousScore : null;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={scoreColor(displayScore)} bold>
          {displayScore}/100
        </Text>
        <Text> </Text>
        <Text color={scoreColor(displayScore)}>{scoreBar(displayScore)}</Text>
      </Box>
      {delta !== null && (
        <Text dimColor>
          {delta > 0 ? `+${delta}` : delta === 0 ? "\u00B10" : `${delta}`} since last scan
        </Text>
      )}
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color="red">{"\u2717"} {report.summary.critical} critical</Text>
          <Text>{"  "}</Text>
          <Text color="yellow">{"\u26A0"} {report.summary.warnings} warn</Text>
          <Text>{"  "}</Text>
          <Text dimColor>i {report.summary.info} info</Text>
        </Box>
      </Box>
    </Box>
  );
}
```

Note: delta still uses `report.overallScore` (the real score), not `displayScore` — the delta is factual information, not part of the animation.

### Step 4: Run tests to verify they pass

```bash
pnpm --filter @vitals/cli test -- --reporter=verbose ScorePanel
```

Expected: all ScorePanel tests PASS

### Step 5: Commit

```bash
git add apps/cli/src/components/tui/ScorePanel.tsx apps/cli/src/components/tui/ScorePanel.test.tsx
git commit -m "feat: animate score reveal in TUI score panel"
```

---

## Task 4: `visible` prop on PanelBorder

**Files:**
- Modify: `apps/cli/src/components/tui/PanelBorder.tsx`
- Modify: `apps/cli/src/components/tui/PanelBorder.test.tsx`

### Step 1: Write failing tests

Add to `PanelBorder.test.tsx` after the existing tests:

```typescript
it("renders placeholder when visible is false", () => {
  const { lastFrame } = render(
    <PanelBorder title="Score" color="blue" visible={false}>
      <Text>real content</Text>
    </PanelBorder>
  );
  const output = lastFrame() ?? "";
  expect(output).toContain("···");
  expect(output).not.toContain("real content");
});

it("renders children when visible is true", () => {
  const { lastFrame } = render(
    <PanelBorder title="Score" color="blue" visible={true}>
      <Text>real content</Text>
    </PanelBorder>
  );
  expect(lastFrame()).toContain("real content");
});

it("renders children when visible is omitted (defaults to true)", () => {
  const { lastFrame } = render(
    <PanelBorder title="Score" color="blue">
      <Text>real content</Text>
    </PanelBorder>
  );
  expect(lastFrame()).toContain("real content");
});
```

### Step 2: Run to verify failure

```bash
pnpm --filter @vitals/cli test -- --reporter=verbose PanelBorder
```

Expected: the new `visible` tests FAIL

### Step 3: Implement `visible` prop in `PanelBorder.tsx`

```typescript
import React from "react";
import { Box, Text } from "ink";

interface PanelBorderProps {
  title: string;
  color: string;
  focused?: boolean;
  visible?: boolean;
  children: React.ReactNode;
}

export function PanelBorder({ title, color, focused, visible = true, children }: PanelBorderProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle={focused ? "double" : "single"}
      borderColor={focused ? color : "gray"}
      paddingX={1}
      flexGrow={1}
    >
      <Text bold color={color}>
        {title}
      </Text>
      {visible ? children : <Text dimColor>···</Text>}
    </Box>
  );
}
```

### Step 4: Run tests to verify they pass

```bash
pnpm --filter @vitals/cli test -- --reporter=verbose PanelBorder
```

Expected: all PanelBorder tests PASS

### Step 5: Commit

```bash
git add apps/cli/src/components/tui/PanelBorder.tsx apps/cli/src/components/tui/PanelBorder.test.tsx
git commit -m "feat: add visible prop to PanelBorder for entrance animation support"
```

---

## Task 5: Panel entrance animation in TuiApp

**Files:**
- Modify: `apps/cli/src/components/tui/TuiApp.tsx`

No separate unit test for the stagger logic — it depends on Ink layout and multiple mocked hooks; behavioural correctness is visible immediately on `vitals tui`. The `PanelBorder` `visible` prop is already tested.

### Step 1: Add `visiblePanels` state and stagger effect to `TuiApp.tsx`

At the top of the `TuiApp` function body, after the existing state declarations, add:

```typescript
const [visiblePanels, setVisiblePanels] = useState<Set<string>>(new Set());
```

Then add a new `useEffect` after the existing state declarations (before the `addActivity` callback):

```typescript
// Panel entrance animation — stagger panels appearing on mount
useEffect(() => {
  const schedule: Array<[string, number]> = [
    ["health", 0],
    ["score", 120],
    ["trend", 240],
    ["git", 360],
    ["quickwins", 480],
    ["activity", 600],
  ];
  const timers = schedule.map(([panel, delay]) =>
    setTimeout(() => {
      setVisiblePanels((prev) => new Set([...prev, panel]));
    }, delay),
  );
  return () => timers.forEach(clearTimeout);
}, []);
```

### Step 2: Pass `visible` prop to each PanelBorder in the normal grid layout

In the normal grid layout section (the final `return` statement, **not** the expanded panel section), add `visible` to each `PanelBorder`:

```tsx
{/* Top Row */}
<Box height={topHeight}>
  <Box width="55%">
    <PanelBorder
      title="HEALTH CHECKS"
      color="green"
      focused={focusedPanel === "health"}
      visible={visiblePanels.has("health")}
    >
```

```tsx
    <Box height="50%">
      <PanelBorder title="SCORE" color="blue" visible={visiblePanels.has("score")}>
```

```tsx
    <Box height="50%">
      <PanelBorder
        title="TREND"
        color="magenta"
        focused={focusedPanel === "trend"}
        visible={visiblePanels.has("trend")}
      >
```

```tsx
  <Box width="25%">
    <PanelBorder
      title="GIT STATUS"
      color="yellow"
      focused={focusedPanel === "git"}
      visible={visiblePanels.has("git")}
    >
```

```tsx
  <Box width="30%">
    <PanelBorder
      title={monorepoReport ? "MONOREPO" : "QUICK WINS"}
      color="red"
      focused={focusedPanel === "quickwins"}
      visible={visiblePanels.has("quickwins")}
    >
```

```tsx
  <Box width="45%">
    <PanelBorder
      title="ACTIVITY"
      color="cyan"
      focused={focusedPanel === "activity"}
      visible={visiblePanels.has("activity")}
    >
```

The expanded panel section does **not** need `visible` — if a user explicitly expands a panel, it should always show content.

### Step 3: Run the full CLI test suite

```bash
pnpm --filter @vitals/cli test
```

Expected: all tests pass

### Step 4: Smoke test visually

```bash
node apps/cli/dist/index.js tui --path fixtures/packages/react-app
```

Watch for: panels appearing one by one over ~600ms on startup. Rebuild first if needed:

```bash
pnpm --filter @vitals/cli build && node apps/cli/dist/index.js tui --path fixtures/packages/react-app
```

### Step 5: Commit

```bash
git add apps/cli/src/components/tui/TuiApp.tsx
git commit -m "feat: stagger TUI panel entrance animations on startup"
```

---

## Task 6: Move kanban tasks to Done

Update `.claude/kanban.md` — move these three items from Backlog to Done:
- Auto-save last report to `.vitals/last-report.json`
- TUI score reveal animation
- TUI panel entrance animations

```bash
git add .claude/kanban.md
git commit -m "chore: mark polish features complete on kanban"
```
