import React from 'react';

import { Box, Text } from 'ink';

declare const __VERSION__: string;

const ASCII_ART = `
███████ ██  ██████ ██    ██ ██████   █████  ██    ██ 
██      ██ ██      ██   ██  ██   ██ ██   ██  ██  ██  
███████ ██ ██      █████    ██████  ███████   ████   
     ██ ██ ██      ██   ██  ██   ██ ██   ██    ██    
███████ ██  ██████ ██    ██ ██████  ██   ██    ██ 

A vitals health check for your app
`.trim();

interface HeaderProps {
  projectName?: string;
}

export function Header({ projectName }: HeaderProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="green">{ASCII_ART}</Text>
      <Box marginTop={1}>
        <Text dimColor> v{__VERSION__}</Text>
      </Box>
      {projectName && (
        <Box marginTop={1}>
          <Text dimColor> Analyzing </Text>
          <Text bold color="white">
            {projectName}
          </Text>
        </Box>
      )}
    </Box>
  );
}
