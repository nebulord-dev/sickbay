import { describe, it, expect } from 'vitest';
import { calculateOverallScore, buildSummary, getScoreColor, getScoreEmoji } from './scoring.js';
import type { CheckResult, Issue } from './types.js';

describe('calculateOverallScore', () => {
  it('returns 0 when no checks are provided', () => {
    expect(calculateOverallScore([])).toBe(0);
  });

  it('returns 0 when all checks are skipped', () => {
    const checks: CheckResult[] = [
      {
        id: 'test',
        name: 'Test',
        category: 'dependencies',
        score: 100,
        status: 'skipped',
        issues: [],
        toolsUsed: [],
        duration: 0,
      },
    ];
    expect(calculateOverallScore(checks)).toBe(0);
  });

  it('calculates weighted score correctly for single check', () => {
    const checks: CheckResult[] = [
      {
        id: 'security-check',
        name: 'Security',
        category: 'security',
        score: 80,
        status: 'pass',
        issues: [],
        toolsUsed: [],
        duration: 0,
      },
    ];
    // Security has 30% weight, so: (80 * 0.3) / 0.3 = 80
    expect(calculateOverallScore(checks)).toBe(80);
  });

  it('calculates weighted score correctly for multiple categories', () => {
    const checks: CheckResult[] = [
      {
        id: 'security',
        name: 'Security',
        category: 'security',
        score: 100,
        status: 'pass',
        issues: [],
        toolsUsed: [],
        duration: 0,
      },
      {
        id: 'deps',
        name: 'Dependencies',
        category: 'dependencies',
        score: 80,
        status: 'pass',
        issues: [],
        toolsUsed: [],
        duration: 0,
      },
    ];
    // security: 100 * 0.30 = 30
    // dependencies: 80 * 0.25 = 20
    // total: 50 / 0.55 ≈ 91
    expect(calculateOverallScore(checks)).toBe(91);
  });

  it('ignores skipped checks in calculation', () => {
    const checks: CheckResult[] = [
      {
        id: 'active',
        name: 'Active',
        category: 'security',
        score: 100,
        status: 'pass',
        issues: [],
        toolsUsed: [],
        duration: 0,
      },
      {
        id: 'skipped',
        name: 'Skipped',
        category: 'dependencies',
        score: 0,
        status: 'skipped',
        issues: [],
        toolsUsed: [],
        duration: 0,
      },
    ];
    // Should only count the active check
    expect(calculateOverallScore(checks)).toBe(100);
  });

  it('uses default weight for unknown categories', () => {
    const checks: CheckResult[] = [
      {
        id: 'unknown',
        name: 'Unknown Category',
        category: 'unknown-category',
        score: 50,
        status: 'pass',
        issues: [],
        toolsUsed: [],
        duration: 0,
      },
    ];
    // Should use 0.1 default weight
    expect(calculateOverallScore(checks)).toBe(50);
  });

  it('rounds to nearest integer', () => {
    const checks: CheckResult[] = [
      {
        id: 'test1',
        name: 'Test 1',
        category: 'security',
        score: 85,
        status: 'pass',
        issues: [],
        toolsUsed: [],
        duration: 0,
      },
      {
        id: 'test2',
        name: 'Test 2',
        category: 'dependencies',
        score: 90,
        status: 'pass',
        issues: [],
        toolsUsed: [],
        duration: 0,
      },
    ];
    const result = calculateOverallScore(checks);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('buildSummary', () => {
  it('returns zero counts for empty checks', () => {
    expect(buildSummary([])).toEqual({
      critical: 0,
      warnings: 0,
      info: 0,
    });
  });

  it('counts issues by severity correctly', () => {
    const issues: Issue[] = [
      { severity: 'critical', message: 'Critical 1', reportedBy: ['test'] },
      { severity: 'critical', message: 'Critical 2', reportedBy: ['test'] },
      { severity: 'warning', message: 'Warning 1', reportedBy: ['test'] },
      { severity: 'info', message: 'Info 1', reportedBy: ['test'] },
      { severity: 'info', message: 'Info 2', reportedBy: ['test'] },
      { severity: 'info', message: 'Info 3', reportedBy: ['test'] },
    ];

    const checks: CheckResult[] = [
      {
        id: 'test',
        name: 'Test',
        category: 'security',
        score: 50,
        status: 'fail',
        issues,
        toolsUsed: [],
        duration: 0,
      },
    ];

    expect(buildSummary(checks)).toEqual({
      critical: 2,
      warnings: 1,
      info: 3,
    });
  });

  it('aggregates issues across multiple checks', () => {
    const checks: CheckResult[] = [
      {
        id: 'check1',
        name: 'Check 1',
        category: 'security',
        score: 80,
        status: 'pass',
        issues: [
          { severity: 'critical', message: 'Issue 1', reportedBy: ['test'] },
          { severity: 'warning', message: 'Issue 2', reportedBy: ['test'] },
        ],
        toolsUsed: [],
        duration: 0,
      },
      {
        id: 'check2',
        name: 'Check 2',
        category: 'dependencies',
        score: 70,
        status: 'warning',
        issues: [
          { severity: 'warning', message: 'Issue 3', reportedBy: ['test'] },
          { severity: 'info', message: 'Issue 4', reportedBy: ['test'] },
        ],
        toolsUsed: [],
        duration: 0,
      },
    ];

    expect(buildSummary(checks)).toEqual({
      critical: 1,
      warnings: 2,
      info: 1,
    });
  });
});

describe('getScoreColor', () => {
  it('returns green for scores >= 80', () => {
    expect(getScoreColor(100)).toBe('green');
    expect(getScoreColor(90)).toBe('green');
    expect(getScoreColor(80)).toBe('green');
  });

  it('returns yellow for scores 60-79', () => {
    expect(getScoreColor(79)).toBe('yellow');
    expect(getScoreColor(70)).toBe('yellow');
    expect(getScoreColor(60)).toBe('yellow');
  });

  it('returns red for scores < 60', () => {
    expect(getScoreColor(59)).toBe('red');
    expect(getScoreColor(30)).toBe('red');
    expect(getScoreColor(0)).toBe('red');
  });
});

describe('getScoreEmoji', () => {
  it('returns "Good" for scores >= 90', () => {
    expect(getScoreEmoji(100)).toBe('Good');
    expect(getScoreEmoji(90)).toBe('Good');
  });

  it('returns "Fair" for scores 80-89', () => {
    expect(getScoreEmoji(89)).toBe('Fair');
    expect(getScoreEmoji(80)).toBe('Fair');
  });

  it('returns "Poor" for scores 60-79', () => {
    expect(getScoreEmoji(79)).toBe('Poor');
    expect(getScoreEmoji(60)).toBe('Poor');
  });

  it('returns "Bad" for scores < 60', () => {
    expect(getScoreEmoji(59)).toBe('Bad');
    expect(getScoreEmoji(0)).toBe('Bad');
  });
});
