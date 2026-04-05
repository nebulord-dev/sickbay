import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const SKILL_CONTENT = `---
name: sickbay
description: Understand Sickbay health reports, scores, issues, config, and CLI commands
---

# Sickbay — Project Health Reports

Sickbay is a zero-config health check CLI for JS/TS projects. It produces structured
JSON reports scoring a project across five categories. Use this skill when you encounter
\`.sickbay/\` files, \`sickbay.config.ts\`, or when asked to interpret health results.

## Report Locations

| File | Purpose |
|------|---------|
| \`.sickbay/last-report.json\` | Most recent scan result |
| \`.sickbay/baseline.json\` | Committed team baseline (created by \`sickbay init\`) |
| \`.sickbay/history.json\` | Local trend history (gitignored) |

## Report Schema

\`\`\`ts
interface SickbayReport {
  overallScore: number;        // 0-100 weighted average
  checks: CheckResult[];       // individual check results
  summary: { critical: number; warnings: number; info: number };
  projectInfo: { name, framework, packageManager, totalDependencies, ... };
}

interface CheckResult {
  id: string;                  // e.g. "knip", "npm-audit", "complexity"
  category: "dependencies" | "security" | "code-quality" | "performance" | "git";
  score: number;               // 0-100
  status: "pass" | "warning" | "fail" | "skipped";
  issues: Issue[];
}

interface Issue {
  severity: "critical" | "warning" | "info";
  message: string;
  file?: string;               // affected file path
  fix?: {
    command?: string;           // shell command to run
    description: string;        // human-readable fix
    codeChange?: { before: string; after: string };
  };
}
\`\`\`

## Score Interpretation

| Range | Rating | Color |
|-------|--------|-------|
| 80-100 | Good | Green |
| 60-79 | Fair | Yellow |
| 0-59 | Needs work | Red |

Category weights: security 30%, dependencies 25%, code-quality 25%, performance 15%, git 5%.

## Acting on Issues

1. **Read the report**: parse \`.sickbay/last-report.json\`
2. **Prioritize**: fix \`critical\` severity issues first
3. **Use fix suggestions**: if \`issue.fix.command\` exists, run it; if \`issue.fix.codeChange\` exists, apply the diff
4. **Verify**: re-run \`sickbay\` to confirm the score improved

## Configuration (\`sickbay.config.ts\`)

\`\`\`ts
export default {
  checks: {
    knip: true,                          // enable (default)
    'source-map-explorer': false,        // disable entirely
    'npm-audit': {
      suppress: [                        // hide accepted findings (improves score)
        { match: 'lodash', reason: 'pinned, CVE does not affect us' },
      ],
    },
    complexity: {
      thresholds: { general: 15 },       // override default thresholds
    },
  },
  exclude: ['dist/**', 'coverage/**'],   // global file exclusions
  weights: { security: 0.4 },            // override category weights
}
\`\`\`

## CLI Commands

| Command | Purpose |
|---------|---------|
| \`sickbay\` | Run a full scan (terminal UI) |
| \`sickbay --json\` | Output raw JSON report |
| \`sickbay --web\` | Open web dashboard after scan |
| \`sickbay fix\` | Interactively apply fix suggestions |
| \`sickbay diff <branch>\` | Compare score against another branch |
| \`sickbay trend\` | Show score history over time |
| \`sickbay init\` | Scaffold config + baseline |
| \`sickbay doctor\` | Diagnose project setup issues |
| \`sickbay badge\` | Generate a README health badge |
| \`sickbay stats\` | Quick codebase overview |
`;

export function generateClaudeSkill(projectPath: string): void {
  const skillsDir = join(projectPath, '.claude', 'skills');
  mkdirSync(skillsDir, { recursive: true });

  const skillPath = join(skillsDir, 'sickbay.md');
  writeFileSync(skillPath, SKILL_CONTENT);

  console.log(`Created ${skillPath}`);
  console.log('\nClaude Code will now understand your Sickbay reports, config, and CLI commands.');
}
