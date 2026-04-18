# Warning Presentation Redesign

## Problem

The dashboard sidebar and issues table show raw issue counts, treating 379 identical "Inline object in JSX prop" warnings the same as 379 distinct problems. A single noisy check (react-perf) inflates the warning count from ~11 meaningful warning types to 390 total, making the health summary misleading.

## Goals

1. Sidebar summary shows unique warning types as the headline number, with raw total accessible as secondary text
2. Issues table groups identical patterns into collapsible sections instead of a flat list
3. React-perf scoring uses diminishing returns so repeated instances of the same pattern don't crater the score

## Non-goals

- Changing the `SickbayReport.summary` type shape (raw counts stay in the data)
- Changing JSON output format (`--json` still emits every individual issue)
- Modifying the global scoring engine in `scoring.ts`
- Adding a grouped/flat toggle to the issues table (ship grouped-only, add toggle if users ask)

## Design

### Grouping key logic

Issue messages follow several formats across runners:

- **react-perf (file:line prefix)**: `src/App.tsx:27 — Inline object in JSX prop — creates new reference every render`
- **complexity (file + stats prefix)**: `src/components/Foo.tsx (component): 450 lines — consider splitting (threshold: 300)`
- **Plain (no prefix)**: `Missing React.lazy() for code splitting`

The grouping key is `${checkId}::${patternStem}` where `patternStem` is extracted by:

1. If the message contains ` — ` (space-em-dash-space): take everything after the first occurrence
2. Otherwise: use the full message as the stem

**Important caveat**: This works well for react-perf (the main offender) where the variable part (file:line) is before the delimiter and the stable pattern is after. For complexity, the variable part (line count) is also before the delimiter, so `consider splitting (threshold: 300)` becomes the stem — which groups all complexity warnings for the same threshold together. This is acceptable behavior: complexity issues are naturally per-file and rarely produce the kind of repetitive volume that motivated this redesign.

The `extractPatternStem` and `countUniqueIssues` utility functions will be defined in **both** the web and CLI packages independently, since CLI cannot import from web. The implementation is ~15 lines total — small enough that duplication is preferable to creating a shared package or adding to core for a presentation concern.

### Step 1: Sidebar summary

**Files**:
- `apps/web/src/components/Dashboard.tsx` — monorepo sidebar (lines 167-171) and single-project sidebar (lines 286-292)
- `apps/web/src/components/MonorepoOverview.tsx` — header summary (lines 127-131) and `PackageScoreCard` (lines 70-80)
- `apps/cli/src/components/Summary.tsx` — single-project summary (lines 40-42)
- `apps/cli/src/components/App.tsx` — monorepo per-package rows (line 367) and overall monorepo summary (lines 376-378)
- `apps/cli/src/components/tui/ScorePanel.tsx` — persistent TUI score panel (lines 84-92)

Add a utility function to count unique warning/critical/info patterns from a checks array:

```ts
function extractPatternStem(message: string): string {
  const idx = message.indexOf(' \u2014 ');
  return idx >= 0 ? message.slice(idx + 3) : message;
}

function countUniqueIssues(checks: CheckResult[]): {
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

**Display format**: Change from:

```
3 critical · 390 warnings
```

To:

```
3 critical · 11 warnings (390 total)
```

The parenthetical raw total only appears when `total > uniqueCount`. When they're equal (no duplicates), just show the number without parenthetical.

**CLI `App.tsx` monorepo path**: The per-package rows at line 367 show only critical counts and don't show warnings, so no change needed there. The overall monorepo summary at lines 376-378 shows `summary.warnings` and needs the same unique-count treatment. `App.tsx` receives the full `MonorepoReport` which contains `packages[].checks`, so the data is available — compute unique counts by iterating all packages' checks.

**CLI `ScorePanel.tsx`**: The TUI score panel at lines 84-92 shows raw counts. Apply the same unique-count treatment. `ScorePanel` receives the full `SickbayReport` so `report.checks` is available.

### Step 2: Issues table grouped view

**File**: `apps/web/src/components/IssuesList.tsx`

Replace the flat list with grouped sections:

1. After filtering by severity, group issues by `${checkId}::${patternStem}`
2. Each group renders as a collapsible section:
   - **Header row**: severity badge color (border-left), pattern stem text, check name, instance count badge, expand/collapse chevron
   - **Expanded content**: individual `IssueRow` components for each instance (existing component, unchanged)
3. Groups are collapsed by default
4. Groups sorted by: severity (critical first), then instance count (descending)
5. Filter button counts show unique group counts, not raw issue counts. Example: `warning (11)` not `warning (390)`
6. The `all` count also reflects unique groups

**Single-instance groups** (only 1 issue in the group): render as a plain `IssueRow` with no expand/collapse affordance — no visual change from current behavior for non-repeated issues.

### Step 3: React-perf diminishing returns

**File**: `packages/core/src/integrations/react-perf.ts`

Change the scoring formula from linear to diminishing returns per unique pattern.

Current:
```ts
const score = Math.max(20, 100 - warningCount * 3 - infoCount * 1);
```

New — uses `Finding.pattern` (not `Issue.message`, which includes the file prefix):
```ts
// Group findings by pattern stem — the stable description after the first ' — ' delimiter.
// For "Inline object in JSX prop — creates new reference every render" → "creates new reference every render"
// For "Large component file (450 lines, threshold: 300) — consider splitting" → "consider splitting"
// This matches the extractPatternStem logic used in the presentation layer (Step 2).
const patternCounts = new Map<string, { warnings: number; infos: number }>();
for (const f of activeFindings) {
  const idx = f.pattern.indexOf(' \u2014 ');
  const key = idx >= 0 ? f.pattern.slice(idx + 3) : f.pattern;
  const entry = patternCounts.get(key) ?? { warnings: 0, infos: 0 };
  if (f.severity === 'warning') entry.warnings++;
  else entry.infos++;
  patternCounts.set(key, entry);
}

// Each unique pattern: 10 base + log2(count) * 3 for warnings, 3 base + log2(count) for info
let penalty = 0;
for (const [, counts] of patternCounts) {
  if (counts.warnings > 0) penalty += 10 + Math.log2(counts.warnings) * 3;
  if (counts.infos > 0) penalty += 3 + Math.log2(counts.infos);
}
const score = Math.max(20, Math.round(100 - penalty));
```

Effect on GitRelic's `@gitrelic/web` (379 inline objects, 1 pattern):
- Old: `100 - 379*3 = floor 20`
- New: `100 - (10 + log2(379)*3) = 100 - (10 + 25.5) = 64` — a fair warning, not a catastrophic score

Effect on a project with 5 different warning patterns, 3 instances each:
- Old: `100 - 15*3 = 55`
- New: `100 - 5*(10 + log2(3)*3) = 100 - 5*(10 + 4.75) = 26` — diverse problems are punished harder

This correctly reflects that pattern diversity is worse than pattern volume.

## Files to modify

| File | Change |
|------|--------|
| `apps/web/src/components/Dashboard.tsx` | Sidebar summary: unique counts + raw total |
| `apps/web/src/components/IssuesList.tsx` | Grouped view with expandable sections |
| `apps/web/src/components/MonorepoOverview.tsx` | Summary counts in header + PackageScoreCard |
| `apps/cli/src/components/Summary.tsx` | CLI single-project summary: unique counts + raw total |
| `apps/cli/src/components/App.tsx` | CLI monorepo overall summary: unique counts + raw total |
| `apps/cli/src/components/tui/ScorePanel.tsx` | TUI score panel: unique counts + raw total |
| `packages/core/src/integrations/react-perf.ts` | Diminishing returns scoring |

## Testing

- **react-perf.test.ts**: Add test for diminishing returns scoring — verify that 379 identical warnings score higher than the floor, and that diverse patterns score lower than repeated single patterns
- **IssuesList.test.tsx**: Add test that issues with identical patterns are grouped, single-instance groups render without expand/collapse
- **Dashboard.test.tsx**: Verify sidebar shows unique counts with parenthetical totals
- **Summary.test.tsx**: Verify CLI output shows unique counts
- **App.test.tsx**: Verify monorepo summary shows unique counts
- **ScorePanel.test.tsx**: Verify TUI score panel shows unique counts
- **Snapshot regression tests**: Will need snapshot updates since react-perf scores will change
