import React from 'react';

import { getScoreEmoji } from '@nebulord/sickbay-core';
import { Box, Text } from 'ink';

import { ScoreBar } from './ScoreBar.js';

import type { SickbayReport } from '@nebulord/sickbay-core';

/**
 * Summary component displays the overall health score of the project along with a breakdown of critical issues, warnings, and info.
 * It uses the ScoreBar component to visually represent the overall score and color-codes the counts of issues based on severity.
 */

interface SummaryProps {
  report: SickbayReport;
  scanDuration?: number | null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export function Summary({ report, scanDuration }: SummaryProps) {
  return (
    <Box flexDirection="column">
      <Text dimColor>{'━'.repeat(52)}</Text>
      <Box marginTop={1}>
        <Text bold>Overall Health Score: </Text>
        <ScoreBar score={report.overallScore} width={12} />
        <Text> {getScoreEmoji(report.overallScore)}</Text>
        {scanDuration != null && <Text dimColor> {formatDuration(scanDuration)}</Text>}
      </Box>
      <Box marginTop={1}>
        <Text color="red"> ✗ {report.summary.critical} critical</Text>
        <Text color="yellow"> ⚠ {report.summary.warnings} warnings</Text>
        <Text color="gray"> i {report.summary.info} info</Text>
      </Box>
      {report.quote && (
        <Box marginTop={1}>
          <Text italic dimColor>
            "{report.quote.text}"
          </Text>
          <Text dimColor> — {report.quote.source}</Text>
        </Box>
      )}
    </Box>
  );
}
