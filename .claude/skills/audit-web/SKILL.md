---
name: audit-web
description: Use when auditing apps/web for Node.js import violations, XSS in AI chat or report rendering, Anthropic SDK browser safety, API key exposure, CSP and cross-origin contract, report loading edge cases, or dashboard component issues. Run before merging any change that touches apps/web/.
---

# Audit: apps/web

The browser dashboard. Critical constraints: never import values from `sickbay-core` (would bundle Node.js into browser), never leak the user's Anthropic API key, and never render user-controlled report data unsanitized.

## Checklist

### 1. Import Discipline (Critical)

**Rule:** `apps/web` may only use `import type` from `sickbay-core`. Any value import (functions, classes, constants) would pull in Node.js deps (execa, fs, child_process) and break the browser build.

- Search `apps/web/src/` for any `from 'sickbay-core'` — every match must be `import type`
- Search for `require('sickbay-core')` — must return zero results
- Check `apps/web/src/lib/constants.ts` — score thresholds and category weights are duplicated here intentionally. If they're missing and being imported from core instead, that's a violation
- Run `pnpm --filter sickbay-web build` — a Node.js import violation will fail the Vite build

### 2. XSS Surface

The dashboard renders user-controlled data from the scan report (file paths, issue messages, dependency names, AI responses, config contents). Review every component that renders report data:

- **AI chat (`ChatDrawer.tsx`)** — AI responses rendered as text or markdown. Check for any use of React's raw-HTML escape-hatch prop, `innerHTML`, or any markdown renderer configured to allow raw HTML. Default React text nodes and a sanitizing markdown renderer are safe; anything else needs scrutiny
- **Issue messages (`IssuesList.tsx`, `CriticalIssues.tsx`)** — `message` strings from check runners can contain file paths with special characters. Render as text nodes, not raw HTML
- **Best practices (`BestPracticesDrawer.tsx`)** — advisor recommendations may be formatted as markdown. If so, the markdown renderer must strip raw HTML
- **Config content (`ConfigTab.tsx`)** — displays the user's `sickbay.config.ts`. Should render inside a `<pre><code>` block; never interpolated into markup
- **Dependency names (`DependencyList.tsx`, `DependencyGraph.tsx`)** — generally safe but verify no HTML is injected
- **Report loading** — a malicious `?report=<base64>` URL param or `localStorage` entry could contain crafted data. Does the loader validate the report shape before rendering?

### 3. Anthropic SDK Browser Safety

`@anthropic-ai/sdk` is bundled into the browser build. The user's `ANTHROPIC_API_KEY` becomes a client-side secret.

- The SDK requires the "allow browser" flag — that's correct for this use case (the user provides their own key on their own machine). Verify the flag is scoped to this app and not being propagated elsewhere
- All Anthropic traffic goes to `api.anthropic.com` only. Check the network panel during a chat session — no telemetry endpoints, no CDN callbacks, no log aggregators receiving request headers
- No logging middleware, interceptors, or dev-tool extensions persist request headers (which contain the Authorization bearer)
- The key is never written to `localStorage` or serialized into the report — it lives only in-memory for the session
- Missing key: dashboard hides AI features entirely (no error toast, no "enter your key" prompt that could be phished)

### 4. API Key Handling (Broader)

Review `AISummary.tsx`, `ChatDrawer.tsx`:

- `ANTHROPIC_API_KEY` is never logged, serialized into the report, or sent anywhere other than the Anthropic API
- Dashboard handles missing API key gracefully — hides AI features rather than showing an error or blank
- AI responses that fail (network error, rate limit) are surfaced clearly to the user
- **Prompt injection** — the AI receives the full `SickbayReport` as context. A crafted project (e.g., a file with a name designed to manipulate the prompt) could attempt injection. Is the system prompt robust enough to resist this?

### 5. CSP and Cross-Origin Contract

The CLI serves the dashboard from localhost. The dashboard then fetches `api.anthropic.com` directly.

- Check `apps/web/index.html` for a Content-Security-Policy meta tag. If present, `connect-src` must allow `api.anthropic.com`
- Check the CLI's web server response headers (cross-reference with **audit-cli**) — if a CSP header is set there, it must be compatible with loading the bundled JS and fetching the Anthropic API
- The fetch to `/sickbay-report.json` is same-origin — no CORS surface. The fetch to Anthropic is cross-origin — ensure requests don't rely on cookies (they shouldn't; they use a bearer header)

### 6. Report Loading Edge Cases

Review `src/lib/load-report.ts`:

- `/sickbay-report.json` returns a 404 → normal when opening the dashboard standalone; must render empty-state, not crash
- JSON is malformed → caught, user-readable message, not white screen
- Structurally valid JSON but missing required fields (e.g., no `checks` array) → validated; graceful fallback
- `?report=<base64>` with invalid base64 → handled without throwing
- Size limit on `localStorage` — a very large report can fail to persist. Silent truncation is worse than a message

### 7. Monorepo Report Rendering

`MonorepoOverview.tsx` handles the multi-package report case.

- Handles a monorepo report with zero packages gracefully
- Handles packages with identical names (shouldn't happen but worth checking)
- Per-package scores computed correctly — no risk of using the wrong package's data

### 8. Display Fidelity

When components parse check issues into UI state (outdated, unused, missing, duplicated, etc.), the display must source each value from the **same place** the signal came from. Mixing scanner-reported data with `projectInfo` fields produces misleading UI without any type error.

- **`DependencyList.tsx` canonical case:** when a dep is outdated, the "current version" shown in the row must be the **installed** version parsed from the issue message (`from` in `"lodash: 4.0.0 → 4.17.21 (patch)"`), NOT the **declared range** from `report.projectInfo.dependencies` (`^4.0.0`). These diverge in pnpm catalog drift, version overrides, stale lockfile resolutions, and workspace hoisting scenarios — producing rows like `^4.1.3 → 4.1.3` that look like bugs but are actually the UI lying about what the scanner found
- **General rule:** for every derived UI state, ask "what is the source of truth?" — the check issue itself is usually the answer, not `projectInfo`
- **Test construction:** for each derived state (outdated / unused / missing / etc.), construct a test where the declared range and the scanner's reported version differ, and assert the rendered cell shows the scanner value

### 9. Dependency Graph (`DependencyGraph.tsx`)

Home-grown dep graph visualizations routinely look worse than dedicated tools and balloon bundle size.

- Is this component a thin wrapper over a mature graph library, or a bespoke renderer? The latter tends to accumulate UX bugs (overlap, unreadable on large graphs, no search)
- Performance on large monorepos — does it freeze the browser or the main thread? Any `useMemo` deps missing that recompute on every render?
- If UX is clearly worse than a dedicated tool (e.g. Node Modules Inspector), consider linking out instead of maintaining in-house. Precedent: home-grown viz was replaced with an external link in a prior cycle

### 10. Constants Drift

`apps/web/src/lib/constants.ts` duplicates scoring constants from core to avoid Node.js imports.

- Compare these values against `packages/core/src/constants.ts` and `packages/core/src/scoring.ts`
- If they've drifted, the dashboard displays wrong colors or thresholds while the CLI shows correct values
- CI smoke test idea: a test that fails if the duplicated values diverge from core's values (read core's source via a build-time script, not a value import)

### 11. Issue Grouping & Suppress Snippets (`lib/`)

- `issue-grouping.ts` — grouping must be stable across renders. Same report in, same grouped output out — otherwise the UI thrashes when the report updates
- `suppress-snippet.ts` — generates config snippets for user copy-paste. Rule IDs and paths in the snippet must be properly escaped (quoted strings, not raw interpolation)

### 12. Additional Component Coverage

Components not otherwise called out that render user-controlled data:

- `About.tsx` — mostly static but check version strings
- `HistoryChart.tsx` — numeric data only, but check tooltip formatting for injection
- `CodebaseStats.tsx` — file counts, language breakdowns. Low risk, verify render paths

## Key Files

```
apps/web/src/
├── lib/
│   ├── constants.ts           # Duplicated from core — check for drift
│   ├── load-report.ts         # Report loading — edge case handling
│   ├── issue-grouping.ts      # Stable grouping
│   └── suppress-snippet.ts    # Generated config snippets
├── components/
│   ├── AISummary.tsx          # AI integration — key handling, prompt injection
│   ├── ChatDrawer.tsx         # AI chat — XSS in rendered responses
│   ├── DependencyList.tsx     # Source-of-truth / display fidelity
│   ├── DependencyGraph.tsx    # Home-grown viz — flag for replacement if bespoke
│   ├── IssuesList.tsx         # User-controlled issue messages
│   ├── CriticalIssues.tsx     # Same XSS surface as IssuesList
│   ├── BestPracticesDrawer.tsx # Advisor recommendations
│   ├── ConfigTab.tsx          # Renders user config — sanitize
│   └── MonorepoOverview.tsx   # Multi-package report
```

## Output Format

Dispatched reviewer should report findings as:

```
[Severity: High|Medium|Low] path/to/file.tsx:123
What's wrong: <one-line description>
Why it matters: <impact on users or maintainers>
Suggested fix: <concrete change>
```

Skip visual/styling issues entirely. Prioritize: import discipline → API key exposure → XSS → display fidelity → everything else.

## How to Run

Dispatch a `feature-dev:code-reviewer` agent. First action: grep `apps/web/src/` for `from 'sickbay-core'` and flag any non-type imports. Then constants drift, then XSS surface across every component listed.

## Related Audits

- Changes that add `/` endpoints to the dashboard → cross-check **audit-cli** (web server) for CORS parity
- Changes to `constants.ts` → verify matches against core (run **audit-core** side-by-side)
- New component rendering report fields → consider XSS implications, verify source-of-truth rule
