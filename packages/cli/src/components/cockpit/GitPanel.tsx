import React from "react";
import { Box, Text } from "ink";
import { useGitStatus } from "./hooks/useGitStatus.js";

interface GitPanelProps {
  projectPath: string;
}

export function GitPanel({ projectPath }: GitPanelProps) {
  const status = useGitStatus(projectPath);

  if (!status) {
    return (
      <Box>
        <Text dimColor>Loading git info...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>Branch: </Text>
        <Text bold color="green">
          {status.branch}
        </Text>
      </Box>
      {(status.ahead > 0 || status.behind > 0) && (
        <Box>
          {status.ahead > 0 && (
            <Text color="green">{"\u2191"}{status.ahead} </Text>
          )}
          {status.behind > 0 && (
            <Text color="red">{"\u2193"}{status.behind}</Text>
          )}
        </Box>
      )}
      <Box>
        <Text dimColor>Modified:  </Text>
        <Text color={status.modified > 0 ? "yellow" : "green"}>
          {status.modified}
        </Text>
      </Box>
      <Box>
        <Text dimColor>Staged:    </Text>
        <Text color={status.staged > 0 ? "cyan" : "green"}>
          {status.staged}
        </Text>
      </Box>
      <Box>
        <Text dimColor>Untracked: </Text>
        <Text>{status.untracked}</Text>
      </Box>
      {status.stashes > 0 && (
        <Box>
          <Text dimColor>Stashes:   </Text>
          <Text>{status.stashes}</Text>
        </Box>
      )}
      {status.lastCommit && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Last commit:</Text>
          <Text>
            {status.lastCommit.length > 30
              ? status.lastCommit.slice(0, 30) + "..."
              : status.lastCommit}
          </Text>
          <Text dimColor>{status.lastCommitTime}</Text>
        </Box>
      )}
    </Box>
  );
}
