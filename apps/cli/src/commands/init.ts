import { mkdirSync, writeFileSync, existsSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';

import { runSickbay, detectContext, getAvailableChecks } from '@nebulord/sickbay-core';

import { saveEntry } from '../lib/history.js';

const CATEGORY_ORDER = ['dependencies', 'code-quality', 'performance', 'security', 'git'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  dependencies: 'Dependencies',
  'code-quality': 'Code Quality',
  performance: 'Performance',
  security: 'Security',
  git: 'Git',
};

export async function generateConfigFile(projectPath: string): Promise<void> {
  const configPath = join(projectPath, 'sickbay.config.ts');

  if (existsSync(configPath)) {
    console.log('Config already exists, skipping');
    return;
  }

  const context = await detectContext(projectPath);
  const checks = getAvailableChecks(context);

  // Group checks by category
  const grouped: Record<string, string[]> = {};
  for (const check of checks) {
    if (!grouped[check.category]) {
      grouped[check.category] = [];
    }
    grouped[check.category].push(check.name);
  }

  // Build check lines grouped by category in display order
  const checkLineGroups: string[] = [];
  for (const category of CATEGORY_ORDER) {
    const names = grouped[category];
    if (!names || names.length === 0) continue;
    const label = CATEGORY_LABELS[category] ?? category;
    const lines = names.map((name) => {
      // Quote names with hyphens
      const key = name.includes('-') ? `'${name}'` : name;
      return `    ${key}: true,`;
    });
    checkLineGroups.push(`    // --- ${label} ---\n${lines.join('\n')}`);
  }

  const checkLines = checkLineGroups.join('\n\n');

  const template = `// Threshold overrides, suppressions, and more:
// https://nebulord-dev.github.io/sickbay/guide/configuration
import { defineConfig } from 'sickbay/config'

export default defineConfig({
  checks: {
${checkLines}
  },
})
`;

  writeFileSync(configPath, template);
  console.log(`Created sickbay.config.ts`);
}

export async function initSickbay(projectPath: string): Promise<void> {
  await generateConfigFile(projectPath);

  const sickbayDir = join(projectPath, '.sickbay');

  // Scaffold .sickbay/
  mkdirSync(sickbayDir, { recursive: true });

  // Write .gitignore — history is local, baseline is committed
  writeFileSync(join(sickbayDir, '.gitignore'), 'history.json\ncache/\n');

  // Add .sickbay entries to project's root .gitignore if not already present
  const rootGitignorePath = join(projectPath, '.gitignore');
  const gitignoreEntries = ['.sickbay/history.json', '.sickbay/cache/'];
  const existingGitignore = existsSync(rootGitignorePath)
    ? readFileSync(rootGitignorePath, 'utf-8')
    : '';
  const toAdd = gitignoreEntries.filter((e) => !existingGitignore.includes(e));
  if (toAdd.length > 0) {
    const prefix = existingGitignore.endsWith('\n') || existingGitignore === '' ? '' : '\n';
    appendFileSync(rootGitignorePath, `${prefix}${toAdd.join('\n')}\n`);
  }

  const baselinePath = join(sickbayDir, 'baseline.json');
  if (existsSync(baselinePath)) {
    console.log('⚠  .sickbay/baseline.json already exists. Overwriting with new scan.');
  }

  console.log('Running initial scan to generate baseline...\n');

  const report = await runSickbay({ projectPath });

  writeFileSync(baselinePath, JSON.stringify(report, null, 2));

  // Seed history with this first entry
  try {
    saveEntry(report);
  } catch {
    // Non-critical
  }

  const scoreLabel =
    report.overallScore >= 80 ? 'good' : report.overallScore >= 60 ? 'fair' : 'needs work';

  console.log(`\n✓ Sickbay initialized for ${report.projectInfo.name}`);
  console.log(`  Overall score: ${report.overallScore}/100 (${scoreLabel})`);
  console.log(`\nCreated:`);
  console.log(`  sickbay.config.ts        — project configuration`);
  console.log(`  .sickbay/baseline.json   — committed (team baseline)`);
  console.log(`  .sickbay/.gitignore      — ignores history.json + cache/`);
  if (toAdd.length > 0) {
    console.log(`  .gitignore              — added ${toAdd.join(', ')}`);
  }
  console.log(`\nRun \`sickbay\` to add history entries over time.`);
}
