#!/usr/bin/env node
// @ts-check
/*
 * check-bundled-deps
 * ==================
 *
 * Why this exists:
 *
 * `apps/cli` bundles `packages/core` inline at build time via tsup's
 * `noExternal: ['sickbay-core']` (see apps/cli/tsup.config.ts).
 * That means cli's published dist contains core's source code with all of its
 * `require('depcheck')` / `require('madge')` / etc. calls preserved verbatim —
 * those are still resolved at *runtime* against cli's own node_modules.
 *
 * Consequence: every runtime dependency of `core` MUST also appear in cli's
 * runtime dependencies. If they drift, the published `sickbay` tarball
 * crashes on first use with a `Cannot find module 'X'` error — and the
 * failure happens at the user's machine, not in our CI or local builds
 * (because pnpm hoisting and our workspace symlinks happily resolve any
 * missing dep from elsewhere in the monorepo).
 *
 * This check enforces the invariant: cli's runtime deps must be a superset
 * of core's runtime deps, and version ranges must match exactly so we don't
 * ship an incompatible pair.
 *
 * The mirror is structural and unavoidable for as long as `core` is private
 * and we ship a single self-contained `sickbay` package. Discussed at length
 * in audit notes — see CLAUDE.md and apps/cli/package.json `_bundleNote`.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

/** @param {string} relPath */
function readJson(relPath) {
  return JSON.parse(readFileSync(join(repoRoot, relPath), 'utf-8'));
}

const corePkg = readJson('packages/core/package.json');
const cliPkg = readJson('apps/cli/package.json');

/** @type {Record<string, string>} */
const coreDeps = corePkg.dependencies ?? {};
/** @type {Record<string, string>} */
const cliDeps = cliPkg.dependencies ?? {};

/** @type {string[]} */
const missing = [];
/** @type {string[]} */
const mismatched = [];

for (const [name, coreRange] of Object.entries(coreDeps)) {
  // Workspace refs aren't real npm deps — they're internal to the monorepo
  // and never end up in published tarballs.
  if (coreRange.startsWith('workspace:')) continue;

  const cliRange = cliDeps[name];
  if (cliRange === undefined) {
    missing.push(`  - ${name} (core requires ${coreRange})`);
    continue;
  }
  if (cliRange !== coreRange) {
    mismatched.push(`  - ${name}: core=${coreRange} vs cli=${cliRange}`);
  }
}

if (missing.length === 0 && mismatched.length === 0) {
  const total = Object.keys(coreDeps).filter((k) => !coreDeps[k].startsWith('workspace:')).length;
  console.log(`✓ apps/cli mirrors all ${total} runtime deps from packages/core`);
  process.exit(0);
}

console.error('✗ apps/cli runtime deps have drifted from packages/core');
console.error('');
console.error("  Why this matters: tsup bundles core inline into cli, so core's");
console.error("  runtime require() calls are resolved against cli's node_modules.");
console.error('  Any dep listed here MUST exist in apps/cli/package.json or the');
console.error('  published sickbay tarball will crash at user runtime.');
console.error('');

if (missing.length > 0) {
  console.error('Missing from apps/cli/package.json:');
  for (const line of missing) console.error(line);
  console.error('');
}

if (mismatched.length > 0) {
  console.error('Version range mismatches (cli must match core exactly):');
  for (const line of mismatched) console.error(line);
  console.error('');
}

console.error('Fix: copy the entries from packages/core/package.json into');
console.error('apps/cli/package.json `dependencies` (matching version ranges),');
console.error('then run `pnpm install`.');

process.exit(1);
