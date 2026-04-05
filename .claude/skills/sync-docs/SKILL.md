---
description: Review recent changes and propose documentation updates across CONTRIBUTING.md, READMEs, and CLAUDE.md
---

# Sync Docs

## Objective

Review what changed in this session and determine which documentation files need updating. Propose specific changes before writing anything — don't auto-apply.

---

## Process

### Step 1: Gather What Changed

Run these to understand the session's work:

```bash
git log --oneline -20
git diff HEAD~${0:-5}..HEAD --stat
git diff HEAD~${0:-5}..HEAD
```

If $ARGUMENTS specifies a commit range or number of commits, use that. Otherwise default to the last 5 commits.

### Step 2: Categorise the Changes

For each changed file or area, determine what kind of change it is:

| Change type                | Triggers doc update in...                                                        |
| -------------------------- | -------------------------------------------------------------------------------- |
| New check runner added     | `CONTRIBUTING.md` (pattern), `README.md` (check table), package `core/README.md` |
| New CLI command or flag    | `CONTRIBUTING.md`, `README.md` (CLI usage), `packages/cli/README.md`             |
| New fixture added          | `fixtures/README.md`, `CONTRIBUTING.md` (if convention changed)                  |
| Fixture restructured       | `fixtures/README.md`, `CONTRIBUTING.md`                                          |
| New architectural pattern  | `CLAUDE.md`, `CONTRIBUTING.md`                                                   |
| Types changed (`types.ts`) | `packages/core/README.md` (API section)                                          |
| Scoring weights changed    | `README.md` (scoring table), `packages/core/README.md`                           |
| New web component or tab   | `packages/web/README.md`                                                         |
| New TUI panel or hotkey    | `packages/cli/README.md` (TUI section)                                           |
| Build/tooling change       | `CONTRIBUTING.md` (dev workflow), `README.md`                                    |
| New Jira tasks added       | No doc update needed — tracked in Jira                                           |

### Step 3: Read the Potentially Affected Docs

Read each doc that might need updating. Don't propose changes based on assumptions — read the current content first.

Docs to check (read only the ones relevant to what changed):

- `CONTRIBUTING.md` — contributor guide: setup, adding checks, fixtures, languages, dev workflow
- `README.md` — root README: features list, monorepo structure, CLI usage, check table, scoring
- `CLAUDE.md` — AI navigation guide: architecture overview, file navigation, patterns
- `fixtures/README.md` — fixture structure and intentional issues
- `packages/core/README.md` — core API, checks table, runner pattern
- `packages/cli/README.md` — CLI flags, commands, TUI panels and hotkeys
- `packages/web/README.md` — dashboard components, report loading

### Step 4: Evaluate Each Doc

For each potentially affected doc, answer:

1. **Is it out of date?** Does the current content accurately reflect what was just built?
2. **Is the gap meaningful?** Would a contributor or future developer be misled or blocked by the outdated content?
3. **What specifically needs changing?** Line-level — not "update the README" but "the check table is missing the new X runner" or "the TUI hotkeys section doesn't mention the new Y key"

Skip docs where the changes are cosmetic, already covered, or where the gap is so minor it would add noise rather than value.

### Step 5: Present Findings

Present a clear summary before touching anything:

```
## Doc Sync Report

### Changes This Session
- Brief bullet list of what was built/changed

### Docs That Need Updating

#### CONTRIBUTING.md
- **Why**: [specific reason]
- **What**: [exactly what to add/change/remove]

#### README.md
- **Why**: ...
- **What**: ...

### Docs That Look Fine
- `packages/web/README.md` — no web changes this session
- `fixtures/README.md` — already updated during session
- (etc.)

### Proposed Actions
1. Update CONTRIBUTING.md — [one-line description]
2. Update README.md — [one-line description]
```

Ask: **"Should I go ahead and make these updates?"**

### Step 6: Apply Approved Updates

Only after confirmation — make the specific changes identified. Don't refactor, expand, or improve sections beyond what's needed. Edit surgically.

After updating, commit:

```bash
git add <changed doc files>
git commit -m "docs: sync documentation with recent session changes"
```

---

## What This Skill Is NOT

- Not a full doc rewrite — surgical updates only
- Not a style pass — don't reformat things that don't need changing
- Not proactive content generation — only document things that were actually built
- Not a substitute for updating docs during a session when the change is obvious — use this for catching things that slipped through
