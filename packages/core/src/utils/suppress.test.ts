import { describe, it, expect } from 'vitest';

import { applySuppression } from './suppress.js';

import type { Issue } from '../types.js';

const issue = (msg: string, file?: string): Issue => ({
  severity: 'warning',
  message: msg,
  file,
  reportedBy: ['test'],
});

describe('applySuppression', () => {
  it('returns all issues unchanged when rules is empty', () => {
    const issues = [issue('foo'), issue('bar')];
    const result = applySuppression(issues, []);
    expect(result.issues).toHaveLength(2);
    expect(result.suppressedCount).toBe(0);
  });

  it('suppresses issues matching a path glob', () => {
    const issues = [
      issue('error in generated', 'src/generated/types.ts'),
      issue('error in app', 'src/app/main.ts'),
    ];
    const result = applySuppression(issues, [
      { path: 'src/generated/**', reason: 'auto-generated' },
    ]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].file).toBe('src/app/main.ts');
    expect(result.suppressedCount).toBe(1);
  });

  it('suppresses issues matching a message substring (case-insensitive)', () => {
    const issues = [
      issue('NEXT_PUBLIC_API_KEY found in config'),
      issue('AWS_SECRET_KEY found in .env'),
    ];
    const result = applySuppression(issues, [
      { match: 'next_public_', reason: 'public keys, not secrets' },
    ]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('AWS_SECRET_KEY');
    expect(result.suppressedCount).toBe(1);
  });

  it('requires both path AND match when both provided', () => {
    const issues = [
      issue('NEXT_PUBLIC_API_KEY', 'src/config.ts'),
      issue('NEXT_PUBLIC_API_KEY', 'src/other.ts'),
      issue('AWS_KEY', 'src/config.ts'),
    ];
    const result = applySuppression(issues, [
      { path: 'src/config.ts', match: 'NEXT_PUBLIC_', reason: 'known safe' },
    ]);
    // Only the first issue matches both path and match
    expect(result.issues).toHaveLength(2);
    expect(result.suppressedCount).toBe(1);
  });

  it('does not match path rule against issue without file field', () => {
    const issues = [issue('some error')]; // no file
    const result = applySuppression(issues, [{ path: 'src/**', reason: 'test' }]);
    expect(result.issues).toHaveLength(1);
    expect(result.suppressedCount).toBe(0);
  });

  it('suppresses with multiple rules (union)', () => {
    const issues = [
      issue('error A', 'src/a.ts'),
      issue('error B', 'src/b.ts'),
      issue('error C', 'src/c.ts'),
    ];
    const result = applySuppression(issues, [
      { path: 'src/a.ts', reason: 'skip a' },
      { match: 'error B', reason: 'skip b' },
    ]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toBe('error C');
    expect(result.suppressedCount).toBe(2);
  });

  it('match-only rule suppresses regardless of file', () => {
    const issues = [
      issue('GHSA-xxxx vulnerability', 'package.json'),
      issue('GHSA-yyyy vulnerability', 'package.json'),
    ];
    const result = applySuppression(issues, [{ match: 'GHSA-xxxx', reason: 'not exploitable' }]);
    expect(result.issues).toHaveLength(1);
    expect(result.suppressedCount).toBe(1);
  });
});
