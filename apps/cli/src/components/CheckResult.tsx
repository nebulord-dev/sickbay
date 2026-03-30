import React from 'react';

import { Box, Text } from 'ink';

import { ScoreBar } from './ScoreBar.js';

import type { CheckResult as CheckResultType } from '@nebulord/sickbay-core';

const STATUS_ICONS = {
  pass: '✓',
  warning: '⚠',
  fail: '✗',
  skipped: '○',
};

const CATEGORY_ICONS: Record<string, string> = {
  dependencies: '📦',
  security: '✔',
  'code-quality': '✔',
  performance: '⚡',
  git: '✔',
};

interface CheckResultProps {
  result: CheckResultType;
}

export function CheckResultRow({ result }: CheckResultProps) {
  const statusColor =
    result.status === 'pass'
      ? 'green'
      : result.status === 'fail'
        ? 'red'
        : result.status === 'skipped'
          ? 'gray'
          : 'yellow';
  const icon = CATEGORY_ICONS[result.category] ?? '•';

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text>{icon} </Text>
        <Text bold>{result.name}</Text>
        <Text dimColor> via {result.toolsUsed.join(', ')}</Text>
      </Box>
      <Box marginLeft={2}>
        <ScoreBar score={result.score} width={16} />
        <Text color={statusColor}>
          {' '}
          {STATUS_ICONS[result.status]} {result.status}
        </Text>
      </Box>
      {result.issues.slice(0, 3).map((issue) => (
        <Box key={`${issue.severity}-${issue.message}`} marginLeft={2}>
          <Text
            color={
              issue.severity === 'critical'
                ? 'red'
                : issue.severity === 'warning'
                  ? 'yellow'
                  : 'gray'
            }
          >
            {issue.severity === 'critical' ? '  ✗' : issue.severity === 'warning' ? '  ⚠' : '  ℹ'}{' '}
            {issue.message}
          </Text>
        </Box>
      ))}
      {result.issues.length > 3 && (
        <Box marginLeft={4}>
          <Text dimColor>... and {result.issues.length - 3} more</Text>
        </Box>
      )}
    </Box>
  );
}
