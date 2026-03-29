# Star Trek Doctor Rotating Quotes

## Goal

Add personality to Sickbay output with severity-tiered quotes from Star Trek doctors, selected randomly at scan time. This is the foundation for a future themeable quote system — designed so the config/theme layer plugs in later without a rewrite.

## How It Works

Quote selection happens in **core** and the chosen quote is attached to the `SickbayReport`. All consumers (CLI, TUI, web) just render `report.quote`. This keeps the logic centralized and ensures every output surface shows the same quote for a given scan.

## Type Changes

### `packages/core/src/types.ts`

Add a `Quote` interface and an optional `quote` field on `SickbayReport`:

```typescript
export interface Quote {
  text: string;
  source: string;     // "Dr. McCoy", "The Doctor", etc.
  severity: 'critical' | 'warning' | 'info' | 'allClear';
}
```

Add to `SickbayReport`:
```typescript
export interface SickbayReport {
  // ... existing fields ...
  quote?: Quote;
}
```

The field is optional so:
- Reports generated with `--no-quotes` omit it
- Existing reports without quotes still parse correctly (backwards compatible)
- A future "vanilla" theme that disables personality just leaves it undefined

## Quote Data

### `packages/core/src/quotes/startrek.json`

JSON file with four severity tiers, each containing 8-10 quotes from Trek doctors:

```json
{
  "critical": [
    { "text": "He's dead, Jim.", "source": "Dr. McCoy" },
    { "text": "I'm a doctor, not a miracle worker!", "source": "Dr. McCoy" },
    ...
  ],
  "warning": [
    { "text": "I'm a doctor, not an engineer!", "source": "Dr. McCoy" },
    { "text": "Please state the nature of the medical emergency.", "source": "The Doctor" },
    ...
  ],
  "info": [
    { "text": "I'm a doctor, not a DevOps engineer.", "source": "Dr. McCoy" },
    { "text": "The prognosis is... acceptable.", "source": "The Doctor" },
    ...
  ],
  "allClear": [
    { "text": "Vital signs are stable. For now.", "source": "Dr. McCoy" },
    { "text": "Optimism, Captain!", "source": "Dr. Phlox" },
    ...
  ]
}
```

**Doctors to include across all tiers:** McCoy (TOS), Crusher (TNG), The Doctor (VOY), Bashir (DS9), Phlox (ENT), T'Ana (Lower Decks). Distribute so no single doctor dominates — aim for 2-3 quotes per doctor spread across tiers that match their personality.

The implementer should write all 32-40 quotes. The examples above are illustrative — fill with real or paraphrased Trek quotes that fit each severity tier's vibe:
- `critical` — dire, alarmed, dramatic
- `warning` — concerned, cautious, irritated
- `info` — mild, cantankerous, wry
- `allClear` — rare optimism, grudging approval

## Selection Logic

### `packages/core/src/quotes/index.ts`

Note: importing JSON requires `resolveJsonModule: true` in the core tsconfig. Verify this is set — if not, add it. tsup handles JSON imports by default.

```typescript
import type { Quote } from '../types.js';
import startrekQuotes from './startrek.json';

export type SeverityTier = 'critical' | 'warning' | 'info' | 'allClear';

export function getQuote(overallScore: number): Quote {
  const severity = scoreToTier(overallScore);
  const pool = startrekQuotes[severity];
  const entry = pool[Math.floor(Math.random() * pool.length)];
  return {
    text: entry.text,
    source: entry.source,
    severity,
  };
}

function scoreToTier(score: number): SeverityTier {
  if (score < 60) return 'critical';
  if (score < 80) return 'warning';
  if (score < 90) return 'info';
  return 'allClear';
}
```

**Future-proofing:** When `sickbay.config.ts` lands, `getQuote` gains a config parameter. It checks for user overrides/extensions first, falls back to built-in Star Trek. The function signature grows but doesn't break — consumers don't care where the quote came from.

## Wiring

### `packages/core/src/runner.ts`

After scoring in `runSickbay`, conditionally attach a quote:

```typescript
const report: SickbayReport = {
  // ... existing fields ...
  quote: options.quotes !== false ? getQuote(overallScore) : undefined,
};
```

After scoring in `runSickbayMonorepo`, attach a quote to the `MonorepoReport`:

```typescript
const monorepoReport: MonorepoReport = {
  // ... existing fields ...
  quote: options.quotes !== false ? getQuote(overallScore) : undefined,
};
```

**Individual `PackageReport` does NOT get a quote** — per-package quotes would be noise. Only the top-level report (single-project or monorepo aggregate) gets one.

### `RunnerOptions` addition

Add to `RunnerOptions`:
```typescript
quotes?: boolean;  // default true, set to false via --no-quotes
```

Since `runSickbayMonorepo` spreads `...options` when calling `runSickbay` per-package, the `quotes` option flows through automatically. But per-package `runSickbay` calls will generate quotes that get discarded when mapped to `PackageReport` — this is fine since `PackageReport` has no `quote` field.

### `MonorepoReport` type addition

Add `quote?: Quote` to `MonorepoReport` in `types.ts` alongside the existing `SickbayReport` change.

## CLI Flag

### `apps/cli/src/index.ts`

Add `--no-quotes` flag to the root Commander config:

```typescript
.option('--no-quotes', 'Suppress personality quotes in output')
```

**All `runSickbay` call sites must pass the `quotes` option.** There are multiple call sites in `index.ts` — update ALL of them:

1. **Line ~76** — `--package` + `--json` path: `runSickbay({ projectPath: targetPath, checks, verbose: options.verbose, quotes: options.quotes })`
2. **Lines ~95-98** — monorepo + `--json` path: `runSickbayMonorepo({ projectPath: options.path, checks, verbose: options.verbose, quotes: options.quotes })`
3. **Lines ~104-107** — single project + `--json` path: `runSickbay({ projectPath: options.path, checks, verbose: options.verbose, quotes: options.quotes })`
4. **Line ~352** — `badge` command's `runSickbay` call: pass `quotes: false` (badge only uses the score, quotes are irrelevant)

**For the `<App>` component** (line ~82 and similar): add a `quotes` prop that gets passed through to `runSickbay` inside the component.

**For the `tui` subcommand**: add `--no-quotes` as an option on the tui command as well (subcommands don't inherit parent options automatically in Commander). The TUI's `useSickbayRunner` hook passes options to `runSickbay` — thread the `quotes` option through.

The flag applies to:
- Default scan (`sickbay`)
- JSON output (`sickbay --json`) — the `quote` field is omitted from JSON when `--no-quotes`
- Web mode (`sickbay --web`) — the report served to the dashboard has no quote
- TUI (`sickbay tui --no-quotes`) — no quote in score panel
- Monorepo scans — the aggregate `MonorepoReport` omits the quote

## Rendering

### CLI — `apps/cli/src/components/Summary.tsx`

After the existing summary output, conditionally render the quote:

```tsx
{report.quote && (
  <Box marginTop={1}>
    <Text italic dimColor>"{report.quote.text}"</Text>
    <Text dimColor> — {report.quote.source}</Text>
  </Box>
)}
```

### TUI — `apps/cli/src/components/tui/ScorePanel.tsx`

Below the score display, show the quote in a compact format:

```tsx
{report?.quote && (
  <Box>
    <Text italic dimColor>"{report.quote.text}" — {report.quote.source}</Text>
  </Box>
)}
```

### Web — `apps/web/src/components/Dashboard.tsx` (or near the overall score)

Near the overall score card, render the quote:

```tsx
{report.quote && (
  <p className="text-sm italic text-gray-400 mt-2">
    "{report.quote.text}" <span className="not-italic">— {report.quote.source}</span>
  </p>
)}
```

Note: `report.quote` is typed data from the JSON report — the web package reads it as a plain object. No value imports from core needed, only `import type { Quote }` if typing is desired.

## Files to Create

### `packages/core/src/quotes/startrek.json`
- 4 severity tiers, 8-10 quotes each, across 6 Trek doctors

### `packages/core/src/quotes/index.ts`
- `getQuote(overallScore)` function
- `scoreToTier()` helper
- Types for quote entries

## Files to Modify

### `packages/core/src/types.ts`
- Add `Quote` interface
- Add `quote?: Quote` to `SickbayReport`
- Add `quote?: Quote` to `MonorepoReport`

### `packages/core/src/runner.ts`
- Import `getQuote` from `./quotes`
- Add `quotes?: boolean` to `RunnerOptions`
- Attach `quote` to the `SickbayReport` after scoring (conditionally)
- Attach `quote` to the `MonorepoReport` after scoring (conditionally)

### `packages/core/src/index.ts`
- Export `Quote` type (consumers need it for typing)

### `packages/core/tsconfig.json`
- Verify `resolveJsonModule: true` is set (required for `startrek.json` import). Add if missing.

### `apps/cli/src/index.ts`
- Add `--no-quotes` flag to root Commander config
- Pass `quotes: options.quotes` through ALL `runSickbay` and `runSickbayMonorepo` call sites (4 total — see CLI Flag section for exact locations)
- Pass `quotes: false` for the `badge` command's `runSickbay` call
- Add `quotes` prop to `<App>` component rendering

### `apps/cli/src/components/App.tsx`
- Accept `quotes` prop, pass through to `runSickbay` call

### `apps/cli/src/components/tui/TuiApp.tsx` (or the tui command setup)
- Add `--no-quotes` option to the `tui` subcommand
- Thread `quotes` through to `useSickbayRunner`

### `apps/cli/src/components/tui/hooks/useSickbayRunner.ts`
- Accept `quotes` option, pass through to `runSickbay`

### `apps/cli/src/components/Summary.tsx`
- Render `report.quote` after the summary

### `apps/cli/src/components/tui/ScorePanel.tsx`
- Render `report.quote` below the score

### `apps/web/src/components/Dashboard.tsx` (or `ScoreCard.tsx`)
- Render `report.quote` near the overall score
- Use `import type { Quote }` from core only — no value imports

## Tests

### `packages/core/src/quotes/index.test.ts`
- `getQuote` returns a valid Quote for each score range
- All severity tiers have quotes (no empty arrays)
- Score boundary tests: 59→critical, 60→warning, 79→warning, 80→info, 89→info, 90→allClear

### `packages/core/src/runner.test.ts`
- Report includes `quote` by default
- Report omits `quote` when `quotes: false` is passed

### `apps/cli/src/components/Summary.test.tsx`
- Quote renders when present on report
- No quote section when `report.quote` is undefined

### `apps/cli/src/components/tui/ScorePanel.test.tsx`
- Quote renders when present
- No quote when absent

### `apps/web/src/components/Dashboard.test.tsx` (or relevant component)
- Quote renders when present
- No quote when absent

## Kanban Update

After implementation, update the icebox "Star Trek doctor rotating quotes" task to Done, and update the "Themeable personality quotes" task description to note that the foundation (built-in Star Trek quotes, `getQuote` API, `Quote` type on report, `--no-quotes` flag) is shipped — the remaining work is config-driven theme selection, community theme packages, and user quote overrides.

## Monorepo Architect Review

Dispatch monorepo-architect agent as final step to verify:
- No value imports from core in web (only `import type`)
- Quote logic lives entirely in core
- Rendering logic lives in the correct consumer packages
