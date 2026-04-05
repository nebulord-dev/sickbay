import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Sickbay',
  description: 'Zero-config health checks for TypeScript, React, and Node projects',
  base: '/sickbay/',
  appearance: 'dark',
  lastUpdated: true,

  head: [
    [
      'script',
      {
        defer: '',
        src: 'https://static.cloudflareinsights.com/beacon.min.js',
        'data-cf-beacon': '{"token": "8585c204658b4cc5ae21970ebed2e7f6"}',
      },
    ],
  ],

  themeConfig: {
    nav: [
      {
        text: 'Changelog',
        link: 'https://github.com/nebulord-dev/sickbay/blob/main/apps/cli/CHANGELOG.md',
      },
      {
        text: 'Contributing',
        link: 'https://github.com/nebulord-dev/sickbay/blob/main/CONTRIBUTING.md',
      },
    ],

    sidebar: [
      {
        text: 'Guide',
        collapsed: false,
        items: [
          { text: 'Introduction', link: '/guide/introduction' },
          { text: 'Installation', link: '/guide/installation' },
          { text: 'Quick Start', link: '/guide/quick-start' },
          { text: 'Scoring System', link: '/guide/scoring' },
          { text: 'Configuration', link: '/guide/configuration' },
          { text: 'Health Checks', link: '/guide/health-checks' },
          { text: 'Monorepo Support', link: '/guide/monorepo' },
          { text: 'Data Directory', link: '/guide/data-directory' },
          { text: 'Credits', link: '/guide/credits' },
        ],
      },
      {
        text: 'Commands',
        collapsed: false,
        items: [
          { text: 'sickbay (scan)', link: '/commands/scan' },
          { text: 'sickbay init', link: '/commands/init' },
          { text: 'sickbay fix', link: '/commands/fix' },
          { text: 'sickbay tui', link: '/commands/tui' },
          { text: 'sickbay doctor', link: '/commands/doctor' },
          { text: 'sickbay trend', link: '/commands/trend' },
          { text: 'sickbay stats', link: '/commands/stats' },
          { text: 'sickbay badge', link: '/commands/badge' },
          { text: 'sickbay diff', link: '/commands/diff' },
        ],
      },
      {
        text: 'Advanced',
        collapsed: false,
        items: [
          { text: 'CI/CD Integration', link: '/advanced/ci-cd' },
          { text: 'JSON Output', link: '/advanced/json-output' },
          { text: 'AI Features', link: '/advanced/ai-features' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/nebulord-dev/sickbay' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/sickbay' },
    ],

    search: {
      provider: 'local',
    },

    // editLink: {
    //   pattern: 'https://github.com/nebulord/sickbay/edit/main/apps/docs/:path',
    //   text: 'Edit this page on GitHub',
    // },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2025-present Nebulord',
    },
  },
});
