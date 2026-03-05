import React from "react";
import { Box, Text } from "ink";
import type { VitalsReport } from "@vitals/core";
import { getScoreEmoji } from "@vitals/core";
import { ScoreBar } from "./ScoreBar.js";

/**
 * Summary component displays the overall health score of the project along with a breakdown of critical issues, warnings, and info.
 * It uses the ScoreBar component to visually represent the overall score and color-codes the counts of issues based on severity.
 */

interface SummaryProps {
  report: VitalsReport;
}

export function Summary({ report }: SummaryProps) {
  return (
    <Box flexDirection="column">
      <Text dimColor>{"━".repeat(52)}</Text>
      <Box marginTop={1}>
        <Text bold>Overall Health Score: </Text>
        <ScoreBar score={report.overallScore} width={12} />
        <Text> {getScoreEmoji(report.overallScore)}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="red"> ✗ {report.summary.critical} critical</Text>
        <Text color="yellow"> ⚠ {report.summary.warnings} warnings</Text>
        <Text color="gray"> i {report.summary.info} info</Text>
      </Box>
    </Box>
  );
}
