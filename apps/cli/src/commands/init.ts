import { mkdirSync, writeFileSync, existsSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';

import {
  runSickbay,
  runSickbayMonorepo,
  detectContext,
  detectMonorepo,
  getAvailableChecks,
} from '@nebulord/sickbay-core';

import { saveEntry } from '../lib/history.js';

import type { MonorepoInfo } from '@nebulord/sickbay-core';

const CONFIG_FILES = ['sickbay.config.ts', 'sickbay.config.js', 'sickbay.config.mjs'];

const CATEGORY_ORDER = ['dependencies', 'code-quality', 'performance', 'security', 'git'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  dependencies: 'Dependencies',
  'code-quality': 'Code Quality',
  performance: 'Performance',
  security: 'Security',
  git: 'Git',
};

/**
 * Get all applicable checks for a project path.
 * For monorepos, unions checks across all packages so the root config
 * lists every check that applies to any package.
 */
async function getAllApplicableChecks(
  projectPath: string,
  monorepoInfo?: MonorepoInfo | { isMonorepo: false },
): Promise<{ name: string; category: string }[]> {
  const mono = monorepoInfo ?? (await detectMonorepo(projectPath));

  if (!mono.isMonorepo) {
    const context = await detectContext(projectPath);
    return getAvailableChecks(context);
  }

  // Union checks across all packages — deduplicate by name
  const seen = new Set<string>();
  const allChecks: { name: string; category: string }[] = [];

  for (const pkgPath of mono.packagePaths) {
    const context = await detectContext(pkgPath);
    for (const check of getAvailableChecks(context)) {
      if (!seen.has(check.name)) {
        seen.add(check.name);
        allChecks.push(check);
      }
    }
  }

  return allChecks;
}

export async function generateConfigFile(
  projectPath: string,
  options?: { force?: boolean },
): Promise<void> {
  const configPath = join(projectPath, 'sickbay.config.ts');

  if (!options?.force && existsSync(configPath)) {
    console.log('Config already exists, skipping');
    return;
  }

  const checks = await getAllApplicableChecks(projectPath);

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

/** @type {import('sickbay/config').SickbayConfig} */
export default {
  checks: {
${checkLines}
  },
}
`;

  writeFileSync(configPath, template);
  console.log(options?.force ? `Regenerated sickbay.config.ts` : `Created sickbay.config.ts`);
}

function formatCheckKey(name: string): string {
  return name.includes('-') ? `'${name}'` : name;
}

export async function syncConfigFile(projectPath: string): Promise<void> {
  // Find existing config file
  const configFile = CONFIG_FILES.map((f) => join(projectPath, f)).find((p) => existsSync(p));

  if (!configFile) {
    console.log('No config file found. Run `sickbay init` to create one.');
    return;
  }

  const content = readFileSync(configFile, 'utf-8');

  // Check that the file has a checks block
  if (!content.includes('checks:') && !content.includes('checks :')) {
    console.log(
      'Config file has no `checks` block. Add a `checks: { ... }` section or run `sickbay init --reset-config`.',
    );
    return;
  }

  // Detect applicable checks (unions across packages for monorepos)
  const applicableChecks = await getAllApplicableChecks(projectPath);

  // Scan file content for existing check IDs
  const existingIds = new Set<string>();
  const checkPattern = /^\s*['"]?([\w-]+)['"]?\s*:/gm;
  let match;
  while ((match = checkPattern.exec(content)) !== null) {
    existingIds.add(match[1]);
  }

  // Find missing checks
  const missing = applicableChecks.filter((c) => !existingIds.has(c.name));

  if (missing.length === 0) {
    console.log('Config is up to date — no new checks to add.');
    return;
  }

  // Group missing checks by category
  const grouped: Record<string, string[]> = {};
  for (const check of missing) {
    if (!grouped[check.category]) {
      grouped[check.category] = [];
    }
    grouped[check.category].push(check.name);
  }

  // Build new check lines
  const newLineGroups: string[] = [];
  for (const category of CATEGORY_ORDER) {
    const names = grouped[category];
    if (!names || names.length === 0) continue;
    const label = CATEGORY_LABELS[category] ?? category;
    const lines = names.map((name) => `    ${formatCheckKey(name)}: true,`);
    newLineGroups.push(`\n    // --- New: ${label} ---\n${lines.join('\n')}`);
  }

  const newBlock = newLineGroups.join('');

  // Find insertion point: the closing `}` of the checks object.
  // Strategy: find 'checks:' then find its matching closing brace.
  const lines = content.split('\n');
  let checksStartLine = -1;
  let insertionLine = -1;
  let braceDepth = 0;
  let inChecksBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inChecksBlock && /^\s*checks\s*:/.test(line)) {
      checksStartLine = i;
      // Count opening braces on this line
      braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      inChecksBlock = braceDepth > 0;
      continue;
    }

    if (inChecksBlock) {
      braceDepth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (braceDepth <= 0) {
        insertionLine = i;
        break;
      }
    }
  }

  if (checksStartLine === -1 || insertionLine === -1) {
    console.log(
      'Could not find the checks block boundary. Please add the new checks manually or run `sickbay init --reset-config`.',
    );
    return;
  }

  // Insert new checks before the closing brace of the checks block
  lines.splice(insertionLine, 0, newBlock);
  writeFileSync(configFile, lines.join('\n'));

  const names = missing.map((c) => c.name).join(', ');
  console.log(`Added ${missing.length} new check(s): ${names}`);
}

export async function initSickbay(projectPath: string): Promise<void> {
  const monorepoInfo = await detectMonorepo(projectPath);

  await generateConfigFile(projectPath);

  const sickbayDir = join(projectPath, '.sickbay');

  // Scaffold .sickbay/
  mkdirSync(sickbayDir, { recursive: true });

  // Write .gitignore — history is local, baseline is committed
  writeFileSync(join(sickbayDir, '.gitignore'), 'history.json\ndep-tree.json\ncache/\n');

  // Add .sickbay entries to project's root .gitignore if not already present
  const rootGitignorePath = join(projectPath, '.gitignore');
  const gitignoreEntries = ['.sickbay/history.json', '.sickbay/dep-tree.json', '.sickbay/cache/'];
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

  // Skip config loading during init — the just-generated config only has defaults
  // and `sickbay/config` isn't resolvable from the target project yet
  let overallScore: number;
  let projectName: string;

  if (monorepoInfo.isMonorepo) {
    const report = await runSickbayMonorepo({ projectPath, _config: null });
    writeFileSync(baselinePath, JSON.stringify(report, null, 2));
    overallScore = report.overallScore;
    projectName = `monorepo (${report.packages.length} packages)`;
  } else {
    const report = await runSickbay({ projectPath, _config: null });
    writeFileSync(baselinePath, JSON.stringify(report, null, 2));

    // Seed history with this first entry
    try {
      saveEntry(report);
    } catch {
      // Non-critical
    }

    overallScore = report.overallScore;
    projectName = report.projectInfo.name;
  }

  const scoreLabel = overallScore >= 80 ? 'good' : overallScore >= 60 ? 'fair' : 'needs work';

  console.log(`\n✓ Sickbay initialized for ${projectName}`);
  console.log(`  Overall score: ${overallScore}/100 (${scoreLabel})`);
  console.log(`\nCreated:`);
  console.log(`  sickbay.config.ts        — project configuration`);
  console.log(`  .sickbay/baseline.json   — committed (team baseline)`);
  console.log(`  .sickbay/.gitignore      — ignores history.json, dep-tree.json + cache/`);
  if (toAdd.length > 0) {
    console.log(`  .gitignore              — added ${toAdd.join(', ')}`);
  }
  console.log(`\nRun \`sickbay\` to add history entries over time.`);
}
