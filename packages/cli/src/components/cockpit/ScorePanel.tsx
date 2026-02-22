import React from "react";
import { Box, Text } from "ink";
import type { VitalsReport } from "@vitals/core";

interface ScorePanelProps {
  report: VitalsReport | null;
  previousScore: number | null;
}

function scoreColor(score: number): string {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  return "red";
}

function scoreBar(score: number, width = 15): string {
  const filled = Math.round((score / 100) * width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

export function ScorePanel({ report, previousScore }: ScorePanelProps) {
  if (!report) {
    return (
      <Box>
        <Text dimColor>Waiting for scan...</Text>
      </Box>
    );
  }

  const score = report.overallScore;
  const delta = previousScore !== null ? score - previousScore : null;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={scoreColor(score)} bold>
          {score}/100
        </Text>
        <Text> </Text>
        <Text color={scoreColor(score)}>{scoreBar(score)}</Text>
      </Box>
      {delta !== null && (
        <Text dimColor>
          {delta > 0 ? `+${delta}` : delta === 0 ? "\u00B10" : `${delta}`} since last scan
        </Text>
      )}
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color="red">{"\u2717"} {report.summary.critical} critical</Text>
          <Text>{"  "}</Text>
          <Text color="yellow">{"\u26A0"} {report.summary.warnings} warn</Text>
          <Text>{"  "}</Text>
          <Text dimColor>i {report.summary.info} info</Text>
        </Box>
      </Box>
    </Box>
  );
}
