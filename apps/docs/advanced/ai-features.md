# AI Features

Sickbay integrates with the Anthropic API to provide AI-powered analysis in the web dashboard. All AI features are optional and the tool works fully without them.

## Setup

AI features require an `ANTHROPIC_API_KEY` environment variable. Sickbay loads it from `.env` files in three locations, checked in order of priority:

1. **Project directory** — `.env` in the path being scanned (highest priority)
2. **Current working directory** — `.env` where you ran the command
3. **Global config** — `~/.sickbay/.env` (lowest priority)

Set up the global config so the key is available for every project:

```bash
# Create the global config directory
mkdir -p ~/.sickbay

# Add your API key
echo "ANTHROPIC_API_KEY=sk-ant-..." >> ~/.sickbay/.env
```

Or export it directly in your shell:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Then launch the web dashboard:

```bash
sickbay --path ~/my-project --web
```

## Auto-Analysis

When the web dashboard loads and an API key is available, Sickbay automatically sends the scan report to Claude for analysis. The AI reviews the findings and produces:

- A **prioritized summary** of the most important issues
- **Root cause analysis** connecting related problems across checks
- **Actionable recommendations** tailored to your specific project setup

The auto-analysis appears in a collapsible panel at the top of the dashboard. It runs once on load and the results are cached for the session.

## Interactive Chat

The dashboard includes a chat drawer where you can ask follow-up questions about your report. Examples of useful prompts:

- "Which of these issues should I fix first?"
- "Explain the circular dependency between `utils/` and `services/`"
- "What's the risk of ignoring the npm audit warnings?"
- "How do I configure knip to allow this unused export?"
- "Write a PR description summarizing what needs to change"

The chat has full context of your scan report, so you can reference specific checks, scores, or issues without pasting them in.

## Disabling AI

To run the web dashboard without any AI features:

```bash
sickbay --path ~/my-project --web --no-ai
```

This hides the auto-analysis panel and chat drawer entirely. The rest of the dashboard works the same.

Without an API key set, AI features are silently hidden — no errors or warnings are shown.

## Privacy

When AI features are enabled, the following data is sent to the Anthropic API:

- The full scan report (scores, issues, file paths, dependency lists)
- Your chat messages in the interactive drawer

**Not sent:**
- Source code file contents
- Environment variables (other than what appears in the report)
- Git credentials or commit history

All API calls go directly from your browser to Anthropic's servers. Sickbay does not proxy, store, or log your API requests.

If your organization has data handling requirements that prevent sending project metadata to third-party APIs, use the `--no-ai` flag or omit the `ANTHROPIC_API_KEY` variable.
