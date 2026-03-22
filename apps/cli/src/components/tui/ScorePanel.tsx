import React, { useState, useEffect, useRef } from "react";
import { Box, Text } from "ink";
import type { SickbayReport } from "@sickbay/core";

interface ScorePanelProps {
  report: SickbayReport | null;
  previousScore: number | null;
  animate?: boolean;
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

export function ScorePanel({ report, previousScore, animate = true }: ScorePanelProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const prevTargetRef = useRef(0);

  useEffect(() => {
    if (!animate) return;

    if (!report) {
      setAnimatedScore(0);
      prevTargetRef.current = 0;
      return;
    }

    const target = report.overallScore;
    const start = prevTargetRef.current;
    prevTargetRef.current = target;

    if (start === target) return;

    let current = start;
    const step = target > start ? 1 : -1;

    const id = setInterval(() => {
      current += step;
      setAnimatedScore(current);
      if (current === target) clearInterval(id);
    }, 20);

    return () => clearInterval(id);
  }, [report, animate]);

  // When animate=false, render score directly from prop (no state update needed)
  const displayScore = animate ? animatedScore : (report?.overallScore ?? 0);

  if (!report) {
    return (
      <Box>
        <Text dimColor>Waiting for scan...</Text>
      </Box>
    );
  }

  const delta = previousScore !== null ? report.overallScore - previousScore : null;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={scoreColor(displayScore)} bold>
          {displayScore}/100
        </Text>
        <Text> </Text>
        <Text color={scoreColor(displayScore)}>{scoreBar(displayScore)}</Text>
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
