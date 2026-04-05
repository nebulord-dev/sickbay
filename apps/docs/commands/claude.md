# sickbay claude

Generate a [Claude Code skill](https://docs.anthropic.com/en/docs/claude-code/skills) file that teaches Claude how to interpret Sickbay reports, scores, and configuration.

## Usage

```bash
sickbay claude [options]
```

## Options

| Flag                | Description                                    | Default                   |
| ------------------- | ---------------------------------------------- | ------------------------- |
| `-p, --path <path>` | Project path                                   | Current working directory |

## What It Does

Creates `.claude/skills/sickbay.md` in your project. Claude Code automatically discovers skills in this directory, so no further setup is needed.

The skill file covers:

- Report file locations (`.sickbay/last-report.json`, `.sickbay/baseline.json`)
- JSON report schema (`SickbayReport`, `CheckResult`, `Issue`, `FixSuggestion`)
- Score interpretation (thresholds, category weights, severity levels)
- How to act on fix suggestions (`issue.fix.command`, `issue.fix.codeChange`)
- Configuration options (`sickbay.config.ts`)
- All available CLI commands

## Example

```bash
sickbay claude --path ~/my-project
```

Output:

```
Created /Users/you/my-project/.claude/skills/sickbay.md

Claude Code will now understand your Sickbay reports, config, and CLI commands.
```

Re-run the command at any time to update the skill to the latest version.

## See Also

- [Claude Code Integration guide](/guide/claude-code) for usage examples and tips
