import React from 'react';

import { Box, Text } from 'ink';

import type { SickbayReport } from 'sickbay-core';

interface BestPracticesProps {
  report: SickbayReport;
}

export function BestPractices({ report }: BestPracticesProps) {
  const recs = report.recommendations;
  if (!recs || recs.length === 0) return null;

  const sorted = [...recs].sort((a, b) => {
    const order = { recommend: 0, suggest: 1 };
    return order[a.severity] - order[b.severity];
  });

  const display = sorted.slice(0, 5);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>💡 Advisor:</Text>
      {display.map((rec) => (
        <Box key={rec.id} marginLeft={2}>
          <Text color={rec.severity === 'recommend' ? 'yellow' : 'gray'}>
            {rec.severity === 'recommend' ? '● ' : '○ '}
          </Text>
          <Text bold>{rec.title}</Text>
          <Text dimColor> — {rec.message}</Text>
        </Box>
      ))}
    </Box>
  );
}
