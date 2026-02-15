import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import { Header } from "./Header.js";
import { loadHistory, detectRegressions } from "../lib/history.js";
import { sparkline, trendArrow } from "../commands/trend.js";
import type { TrendHistory } from "../lib/history.js";

/**
 * TrendApp component displays the historical trend of the project's health scores over time.
 * It shows a sparkline graph of the overall score and category-specific scores, along with trend indicators.
 * If jsonOutput is true, it outputs the trend history as JSON instead of rendering the UI.
 */

interface TrendAppProps {
  projectPath: string;
  last: number;
  jsonOutput: boolean;
}

const CATEGORIES = [
  "dependencies",
  "security",
  "code-quality",
  "performance",
  "git",
];

const CATEGORY_LABELS: Record<string, string> = {
  dependencies: "Dependencies",
  security: "Security",
  "code-quality": "Code Quality",
  performance: "Performance",
  git: "Git",
};

function trendColor(direction: "up" | "down" | "stable") {
  if (direction === "up") return "green" as const;
  if (direction === "down") return "red" as const;
  return "gray" as const;
}

export function TrendApp({ projectPath, last, jsonOutput }: TrendAppProps) {
  const { exit } = useApp();
  const [history, setHistory] = useState<TrendHistory | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const h = loadHistory(projectPath);
    setHistory(h);
    setLoaded(true);

    if (jsonOutput && h) {
      process.stdout.write(JSON.stringify(h, null, 2) + "\n");
    }

    setTimeout(() => exit(), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) return null;

  if (jsonOutput) return null;

  if (!history || history.entries.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Header />
        <Text color="yellow">No scan history found for this project.</Text>
        <Box marginTop={1}>
          <Text dimColor>Run </Text>
          <Text color="cyan">vitals</Text>
          <Text dimColor> first to start tracking scores.</Text>
        </Box>
      </Box>
    );
  }

  const entries = history.entries.slice(-last);
  const scores = entries.map((e) => e.overallScore);
  const overall = trendArrow(scores);
  const regressions = detectRegressions(entries);

  return (
    <Box flexDirection="column" padding={1}>
      <Header projectName={history.projectName} />

      <Text bold>Score History</Text>
      <Text dimColor>
        {entries.length} scan{entries.length !== 1 ? "s" : ""} recorded
      </Text>

      <Box marginTop={1} marginLeft={2} flexDirection="column">
        <Box>
          <Text bold>{"Overall".padEnd(15)}</Text>
          <Text color={trendColor(overall.direction)}>{sparkline(scores)}</Text>
          <Text bold> {scores[scores.length - 1]}/100 </Text>
          <Text color={trendColor(overall.direction)}>{overall.label}</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          {CATEGORIES.map((cat) => {
            const catScores = entries
              .map((e) => e.categoryScores[cat])
              .filter((s) => s !== undefined);
            if (catScores.length === 0) return null;
            const catTrend = trendArrow(catScores);
            return (
              <Box key={cat}>
                <Text dimColor>{(CATEGORY_LABELS[cat] ?? cat).padEnd(15)}</Text>
                <Text color={trendColor(catTrend.direction)}>
                  {sparkline(catScores)}
                </Text>
                <Text> {catScores[catScores.length - 1]}/100 </Text>
                <Text color={trendColor(catTrend.direction)}>
                  {catTrend.label}
                </Text>
              </Box>
            );
          })}
        </Box>
      </Box>

      {regressions.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="red">
            Regressions Detected:
          </Text>
          {regressions.map((r, i) => (
            <Box key={i} marginLeft={2}>
              <Text color="red">
                ↓ {CATEGORY_LABELS[r.category] ?? r.category}: {r.from} → {r.to}{" "}
                (-{r.drop} pts)
              </Text>
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>{"━".repeat(52)}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          First scan: {new Date(entries[0].timestamp).toLocaleDateString()}
          {"  ·  "}
          Latest:{" "}
          {new Date(entries[entries.length - 1].timestamp).toLocaleDateString()}
        </Text>
      </Box>
    </Box>
  );
}
