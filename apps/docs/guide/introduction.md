# Introduction

Sickbay is a zero-config health check CLI for JavaScript and TypeScript projects. Run it in any project to get an instant report across five categories:

- **Dependencies** — unused packages, outdated versions, missing deps, heavy dependencies
- **Security** — npm audit vulnerabilities, hardcoded secrets, license compliance
- **Code Quality** — ESLint issues, code duplication, type safety, technical debt, file complexity
- **Performance** — bundle size analysis, React performance patterns, asset sizes
- **Git** — commit hygiene, test coverage

## Philosophy

**Zero config.** All 30 analysis tools are bundled as npm dependencies — no global installs, no configuration files, no setup. Run `npx sickbay` and get results.

**Framework-aware.** Sickbay detects your project's framework (React, Next.js, Express, Fastify, Koa, etc.) and only runs checks relevant to it. A Node API server won't be checked for React performance patterns, and a React app won't be checked for Express security issues.

**Opinionated scoring.** Every check produces a 0-100 score. Category scores are weighted averages, with security weighted highest (30%) and git lowest (5%). The overall score gives you a single number to track over time.

## Framework Support

| Framework      | Status         | Framework-specific checks                                                                                              |
| -------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **React**      | ✅ Supported   | `react-perf`, `asset-size`                                                                                             |
| **Next.js**    | ✅ Supported   | `next-images`, `next-link`, `next-fonts`, `next-missing-boundaries`, `next-security-headers`, `next-client-components` |
| **Angular**    | ✅ Supported   | `angular-change-detection`, `angular-lazy-routes`, `angular-strict`, `angular-subscriptions`                           |
| **Node.js**    | ✅ Supported   | `node-security`, `node-input-validation`, `node-async-errors`                                                          |
| **TypeScript** | ✅ Supported   | `typescript` (type error reporting)                                                                                    |
| **Vue**        | 🔜 Coming Soon | —                                                                                                                      |
| **Remix**      | 🔜 Coming Soon | —                                                                                                                      |

All projects also get the full suite of 15 universal checks regardless of framework: dependencies, security, code quality, git, and complexity.

## What You Get

- **Terminal UI** — animated progress, color-coded results, quick wins
- **TUI Dashboard** — persistent live dashboard with file watching and keyboard navigation
- **Web Dashboard** — rich browser UI with score cards, dependency graphs, and AI insights
- **JSON Output** — structured reports for CI/CD pipelines
- **Fix Command** — interactively apply suggested fixes
- **Trend Tracking** — score history over time with delta analysis
