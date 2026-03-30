import React from 'react';

import { Box, Text } from 'ink';

interface HelpRow {
  keys: string[];
  description: string;
}

interface HelpSection {
  title: string;
  rows: HelpRow[];
}

const SECTIONS: HelpSection[] = [
  {
    title: 'PANELS',
    rows: [
      { keys: ['h'], description: 'Focus / unfocus Health Checks' },
      { keys: ['g'], description: 'Focus / unfocus Git Status' },
      { keys: ['t'], description: 'Focus / unfocus Trend' },
      { keys: ['q'], description: 'Focus / unfocus Quick Wins' },
      { keys: ['a'], description: 'Focus / unfocus Activity' },
      { keys: ['f'], description: 'Expand focused panel to full screen' },
      { keys: ['Esc'], description: 'Unfocus panel / exit full screen' },
    ],
  },
  {
    title: 'SCROLLING',
    rows: [{ keys: ['↑', '↓'], description: 'Scroll Health Checks (when focused)' }],
  },
  {
    title: 'ACTIONS',
    rows: [
      { keys: ['r'], description: 'Re-run scan' },
      { keys: ['w'], description: 'Open web dashboard in browser' },
      { keys: ['W'], description: 'Open web dashboard with AI insights' },
      { keys: ['?'], description: 'Toggle this help screen' },
    ],
  },
];

export function HelpPanel() {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          SICKBAY TUI — KEYBOARD SHORTCUTS
        </Text>
      </Box>

      {SECTIONS.map((section) => (
        <Box key={section.title} flexDirection="column" marginBottom={1}>
          <Box marginBottom={0}>
            <Text bold color="white">
              {section.title}
            </Text>
          </Box>
          {section.rows.map((row) => (
            <Box key={row.description} marginLeft={2}>
              <Box width={16}>
                {row.keys.map((k, i) => (
                  <Text key={k}>
                    <Text color="cyan" bold>
                      [{k}]
                    </Text>
                    {i < row.keys.length - 1 ? <Text dimColor> / </Text> : null}
                  </Text>
                ))}
              </Box>
              <Text dimColor>{row.description}</Text>
            </Box>
          ))}
        </Box>
      ))}

      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>Pro tip: focus a panel with its hotkey, then press </Text>
        <Text color="cyan" bold>
          [f]
        </Text>
        <Text dimColor> to expand it full screen for more detail.</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Press </Text>
        <Text color="cyan" bold>
          [?]
        </Text>
        <Text dimColor> or </Text>
        <Text color="cyan" bold>
          [Esc]
        </Text>
        <Text dimColor> to close</Text>
      </Box>
    </Box>
  );
}
