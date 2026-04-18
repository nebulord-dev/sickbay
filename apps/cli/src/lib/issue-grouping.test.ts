import { describe, it, expect } from 'vitest';

import { extractPatternStem, countUniqueIssues } from './issue-grouping.js';

import type { CheckResult } from 'sickbay-core';

describe('extractPatternStem', () => {
  it('strips file prefix from react-perf messages', () => {
    expect(extractPatternStem('src/A.tsx:1 \u2014 Inline object \u2014 new ref')).toBe(
      'Inline object \u2014 new ref',
    );
  });

  it('returns full message when no delimiter', () => {
    expect(extractPatternStem('No delimiter here')).toBe('No delimiter here');
  });
});

describe('countUniqueIssues', () => {
  it('deduplicates identical patterns', () => {
    const check: CheckResult = {
      id: 'react-perf',
      name: 'React Performance',
      category: 'performance',
      score: 60,
      status: 'warning',
      toolsUsed: ['react-perf'],
      duration: 100,
      issues: [
        {
          severity: 'warning',
          message: 'src/A.tsx:1 \u2014 Inline \u2014 ref',
          reportedBy: ['react-perf'],
        },
        {
          severity: 'warning',
          message: 'src/B.tsx:5 \u2014 Inline \u2014 ref',
          reportedBy: ['react-perf'],
        },
      ],
    };
    const result = countUniqueIssues([check]);
    expect(result.warnings).toBe(1);
    expect(result.totalWarnings).toBe(2);
  });
});
