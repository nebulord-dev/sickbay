# Installation

## Quick Start (no install)

```bash
npx sickbay --path ~/my-project
```

This downloads and runs Sickbay without installing it globally. The thin `sickbay` wrapper package on npm delegates to `@nebulord/sickbay`.

## Global Install

```bash
# Via the wrapper (recommended — shorter command)
npm install -g sickbay

# Or install the scoped package directly
npm install -g @nebulord/sickbay
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
