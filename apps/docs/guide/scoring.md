# Scoring System

Sickbay produces a single overall health score (0-100) from weighted category scores. Each check within a category produces its own 0-100 score.

## Categories and Weights

| Category         | Weight | Checks                                                                                                       |
| ---------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| **Security**     | 30%    | npm-audit, secrets, license-checker                                                                          |
| **Dependencies** | 25%    | knip, depcheck, outdated, heavy-deps                                                                         |
| **Code Quality** | 25%    | eslint, jscpd, typescript, todo-scanner, complexity, node-security, node-input-validation, node-async-errors |
| **Performance**  | 15%    | source-map-explorer, react-perf, asset-size                                                                  |
| **Git**          | 5%     | coverage                                                                                                     |

## How Scores Work

1. Each check runner scores 0-100 based on its analysis
2. Checks marked `skipped` (not applicable to the project) are excluded
3. Category score = average of active check scores in that category
4. Overall score = weighted average using the weights above

## Score Thresholds

| Score  | Status          | Color  |
| ------ | --------------- | ------ |
| 80-100 | Good            | Green  |
| 60-79  | Fair            | Yellow |
| 0-59   | Needs attention | Red    |

## Issue Severity

Each check can report issues at three severity levels:

- **Critical** — security vulnerabilities, hardcoded secrets, failing tests
- **Warning** — outdated dependencies, code duplication, missing types
- **Info** — unused code, TODO comments, style suggestions

## Example

A React project might score:

- Security: 100 (no vulnerabilities, no secrets, all licenses OK)
- Dependencies: 85 (2 unused packages, 1 outdated)
- Code Quality: 72 (some ESLint warnings, 3 complex files)
- Performance: 90 (bundle under threshold, good React patterns)
- Git: 95 (good coverage)

**Overall**: (100 × 0.30) + (85 × 0.25) + (72 × 0.25) + (90 × 0.15) + (95 × 0.05) = **87.0**
