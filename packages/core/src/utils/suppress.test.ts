import { describe, it, expect } from 'vitest';

import { applySuppression, recalcScoreAfterSuppression } from './suppress.js';

import type { CheckResult, Issue } from '../types.js';

const issue = (msg: string, file?: string): Issue => ({
  severity: 'warning',
  message: msg,
  file,
  reportedBy: ['test'],
});

const makeResult = (
  score: number,
  issues: Issue[],
  status: CheckResult['status'] = 'warning',
): CheckResult => ({
  id: 'test',
  category: 'code-quality',
  name: 'Test Check',
  score,
  status,
  issues: [...issues],
  toolsUsed: ['test'],
  duration: 0,
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

describe('recalcScoreAfterSuppression', () => {
  it('sets score to 100 and status to pass when all issues suppressed', () => {
    const original: Issue[] = [
      { severity: 'critical', message: 'a', reportedBy: ['t'] },
      { severity: 'warning', message: 'b', reportedBy: ['t'] },
    ];
    const result = makeResult(40, [], 'fail');
    recalcScoreAfterSuppression(result, original);
    expect(result.score).toBe(100);
    expect(result.status).toBe('pass');
  });

  it('does not change score when no issues were suppressed', () => {
    const issues: Issue[] = [
      { severity: 'warning', message: 'a', reportedBy: ['t'] },
      { severity: 'warning', message: 'b', reportedBy: ['t'] },
    ];
    const result = makeResult(70, issues);
    recalcScoreAfterSuppression(result, issues);
    expect(result.score).toBe(70);
  });

  it('proportionally improves score when some issues suppressed', () => {
    const original: Issue[] = [
      { severity: 'warning', message: 'a', reportedBy: ['t'] },
      { severity: 'warning', message: 'b', reportedBy: ['t'] },
    ];
    // Score 70 = penalty of 30. Suppressing half the weight → penalty 15 → score 85
    const result = makeResult(70, [original[0]]);
    recalcScoreAfterSuppression(result, original);
    expect(result.score).toBe(85);
  });

  it('weights critical issues more heavily than warnings', () => {
    const original: Issue[] = [
      { severity: 'critical', message: 'crit', reportedBy: ['t'] },
      { severity: 'warning', message: 'warn', reportedBy: ['t'] },
    ];
    // penalty = 50, original weight = 10+3 = 13
    // Suppress the critical (weight 10): remaining = 3/13 of penalty
    const result = makeResult(50, [original[1]]);
    recalcScoreAfterSuppression(result, original);
    // 100 - 50 * (3/13) = 100 - 11.54 ≈ 88
    expect(result.score).toBe(88);
  });

  it('updates status to warning when critical issues are suppressed', () => {
    const original: Issue[] = [
      { severity: 'critical', message: 'crit', reportedBy: ['t'] },
      { severity: 'warning', message: 'warn', reportedBy: ['t'] },
    ];
    const result = makeResult(40, [original[1]], 'fail');
    recalcScoreAfterSuppression(result, original);
    expect(result.status).toBe('warning');
  });

  it('keeps status as fail when critical issues remain', () => {
    const original: Issue[] = [
      { severity: 'critical', message: 'crit', reportedBy: ['t'] },
      { severity: 'warning', message: 'warn', reportedBy: ['t'] },
    ];
    const result = makeResult(40, [original[0]], 'fail');
    recalcScoreAfterSuppression(result, original);
    expect(result.status).toBe('fail');
  });
});
