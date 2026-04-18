import type { KnipConfig } from 'knip';

// These deps are declared in package.json because tsdown bundles sickbay-core
// inline (deps.alwaysBundle), so core's require() calls resolve against cli's
// node_modules at runtime. Knip can't see this from src/ imports alone.
// Source of truth: scripts/check-bundled-deps.mjs (runs in CI).
// Keep this list in sync with packages/core/package.json dependencies.
const config: KnipConfig = {
  ignoreDependencies: [
    'depcheck',
    'execa',
    'globby',
    'jiti',
    'jscpd',
    'knip',
    'license-checker',
    'madge',
    'picomatch',
    'source-map-explorer',
  ],
};

export default config;
