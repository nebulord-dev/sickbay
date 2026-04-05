# Credits

Sickbay wouldn't exist without the incredible open-source tools it orchestrates. This page recognizes the projects and maintainers whose work makes Sickbay possible.

## Analysis Tools

These are the engines behind Sickbay's health checks. Each one is a standalone project with its own community — Sickbay brings them together into a single scan.

| Tool                                                                | Author / Maintainers           | What Sickbay uses it for                                 |
| ------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------- |
| [knip](https://github.com/webpro-nl/knip)                           | Lars Kappert                   | Detecting unused files, dependencies, exports, and types |
| [depcheck](https://github.com/depcheck/depcheck)                    | Nicola Sanitate, Junle Li      | Finding missing dependencies                             |
| [madge](https://github.com/pahen/madge)                             | Patrik Henningsson             | Analyzing circular dependencies                          |
| [jscpd](https://github.com/kucherenko/jscpd)                        | Andrey Kucherenko              | Detecting code duplication                               |
| [source-map-explorer](https://github.com/danvk/source-map-explorer) | Dan Vanderkam                  | Analyzing JavaScript bundle sizes                        |
| [license-checker](https://github.com/davglass/license-checker)      | Dav Glass                      | Checking dependency license compliance                   |
| [ESLint](https://github.com/eslint/eslint)                          | Nicholas C. Zakas, ESLint team | Linting source code                                      |
| [TypeScript](https://github.com/microsoft/TypeScript)               | Microsoft, TypeScript team     | Type checking via `tsc --noEmit`                         |

## CLI & Terminal

| Tool                                               | Author / Maintainers                   | What Sickbay uses it for                      |
| -------------------------------------------------- | -------------------------------------- | --------------------------------------------- |
| [Ink](https://github.com/vadimdemedes/ink)         | Vadim Demedes                          | React-based terminal UI rendering             |
| [Commander.js](https://github.com/tj/commander.js) | TJ Holowaychuk, Commander contributors | CLI argument parsing and subcommands          |
| [chokidar](https://github.com/paulmillr/chokidar)  | Paul Miller                            | File watching in the TUI dashboard            |
| [execa](https://github.com/sindresorhus/execa)     | Sindre Sorhus                          | Safe process execution for all external tools |
| [open](https://github.com/sindresorhus/open)       | Sindre Sorhus                          | Opening the web dashboard in the browser      |

## Web Dashboard

| Tool                                                                                             | Author / Maintainers           | What Sickbay uses it for                         |
| ------------------------------------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------ |
| [React](https://github.com/facebook/react)                                                       | Meta, React team               | UI framework for both terminal (via Ink) and web |
| [Vite](https://github.com/vitejs/vite)                                                           | Evan You, Vite team            | Build tool and dev server                        |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss)                                      | Adam Wathan, Tailwind Labs     | Utility-first styling                            |
| [xyflow](https://github.com/xyflow/xyflow)                                                       | xyflow team                    | Dependency graph visualization                   |
| [dagre](https://github.com/dagrejs/dagre)                                                        | Chris Pettitt                  | Graph layout algorithm                           |
| [react-markdown](https://github.com/remarkjs/react-markdown)                                     | Titus Wormer, Remark community | Markdown rendering in AI insights                |
| [react-syntax-highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter) | Conor Hastings                 | Code syntax highlighting                         |

## Build & Test

| Tool                                            | Author / Maintainers             | What Sickbay uses it for             |
| ----------------------------------------------- | -------------------------------- | ------------------------------------ |
| [Vitest](https://github.com/vitest-dev/vitest)  | Anthony Fu, Vitest team          | Test runner across all packages      |
| [tsup](https://github.com/egoist/tsup)          | EGOIST                           | TypeScript bundling for core and CLI |
| [VitePress](https://github.com/vuejs/vitepress) | Evan You, Vue team               | This documentation site              |
| [Turbo](https://github.com/vercel/turborepo)    | Vercel, Turborepo team           | Monorepo build orchestration         |
| [pnpm](https://github.com/pnpm/pnpm)            | Zoltan Kochan, pnpm contributors | Package management and workspaces    |

## AI

| Tool                                                                    | Author / Maintainers | What Sickbay uses it for                                 |
| ----------------------------------------------------------------------- | -------------------- | -------------------------------------------------------- |
| [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) | Anthropic            | Claude-powered AI insights and chat in the web dashboard |

---

Thank you to every maintainer, contributor, and community member behind these projects. Open source is better when we build on each other's work — and give credit where it's due.
