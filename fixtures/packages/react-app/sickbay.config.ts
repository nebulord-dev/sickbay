// Threshold overrides, suppressions, and more:
// https://nebulord-dev.github.io/sickbay/guide/configuration

/** @type {import('sickbay/config').SickbayConfig} */
export default {
  checks: {
    // --- Dependencies ---
    knip: true,
    depcheck: true,
    outdated: true,

    // --- Code Quality ---
    madge: false,
    coverage: true,
    jscpd: true,
    eslint: true,
    typescript: true,
    'todo-scanner': true,
    complexity: true,

    // --- Performance ---
    'source-map-explorer': true,
    'heavy-deps': true,
    'react-perf': true,
    'asset-size': true,

    // --- Security ---
    'npm-audit': true,
    'license-checker': true,
    secrets: true,

    // --- Git ---
    git: true,
  },
}
