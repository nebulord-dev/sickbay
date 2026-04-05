# Suppress Rules

Suppress rules hide accepted or intentional findings from reports without disabling the check entirely. The check still runs and scores normally — suppressed issues are filtered out of the output.

Use them when a finding is a known false positive, an accepted risk, or irrelevant to your context.

## Schema

Each rule is an object with up to three fields:

```ts
{
  path?: string    // glob pattern matched against file path (picomatch syntax)
  match?: string   // substring matched against issue message (case-insensitive)
  reason: string   // required — why this finding is suppressed
}
```

`reason` is required. Rules without a reason are rejected at config load time.

## How Matching Works

- **`path`** — matched against the file path in the issue using [picomatch](https://github.com/micromatch/picomatch) glob syntax (e.g. `src/generated/**`, `**/*.test.ts`)
- **`match`** — case-insensitive substring match against the full issue message text
- **Both fields** — both must match (AND logic). If only one field is provided, only that field is checked.

A suppressed issue is removed from all output: terminal UI, web dashboard, and JSON reports. It does not affect the check's score.

## Using the Dashboard

The web dashboard has a built-in helper for adding suppress rules. On any issue in the Issues tab, click the **⊘ suppress** button to copy a ready-to-paste rule to your clipboard. Paste it into the relevant check's `suppress` array in `sickbay.config.ts`.

## Examples

**Suppress a specific vulnerability by identifier:**

```ts
'npm-audit': {
  suppress: [
    { match: 'GHSA-c2qf-rxjj', reason: 'dev-only dependency, not in production bundle' },
  ],
},
```

**Suppress findings in auto-generated files:**

```ts
complexity: {
  suppress: [
    { path: 'src/generated/**', reason: 'auto-generated code, not hand-maintained' },
  ],
},
```

**Suppress a specific secret pattern in a known-safe file:**

```ts
secrets: {
  suppress: [
    { path: 'src/config.ts', match: 'NEXT_PUBLIC_', reason: 'public keys, not secrets' },
  ],
},
```

**Suppress a pinned-but-vulnerable dependency:**

```ts
'npm-audit': {
  suppress: [
    { match: 'lodash', reason: 'pinned to 4.17.21, CVE does not affect our usage' },
  ],
},
```

**Suppress a specific TODO in a legacy file:**

```ts
'todo-scanner': {
  suppress: [
    { path: 'src/legacy/parser.ts', match: 'TODO: rewrite', reason: 'tracked in KAN-88, not this sprint' },
  ],
},
```

## Best Practices

- **Always fill in `reason`.** It is enforced — rules without it are rejected. A good reason explains *why* the finding is safe or irrelevant, not just that it is.
- **Prefer specific matches over broad ones.** `{ match: 'GHSA-c2qf-rxjj' }` is safer than `{ match: 'lodash' }` if you only mean one CVE.
- **Review suppress rules periodically.** Dependencies get patched, code gets refactored. A rule that was valid six months ago may no longer apply.
- **Avoid suppressing entire categories.** Disabling a check with `false` is more explicit than a blanket `match` that catches everything.

> [!NOTE]
> Suppress rules are per-check. A rule under `secrets` only filters issues from the `secrets` runner — it has no effect on findings from other checks.
