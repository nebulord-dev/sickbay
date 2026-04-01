import React from 'react';

import { Box, Text } from 'ink';

interface UpdateNoticeProps {
  currentVersion: string;
  latestVersion: string;
}

export function UpdateNotice({ currentVersion, latestVersion }: UpdateNoticeProps) {
  const line1 = `Update available: ${currentVersion} → ${latestVersion}`;
  const line2 = 'Run "npx sickbay@latest" to upgrade';
  const maxLength = Math.max(line1.length, line2.length);
  const padding = 2;
  const boxWidth = maxLength + padding * 2;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="yellow" dimColor>
        {`╭${'─'.repeat(boxWidth)}╮`}
      </Text>
      <Box paddingX={padding}>
        <Text color="yellow" dimColor>
          {line1}
        </Text>
      </Box>
      <Box paddingX={padding}>
        <Text color="yellow" dimColor>
          {line2}
        </Text>
      </Box>
      <Text color="yellow" dimColor>
        {`╰${'─'.repeat(boxWidth)}╯`}
      </Text>
    </Box>
  );
}
