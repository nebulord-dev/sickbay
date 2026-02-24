import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { loadHistory } from "../../lib/history.js";
import { sparkline, trendArrow } from "../../commands/trend.js";

interface TrendPanelProps {
  projectPath: string;
  lastScanTime: Date | null;
  availableHeight?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  overall: "white",
  dependencies: "blue",
  security: "green",
  "code-quality": "yellow",
  performance: "magenta",
  git: "cyan",
};

const SHORT_LABELS: Record<string, string> = {
  dependencies: "Deps",
  security: "Security",
  "code-quality": "Quality",
  performance: "Perf",
  git: "Git",
};

export function TrendPanel({ projectPath, lastScanTime, availableHeight }: TrendPanelProps) {
  const [trends, setTrends] = useState<
    Array<{
      label: string;
      spark: string;
      latest: number;
      arrow: string;
      color: string;
    }>
  >([]);

  useEffect(() => {
    const history = loadHistory(projectPath);
    if (!history || history.entries.length === 0) {
      setTrends([]);
      return;
    }

    const entries = history.entries.slice(-10);
    const overallValues = entries.map((e) => e.overallScore);
    const overallArrow = trendArrow(overallValues);

    const result: typeof trends = [
      {
        label: "Overall",
        spark: sparkline(overallValues),
        latest: overallValues[overallValues.length - 1],
        arrow: overallArrow.label,
        color: "white",
      },
    ];

    const categories = Object.keys(entries[entries.length - 1].categoryScores);
    for (const cat of categories) {
      const values = entries
        .map((e) => e.categoryScores[cat])
        .filter((v): v is number => v !== undefined);
      if (values.length === 0) continue;
      const arrow = trendArrow(values);
      result.push({
        label: SHORT_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1),
        spark: sparkline(values),
        latest: values[values.length - 1],
        arrow: arrow.label,
        color: CATEGORY_COLORS[cat] || "white",
      });
    }

    setTrends(result);
  }, [projectPath, lastScanTime]);

  if (trends.length === 0) {
    return (
      <Box>
        <Text dimColor>No trend data yet.</Text>
      </Box>
    );
  }

  const maxRows = availableHeight ?? trends.length;
  const visible = trends.slice(0, maxRows);

  return (
    <Box flexDirection="column">
      {visible.map((t) => (
        <Box key={t.label}>
          <Box width={10}>
            <Text color={t.color}>{t.label}</Text>
          </Box>
          <Text>{t.spark}</Text>
          <Text bold> {String(t.latest).padStart(3)}</Text>
          <Text> {t.arrow}</Text>
        </Box>
      ))}
    </Box>
  );
}
