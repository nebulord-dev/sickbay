# Polish Features Design: Auto-save, Score Animation, Panel Entrance

**Date:** 2026-02-26
**Status:** Approved

## Overview

Three self-contained polish features that improve discoverability and UX:

1. Auto-save last report to `.vitals/last-report.json`
2. TUI score reveal animation
3. TUI panel entrance animations

---

## Feature 1: Auto-save Last Report

### Goal

After every scan, write the full JSON report to `.vitals/last-report.json` in the scanned project's directory. Always overwrite — no history accumulation. Makes the report immediately discoverable by Claude Code and other tools without any flags.

### Implementation

Add `saveLastReport(report, projectPath)` to `apps/cli/src/lib/history.ts`:
- Ensures `.vitals/` directory exists (same guard as `saveEntry`)
- Writes `JSON.stringify(report, null, 2)` to `<projectPath>/.vitals/last-report.json`
- Silent fail — non-critical, same pattern as history saves

Hook it in three places:
- `App.tsx` — after the `saveEntry` call in the `runVitals` `.then()` block
- `index.ts` — in the `--json` path after `saveEntry`
- `TuiApp.tsx` — in `handleScanComplete` alongside history regression detection

Monorepo scans (`runVitalsMonorepo`) are excluded for now — the report shape differs and the use case is less clear.

---

## Feature 2: TUI Score Reveal Animation

### Goal

When a scan completes and the score panel updates, animate the score counting up rather than snapping to the final value. On first load, count from 0. On re-scans, count from the previous score. Color transitions naturally through red → yellow → green as the number crosses thresholds.

### Implementation

In `ScorePanel.tsx`:
- Add `displayScore` state, initialized to `0`
- `useEffect` on `report` changes:
  - Track `prevTarget` ref to know the previous score
  - If report is null, reset `displayScore` to 0
  - Otherwise, count from `prevTarget` (or 0 on first load) to `report.overallScore`
  - Interval: 20ms per tick — fast enough that even a score of 100 from zero takes 2s; small deltas on re-scans complete near-instantly
  - Clear interval on cleanup
- Render `displayScore` in place of `score` for the number and score bar
- Score bar and color both use `displayScore` so they animate in sync

---

## Feature 3: TUI Panel Entrance Animations

### Goal

On TUI startup, panels appear sequentially rather than all at once — a "cockpit powering on" feel. Only runs once on mount, never on re-scans.

### Implementation

In `TuiApp.tsx`:
- Add `visiblePanels` state: `Set<string>`, initially empty
- On mount, stagger `setTimeout` calls adding each panel ID to the set:

| Panel     | Delay  |
|-----------|--------|
| health    | 0ms    |
| score     | 120ms  |
| trend     | 240ms  |
| git       | 360ms  |
| quickwins | 480ms  |
| activity  | 600ms  |

- Each `PanelBorder` in the grid receives a `visible` prop
- `PanelBorder` renders a dim `···` placeholder when `visible` is false, full content when true
- Expanded panel mode skips the visibility check (always renders when explicitly expanded)

### PanelBorder changes

Add optional `visible?: boolean` prop (defaults to `true` for backwards compatibility). When `false`, render children replaced with:

```tsx
<Text dimColor>···</Text>
```

---

## Testing Notes

- Score animation: test that `displayScore` starts at 0, increments, and reaches `report.overallScore`; test that re-scan starts from previous score not 0
- Panel entrance: test that `visiblePanels` starts empty and panels are added in staggered order
- Auto-save: test that `saveLastReport` writes to correct path and overwrites on second call
