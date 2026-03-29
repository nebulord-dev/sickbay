# Plan: Star Trek Doctor Rotating Quotes

## Spec

Read the full design spec at `docs/superpowers/specs/2026-03-28-star-trek-quotes-design.md` before starting. It contains the complete type changes, quote selection logic, CLI wiring, rendering for all surfaces, and file-by-file modification list.

## Kanban Task

Move this task to Done when complete:
```
- `[Feature]` `[Auto]` Star Trek doctor rotating quotes (default theme)
```

Also update the "Themeable personality quotes" icebox entry description to note: "Foundation shipped — built-in Star Trek quotes, `getQuote` API, `Quote` type on report, `--no-quotes` flag. Remaining: config-driven theme selection, community theme packages, user quote overrides."

## Steps

### 1. Read the spec and all affected files

Read the spec thoroughly. Then read every file listed in the "Files to Modify" section to understand the current code.

### 2. Add `Quote` type and update report types

**Edit:** `packages/core/src/types.ts`

- Add the `Quote` interface:
  ```typescript
  export interface Quote {
    text: string;
    source: string;
    severity: 'critical' | 'warning' | 'info' | 'allClear';
  }
  ```
- Add `quote?: Quote` to `SickbayReport`
- Add `quote?: Quote` to `MonorepoReport`

### 3. Export `Quote` type

**Edit:** `packages/core/src/index.ts`

Add `Quote` to the type exports.

### 4. Verify `resolveJsonModule` in tsconfig

**Read:** `packages/core/tsconfig.json`

Verify `resolveJsonModule: true` is set. If not, add it (required for the JSON import in step 5).

### 5. Create the quotes data file

**Create:** `packages/core/src/quotes/startrek.json`

Write 8-10 quotes per severity tier across 6 Trek doctors (McCoy, Crusher, The Doctor, Bashir, Phlox, T'Ana). Structure:

```json
{
  "critical": [
    { "text": "...", "source": "Dr. McCoy" },
    ...
  ],
  "warning": [...],
  "info": [...],
  "allClear": [...]
}
```

**Tier vibes:**
- `critical` (score < 60) — dire, alarmed, dramatic
- `warning` (score 60-79) — concerned, cautious, irritated
- `info` (score 80-89) — mild, cantankerous, wry
- `allClear` (score 90+) — rare optimism, grudging approval

Distribute so no single doctor dominates — aim for 2-3 quotes per doctor spread across tiers. Use real or closely paraphrased Trek quotes that fit the severity vibe. Write all 32-40 quotes.

### 6. Create the quote selection module

**Create:** `packages/core/src/quotes/index.ts`

- Import `Quote` type from `../types.js`
- Import `startrekQuotes` from `./startrek.json`
- Export `getQuote(overallScore: number): Quote` — maps score to tier, picks randomly
- `scoreToTier`: < 60 → critical, 60-79 → warning, 80-89 → info, 90+ → allClear

### 7. Wire into runner

**Edit:** `packages/core/src/runner.ts`

- Import `getQuote` from `./quotes/index.js`
- Add `quotes?: boolean` to `RunnerOptions`
- In `runSickbay`: after scoring, attach `quote: options.quotes !== false ? getQuote(overallScore) : undefined` to the report
- In `runSickbayMonorepo`: same — attach quote to the `MonorepoReport` after calculating aggregate score. Individual `PackageReport` does NOT get a quote.

### 8. Add CLI flag and update all call sites

**Edit:** `apps/cli/src/index.ts`

- Add `.option('--no-quotes', 'Suppress personality quotes in output')` to root Commander config
- Update ALL `runSickbay` call sites to pass `quotes: options.quotes`:
  - `--package` + `--json` path (~line 76)
  - Monorepo + `--json` path (~lines 95-98)
  - Single project + `--json` path (~lines 104-107)
  - `badge` command (~line 352) — pass `quotes: false`
- Add `quotes` prop to `<App>` component rendering

**Edit:** `apps/cli/src/components/App.tsx`
- Accept `quotes` prop, pass through to `runSickbay` options

**Edit:** The `tui` subcommand setup (in `index.ts` or wherever the tui command is defined)
- Add `--no-quotes` option to the `tui` command
- Thread through to `TuiApp` and `useSickbayRunner`

**Edit:** `apps/cli/src/components/tui/TuiApp.tsx`
- Accept `quotes` prop, pass to `useSickbayRunner`

**Edit:** `apps/cli/src/components/tui/hooks/useSickbayRunner.ts`
- Accept `quotes` option, pass to `runSickbay`

### 9. Render quotes in CLI

**Edit:** `apps/cli/src/components/Summary.tsx`

After the existing summary output, conditionally render:
```tsx
{report.quote && (
  <Box marginTop={1}>
    <Text italic dimColor>"{report.quote.text}"</Text>
    <Text dimColor> — {report.quote.source}</Text>
  </Box>
)}
```

### 10. Render quotes in TUI

**Edit:** `apps/cli/src/components/tui/ScorePanel.tsx`

Below the score display:
```tsx
{report?.quote && (
  <Box>
    <Text italic dimColor>"{report.quote.text}" — {report.quote.source}</Text>
  </Box>
)}
```

### 11. Render quotes in web

**Edit:** `apps/web/src/components/Dashboard.tsx` (or `ScoreCard.tsx` — wherever the overall score is displayed)

Near the overall score:
```tsx
{report.quote && (
  <p className="text-sm italic text-gray-400 mt-2">
    "{report.quote.text}" <span className="not-italic">— {report.quote.source}</span>
  </p>
)}
```

**IMPORTANT:** Only use `import type` from `@sickbay/core` in the web package. The quote data is already on the report object — no value imports needed.

### 12. Write tests

- **Create:** `packages/core/src/quotes/index.test.ts`
  - `getQuote` returns a valid Quote for each score range
  - All severity tiers have quotes (no empty arrays)
  - Score boundary tests: 59→critical, 60→warning, 79→warning, 80→info, 89→info, 90→allClear

- **Edit:** `packages/core/src/runner.test.ts`
  - Report includes `quote` by default
  - Report omits `quote` when `quotes: false`

- **Edit:** `apps/cli/src/components/Summary.test.tsx`
  - Quote renders when present on report
  - No quote section when `report.quote` is undefined

- **Edit:** `apps/cli/src/components/tui/ScorePanel.test.tsx`
  - Quote renders when present
  - No quote when absent

- **Edit:** web component test (wherever the quote is rendered)
  - Quote renders when present
  - No quote when absent

### 13. Build and test

```bash
pnpm build
pnpm test
pnpm lint
```

Fix any failures.

### 14. Dispatch monorepo-architect agent

Run the monorepo-architect agent to verify:
- No value imports from core in web
- Quote logic lives entirely in core
- Rendering logic is in the correct consumer packages

### 15. Update kanban and commit

Move the Star Trek quotes task from Icebox to Done in `.claude/kanban.md`. Update the Themeable personality quotes icebox entry to note the foundation is shipped. Commit all changes with a descriptive message.
