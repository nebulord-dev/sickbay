# Claude Code Integration

Sickbay can generate a [Claude Code skill](https://docs.anthropic.com/en/docs/claude-code/skills) that teaches Claude how to read your health reports, interpret scores, act on fix suggestions, and modify your `sickbay.config.ts`.

## Setup

Run from your project root:

```bash
sickbay claude
```

This creates `.claude/skills/sickbay.md` in your project. Claude Code automatically loads skills from this directory, so no further configuration is needed.

Re-run the command at any time to update the skill to the latest version.

## What It Enables

With the skill installed, Claude Code understands:

- **Report files** — where `.sickbay/last-report.json` and `.sickbay/baseline.json` live and what they contain
- **Score interpretation** — what 0-100 scores mean, category weights, severity levels
- **Fix suggestions** — how to read `issue.fix.command` and `issue.fix.codeChange` to apply fixes
- **Configuration** — how `sickbay.config.ts` works: disabling checks, suppress rules, thresholds, category weights
- **CLI commands** — available subcommands like `sickbay fix`, `sickbay diff`, `sickbay trend`

## Example Prompts

Once the skill is installed, you can ask Claude things like:

- "Look at my sickbay report and fix the critical issues"
- "What's dragging my health score down?"
- "Suppress the lodash vulnerability — it's pinned and doesn't affect us"
- "Compare my health score against the main branch"
- "Add a complexity threshold override for test files"

## Monorepo Note

In a monorepo, run `sickbay claude` from the workspace root. The skill content is project-agnostic — it covers the report schema and CLI commands universally, so a single skill file works for all packages.
