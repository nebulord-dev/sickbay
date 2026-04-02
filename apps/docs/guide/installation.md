# Installation

## Quick Start (no install)

```bash
npx sickbay --path ~/my-project
```

This downloads and runs Sickbay without installing it globally.

## Global Install

```bash
npm install -g sickbay
```

Once installed globally, run from any directory:

```bash
sickbay                     # scan current directory
sickbay --path ~/my-app     # scan a specific project
sickbay --web               # open web dashboard after scan
```

## Requirements

- **Node.js** 18.0.0 or later
- **npm**, **pnpm**, **yarn**, or **bun** as your package manager

Sickbay bundles all analysis tools internally — you don't need to install ESLint, knip, madge, or any other tool globally.

## Monorepo Usage

Sickbay auto-detects monorepos. Run from the workspace root to scan all packages:

```bash
cd ~/my-monorepo
sickbay                         # scans all packages
sickbay --package @org/my-app   # scope to one package
```

See [Monorepo Support](/guide/monorepo) for details.
