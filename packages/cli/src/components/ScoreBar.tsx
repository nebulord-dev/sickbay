import React from 'react';
import { Box, Text } from 'ink';

interface ScoreBarProps {
  score: number;
  width?: number;
}

export function ScoreBar({ score, width = 20 }: ScoreBarProps) {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const color = score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red';

  return (
    <Box>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(empty)}</Text>
      <Text color={color}> {score}/100</Text>
    </Box>
  );
}
