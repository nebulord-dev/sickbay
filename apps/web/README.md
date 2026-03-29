# @nebulord/sickbay-web

The web dashboard for Sickbay. Built with Vite + React + TailwindCSS.

## Usage

The web dashboard is typically launched automatically via `sickbay --web`, which:
- Builds the web app (requires `pnpm build` first)
- Starts a local HTTP server serving `dist/`
- Injects the scan report via `/sickbay-report.json`
- Opens the browser automatically

### Manual development

```bash
# Start Vite dev server on port 3030
pnpm dev

# The dashboard will show a welcome screen until a report is loaded.
# To feed it a real report, generate one and place it in public/:
node ../../packages/cli/dist/index.js --path ~/Desktop/sickbay-test-app --json > public/sickbay-report.json
# Then refresh the browser
```

## Report Loading

The dashboard tries to load a report from these sources in order:

1. **`/sickbay-report.json`** — served by the CLI's HTTP server when using `sickbay --web`
2. **`?report=<base64>`** — URL query parameter (for sharing reports)
3. **LocalStorage** — key `sickbay-report` (for persistence across refreshes)

## Architecture

```
src/
├── main.tsx              # Vite entry point
├── App.tsx               # Root component — loads report, renders Dashboard or welcome
├── index.css             # Global styles + Tailwind
├── components/
│   ├── Dashboard.tsx     # Main layout: sidebar + tabbed content
│   ├── ScoreCard.tsx     # Circular score display per category
│   └── IssuesList.tsx    # Filterable/sortable issues table with fix commands
└── lib/
    └── load-report.ts    # Report fetching logic
```

## Build

```bash
pnpm build     # tsc + vite build → dist/
pnpm preview   # Preview the production build locally
pnpm clean     # rm -rf dist/
```

The `dist/` output is what the CLI's HTTP server serves when running `sickbay --web`.

## Notes

- **No runtime imports from `@nebulord/sickbay-core`** — only `import type` to avoid bundling Node.js modules (execa, fs, etc.) into the browser build
- Color/score utilities that are shared are inlined directly to keep the browser bundle clean
