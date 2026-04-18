import { describe, it, expect } from 'vitest';

import { extractPatternStem, countUniqueIssues, groupIssues } from './issue-grouping.js';

import type { CheckResult } from 'sickbay-core';

describe('extractPatternStem', () => {
  it('strips file:line prefix from react-perf messages', () => {
    const msg =
      'src/App.tsx:27 \u2014 Inline object in JSX prop \u2014 creates new reference every render';
    expect(extractPatternStem(msg)).toBe(
      'Inline object in JSX prop \u2014 creates new reference every render',
    );
  });

  it('strips complexity file prefix', () => {
    const msg =
      'src/components/Foo.tsx (component): 450 lines \u2014 consider splitting (threshold: 300)';
    expect(extractPatternStem(msg)).toBe('consider splitting (threshold: 300)');
  });

  it('returns full message when no delimiter', () => {
    const msg = 'Missing React.lazy() for code splitting';
    expect(extractPatternStem(msg)).toBe(msg);
  });
});

function makeCheck(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    id: 'test',
    name: 'Test Check',
    category: 'security',
    score: 80,
    status: 'pass',
    issues: [],
    toolsUsed: ['test'],
    duration: 100,
    ...overrides,
  };
}

describe('countUniqueIssues', () => {
  it('deduplicates identical patterns within the same check', () => {
    const check = makeCheck({
      id: 'react-perf',
      issues: [
        {
          severity: 'warning',
          message: 'src/A.tsx:1 \u2014 Inline object in JSX prop \u2014 new ref',
          reportedBy: ['react-perf'],
        },
        {
          severity: 'warning',
          message: 'src/B.tsx:5 \u2014 Inline object in JSX prop \u2014 new ref',
          reportedBy: ['react-perf'],
        },
        {
          severity: 'warning',
          message: 'src/C.tsx:10 \u2014 Inline object in JSX prop \u2014 new ref',
          reportedBy: ['react-perf'],
        },
      ],
    });
    const result = countUniqueIssues([check]);
    expect(result.warnings).toBe(1);
    expect(result.totalWarnings).toBe(3);
  });

  it('counts different patterns as separate', () => {
    const check = makeCheck({
      id: 'react-perf',
      issues: [
        {
          severity: 'warning',
          message: 'src/A.tsx:1 \u2014 Inline object \u2014 new ref',
          reportedBy: ['react-perf'],
        },
        {
          severity: 'warning',
          message: 'src/A.tsx:5 \u2014 Using index as key \u2014 issues',
          reportedBy: ['react-perf'],
        },
      ],
    });
    const result = countUniqueIssues([check]);
    expect(result.warnings).toBe(2);
    expect(result.totalWarnings).toBe(2);
  });

  it('returns equal unique and total when no duplicates', () => {
    const check = makeCheck({
      issues: [
        { severity: 'critical', message: 'CVE-2024-1234', reportedBy: ['npm-audit'] },
        { severity: 'warning', message: 'Outdated dep', reportedBy: ['outdated'] },
      ],
    });
    const result = countUniqueIssues([check]);
    expect(result.critical).toBe(1);
    expect(result.totalCritical).toBe(1);
    expect(result.warnings).toBe(1);
    expect(result.totalWarnings).toBe(1);
  });
});

describe('groupIssues', () => {
  it('groups identical patterns together', () => {
    const issues = [
      {
        severity: 'warning' as const,
        message: 'src/A.tsx:1 \u2014 Inline object \u2014 new ref',
        reportedBy: ['react-perf'],
        checkName: 'React Performance',
        checkId: 'react-perf',
      },
      {
        severity: 'warning' as const,
        message: 'src/B.tsx:5 \u2014 Inline object \u2014 new ref',
        reportedBy: ['react-perf'],
        checkName: 'React Performance',
        checkId: 'react-perf',
      },
    ];
    const groups = groupIssues(issues);
    expect(groups).toHaveLength(1);
    expect(groups[0].issues).toHaveLength(2);
    expect(groups[0].stem).toBe('Inline object \u2014 new ref');
  });

  it('keeps different patterns as separate groups', () => {
    const issues = [
      {
        severity: 'warning' as const,
        message: 'src/A.tsx:1 \u2014 Inline object \u2014 ref',
        reportedBy: ['react-perf'],
        checkName: 'React Performance',
        checkId: 'react-perf',
      },
      {
        severity: 'critical' as const,
        message: 'CVE found',
        reportedBy: ['npm-audit'],
        checkName: 'NPM Audit',
        checkId: 'npm-audit',
      },
    ];
    const groups = groupIssues(issues);
    expect(groups).toHaveLength(2);
  });

  it('sorts groups by severity (critical first), then count (descending)', () => {
    const issues = [
      {
        severity: 'warning' as const,
        message: 'W1',
        reportedBy: ['t'],
        checkName: 'T',
        checkId: 't',
      },
      {
        severity: 'warning' as const,
        message: 'W1',
        reportedBy: ['t'],
        checkName: 'T',
        checkId: 't',
      },
      {
        severity: 'critical' as const,
        message: 'C1',
        reportedBy: ['t'],
        checkName: 'T',
        checkId: 't',
      },
    ];
    const groups = groupIssues(issues);
    expect(groups[0].severity).toBe('critical');
    expect(groups[1].severity).toBe('warning');
  });

  it('returns single-issue groups for unique issues', () => {
    const issues = [
      {
        severity: 'info' as const,
        message: 'Just info',
        reportedBy: ['t'],
        checkName: 'T',
        checkId: 't',
      },
    ];
    const groups = groupIssues(issues);
    expect(groups).toHaveLength(1);
    expect(groups[0].issues).toHaveLength(1);
  });
});
