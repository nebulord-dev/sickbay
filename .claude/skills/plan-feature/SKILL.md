---
description: 'Create a comprehensive implementation plan for a Sickbay feature before writing any code'
---

# Plan a Feature

## Feature: $ARGUMENTS

## Mission

Transform a feature request into a **comprehensive implementation plan** through systematic codebase analysis and strategic thinking.

**Core Principle**: No code is written in this phase. The goal is a context-rich plan that enables one-pass implementation success.

**Key Philosophy**: Context is King. The plan must contain ALL information needed — patterns, mandatory reading, validation commands, monorepo package order — so the execution agent succeeds on the first attempt.

> If starting a new session, run `/prime` first to load project context before planning.

---

## Planning Process

### Phase 1: Orient to Jira and the Roadmap

Before anything else:

- Check the Jira board ([KAN project](https://nebulord.atlassian.net/jira/software/projects/KAN/boards/1), epic KAN-5) using Atlassian Rovo MCP tools — confirm the feature exists or needs a ticket, check which roadmap phase it belongs to, and verify it isn't blocked by upstream work
- If the feature is blocked, stop and report why rather than producing a plan for something that can't be built yet
- Note any related tasks already in progress that could conflict or overlap

### Phase 2: Feature Understanding

**Deep Feature Analysis:**

- Extract the core problem being solved
- Identify user value and impact on the Sickbay workflow
- Determine feature type: New Capability / Enhancement / Refactor / Bug Fix
- Assess complexity: Low / Medium / High
- Identify which packages are affected: `core`, `cli`, `web` (or multiple)

**Create or refine a User Story:**

```
As a <type of user>
I want to <action/goal>
So that <benefit/value>
```

**Clarify ambiguities:**

- If requirements are unclear, ask the user before continuing
- Resolve architectural decisions (e.g. does this touch `types.ts`? does it add a new runner?) before proceeding

### Phase 3: Codebase Intelligence Gathering

**1. Package Impact Analysis**

Sickbay has strict build order: `core` → `cli` → `web`. For each affected package:

- What files need to change?
- Does `packages/core/src/types.ts` need updating? (If yes, all packages are affected)
- Does a new runner need registering in `runner.ts`?
- Does the CLI need new flags in `packages/cli/src/index.ts`?
- Does the web dashboard need new components or updated report loading?

**2. Pattern Recognition**

- Search for similar implementations in the codebase
- Identify conventions: naming (camelCase types, kebab-case files), file placement, error handling
- Check `CLAUDE.md` for project-specific rules
- Find the closest existing runner or component to mirror
- Document anti-patterns to avoid

**3. Dependency Analysis**

- Catalog any new npm packages needed (prefer existing deps — check `package.json` first)
- Confirm web-safe imports: `packages/web` must only use `import type` from `@sickbay/core`
- Note any tools that need to be bundled as dependencies in `core` (not global installs)

**4. Testing Patterns**

- Tests are colocated with source files (e.g. `knip.test.ts` next to `knip.ts`)
- Vitest is used across all packages
- For new runners: follow `packages/core/src/integrations/knip.test.ts`
- For new Ink components: follow `packages/cli/src/components/QuickWins.test.tsx`
- For new web components: follow existing tests in `packages/web/src/components/`

**5. Integration Points**

- Which existing files need updating (e.g. `runner.ts` `ALL_RUNNERS` array, `index.ts` exports)
- Which new files need creating and exactly where
- Does the web report loading logic (`load-report.ts`) need updating?

### Phase 4: Strategic Thinking

**Think through:**

- How does this fit the current roadmap phase? Does it depend on anything not yet built?
- What could go wrong? (Edge cases, type changes that break consumers, Node-only APIs leaking into web)
- How will this be tested? Can the runner be tested without a real project on disk?
- Any performance implications? (Checks run in parallel via `Promise.allSettled` — is this safe?)
- Are there security considerations? (Exec commands, file reads, secrets)
- Does this introduce any hardcoded single-project assumptions that will need rethinking in Phase 3 (monorepo)?

**Design decisions:**

- Choose between alternative approaches with clear rationale
- Flag anything that will need redesigning when monorepo/polyglot work lands

### Phase 5: Plan Document Generation

Write the completed plan to `.claude/plans/{kebab-case-feature-name}.md`.
Create `.claude/plans/` if it doesn't exist.

Use the template below:

---

```markdown
# Feature: <feature-name>

> **Roadmap Phase**: [Phase N — description]
> **Blocked by**: [upstream task, or "nothing"]

Validate patterns and imports against the codebase before implementing. Pay close attention
to existing type names, util locations, and runner registration patterns.

## Feature Description

<Detailed description, purpose, and user value>

## User Story

As a <type of user>
I want to <action/goal>
So that <benefit/value>

## Problem Statement

<The specific problem this solves>

## Solution Statement

<The proposed approach and why it fits the existing architecture>

## Feature Metadata

**Feature Type**: [New Capability / Enhancement / Refactor / Bug Fix]
**Estimated Complexity**: [Low / Medium / High]
**Packages Affected**: [core / cli / web — list all, in build order]
**New npm Dependencies**: [list, or "none"]
**Touches `types.ts`**: [Yes / No — if yes, all packages are affected]

---

## CONTEXT REFERENCES

### Files to Read Before Implementing

<List with relevance — be specific about what to look for>

- `packages/core/src/types.ts` (lines X–Y) — type interfaces to extend or mirror
- `packages/core/src/integrations/knip.ts` — runner pattern to follow
- `packages/core/src/runner.ts` (lines X–Y) — where to register the new runner
- `packages/cli/src/components/QuickWins.tsx` — Ink component pattern
- `packages/web/src/components/Dashboard.tsx` — web component pattern

### New Files to Create

- `packages/core/src/integrations/<name>.ts` — new runner implementation
- `packages/core/src/integrations/<name>.test.ts` — runner tests
- `packages/web/src/components/<Name>.tsx` — new dashboard component (if needed)

### Patterns to Follow

**Runner structure:**
\`\`\`typescript
// Mirror this pattern from knip.ts or npm-audit.ts
export class MyCheckRunner extends BaseRunner {
name = 'my-check';
category = 'code-quality' as const;
async run(projectPath: string): Promise<CheckResult> { ... }
}
\`\`\`

**Ink component structure:**
<extract from existing component>

**Web-safe imports:**
\`\`\`typescript
// In packages/web — always import type, never value imports from core
import type { SickbayReport } from '@sickbay/core';
\`\`\`

**Naming conventions:** <observed from codebase>

**Error handling:** <observed from codebase>

---

## IMPLEMENTATION PLAN

### Phase 1: Types and Foundation

<Changes to `types.ts` or other shared interfaces — do this first so consumers can build>

**Tasks:**

- Update `packages/core/src/types.ts` with new fields/interfaces
- Add any new category or check name constants

### Phase 2: Core Implementation

<The main logic — new runner, scoring changes, etc.>

**Tasks:**

- Implement runner in `packages/core/src/integrations/<name>.ts`
- Register in `packages/core/src/runner.ts` `ALL_RUNNERS` array
- Export from `packages/core/src/index.ts` if needed
- Update scoring weights in `packages/core/src/scoring.ts` if needed

### Phase 3: CLI Integration

<Terminal UI changes — new flags, updated components>

**Tasks:**

- Add flag to `packages/cli/src/index.ts` (if new CLI option)
- Update relevant Ink component(s) in `packages/cli/src/components/`

### Phase 4: Web Integration

<Dashboard changes — new components, updated data display>

**Tasks:**

- Add/update component in `packages/web/src/components/`
- Update `packages/web/src/components/Dashboard.tsx` if layout changes
- Only use `import type` from `@sickbay/core`

### Phase 5: Tests

**Tasks:**

- Write runner unit tests (colocated: `<name>.test.ts`)
- Write component tests if new UI added
- Verify existing tests still pass

---

## STEP-BY-STEP TASKS

Execute in order. Each task is atomic and independently testable.

### Task keywords

- **CREATE**: New file
- **UPDATE**: Modify existing file
- **ADD**: Insert into existing code
- **REMOVE**: Delete code
- **MIRROR**: Copy pattern from a specific file:line

---

### {ACTION} `{file-path}`

- **IMPLEMENT**: {specific detail}
- **PATTERN**: {reference file:line to mirror}
- **IMPORTS**: {required imports}
- **GOTCHA**: {known constraint or trap}
- **VALIDATE**: `{executable command}`

<continue for all tasks in dependency order>

---

## VALIDATION COMMANDS

Run all of these before considering the feature complete.

### Level 1: Type checking and linting

\`\`\`bash
pnpm --filter @sickbay/core build # catches type errors in core
pnpm --filter @sickbay/cli build # catches type errors in cli
pnpm --filter @sickbay/web build # catches type errors in web
pnpm lint # ESLint across all packages
\`\`\`

### Level 2: Unit tests

\`\`\`bash
pnpm --filter @sickbay/core test # core unit tests
pnpm --filter @sickbay/cli test # cli unit tests
pnpm --filter @sickbay/web test # web unit tests
\`\`\`

### Level 3: Full build and manual validation

\`\`\`bash
pnpm build # full turbo build in dependency order
node packages/cli/dist/index.js --path <test-project-path>
node packages/cli/dist/index.js --path <test-project-path> --web
\`\`\`

### Level 4: Manual spot checks

<Feature-specific things to verify visually — terminal output, web dashboard, etc.>

---

## ACCEPTANCE CRITERIA

- [ ] Feature implements all specified functionality
- [ ] All type checks pass (`pnpm build`)
- [ ] All tests pass (`pnpm test` across affected packages)
- [ ] Linting passes (`pnpm lint`)
- [ ] No regressions in existing checks or UI
- [ ] New runner registered in `ALL_RUNNERS` (if applicable)
- [ ] Web package uses only `import type` from core (if applicable)
- [ ] Tests colocated with new source files
- [ ] No hardcoded single-project assumptions that will break monorepo work (note any if unavoidable)

---

## MONOREPO FUTURE-PROOFING NOTES

<Note any assumptions baked into this implementation that will need revisiting in Phase 3.
Examples: hardcoded single `projectPath`, assumptions about one `package.json`, etc.>

---

## NOTES

<Design decisions, trade-offs, anything the implementer should know>
```

---

## Output

**Save to**: `.claude/plans/{kebab-case-feature-name}.md`
**Create the directory** if it doesn't exist.

## Report

After writing the plan file, provide:

- Summary of feature and approach
- Which packages are affected and in what order
- Full path to the created plan file
- Complexity assessment
- Any blocked dependencies or phase constraints
- Confidence score (1–10) for one-pass implementation success
