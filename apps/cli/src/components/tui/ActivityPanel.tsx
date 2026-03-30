import React from 'react';

import { Box, Text } from 'ink';

export interface ActivityEntry {
  timestamp: Date;
  type: 'scan-start' | 'scan-complete' | 'file-change' | 'git-change' | 'regression' | 'info';
  message: string;
}

interface ActivityPanelProps {
  entries: ActivityEntry[];
  availableHeight: number;
}

const TYPE_COLOR: Record<ActivityEntry['type'], string> = {
  'scan-start': 'cyan',
  'scan-complete': 'green',
  'file-change': 'yellow',
  'git-change': 'magenta',
  regression: 'red',
  info: 'gray',
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour12: false });
}

export function ActivityPanel({ entries, availableHeight }: ActivityPanelProps) {
  if (entries.length === 0) {
    return (
      <Box>
        <Text dimColor>No activity yet.</Text>
      </Box>
    );
  }

  const visible = entries.slice(-Math.max(1, availableHeight));

  return (
    <Box flexDirection="column">
      {visible.map((entry) => (
        <Box key={`${entry.timestamp.getTime()}-${entry.type}`}>
          <Text dimColor>
            {formatTime(entry.timestamp)}
            {'  '}
          </Text>
          <Text color={TYPE_COLOR[entry.type] || 'white'}>{entry.message}</Text>
        </Box>
      ))}
    </Box>
  );
}
