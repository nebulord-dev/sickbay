---
name: audit-web
description: Use when auditing apps/web for Node.js import violations, XSS in AI chat or report rendering, API key exposure, or report loading edge cases.
---

# Audit: apps/web

The browser dashboard. The critical constraint: it must never import values from `sickbay-core` — that would bundle Node.js modules into the browser build.

## Checklist

### 1. Import Discipline (Critical)

**Rule:** `apps/web` may only use `import type` from `sickbay-core`. Any value import (functions, classes, constants) would pull in Node.js deps (execa, fs, child_process) and break the browser build.

- Search `apps/web/src/` for any `from 'sickbay-core'` — every match must be `import type`
- Search for `require('sickbay-core')` — must return zero results
- Check `apps/web/src/lib/constants.ts` — score thresholds and category weights are duplicated here intentionally. If they're missing and being imported from core instead, that's a violation
- Run `pnpm --filter sickbay-web build` — a Node.js import violation will fail the Vite build

### 2. XSS Surface

The dashboard renders user-controlled data from the scan report (file paths, issue messages, dependency names, AI responses). Review for injection risks:

- **AI chat (`ChatDrawer.tsx`)** — AI responses are rendered as text or markdown. Check for any raw HTML injection patterns (`innerHTML`, unsafe React props that bypass React's built-in escaping)
- **Issue messages** — issue `message` strings from check runners could contain file paths with special characters. Verify these are rendered as text nodes, not raw HTML
- **Dependency names** — rendered in `DependencyList.tsx` and `DependencyGraph.tsx`. Names are generally safe but verify no HTML is injected
- **Report loading** — a malicious `?report=<base64>` URL param or `localStorage` entry could contain crafted data. Does the loader validate the report shape before rendering?

### 3. AI / API Key Handling

Review `AISummary.tsx`, `ChatDrawer.tsx`:

- Is `ANTHROPIC_API_KEY` ever logged, serialized into the report, or sent anywhere other than the Anthropic API?
- Does the dashboard handle missing API key gracefully — hiding AI features rather than showing an error or blank?
- Are AI responses that fail (network error, rate limit) surfaced clearly to the user?
- **Prompt injection** — the AI receives the full `SickbayReport` as context. A crafted project (e.g., a file with a name designed to manipulate the prompt) could attempt injection. Is the system prompt robust enough to resist this?

### 4. Report Loading Edge Cases

Review `src/lib/load-report.ts`:

- What happens when `/sickbay-report.json` returns a 404? (Normal when opening the dashboard standalone)
- What happens when the JSON is malformed?
- What happens when the report is structurally valid JSON but missing required fields (e.g., no `checks` array)?
- Does `?report=<base64>` handle invalid base64 gracefully?
- Is there a size limit on `localStorage`? A very large report could fail to persist

### 5. Monorepo Report Rendering

`MonorepoOverview.tsx` handles the multi-package report case.

- Does it handle a monorepo report with zero packages gracefully?
- Does it handle packages with identical names (shouldn't happen but worth checking)?
- Are per-package scores computed correctly, or is there a risk of using the wrong package's data?

### 6. Constants Drift

`apps/web/src/lib/constants.ts` duplicates scoring constants from core to avoid Node.js imports.

- Compare these values against `packages/core/src/constants.ts` and `packages/core/src/scoring.ts`
- If they've drifted, the dashboard will display wrong colors or thresholds while the CLI shows correct values

## Key Files

```
apps/web/src/
├── lib/
│   ├── constants.ts        # Duplicated from core — check for drift
│   └── load-report.ts      # Report loading — edge case handling
├── components/
│   ├── AISummary.tsx        # AI integration — key handling, prompt injection
│   ├── ChatDrawer.tsx       # AI chat — XSS in rendered responses
│   ├── DependencyList.tsx   # Renders user-controlled dep names
│   ├── IssuesList.tsx       # Renders user-controlled issue messages
│   └── MonorepoOverview.tsx # Multi-package report
```

## How to Run

Dispatch a `feature-dev:code-reviewer` agent. Start with the import discipline check (grep for `from 'sickbay-core'`), then constants drift, then XSS surface. Skip visual/styling issues entirely.
