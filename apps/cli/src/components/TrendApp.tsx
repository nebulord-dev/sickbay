import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import { Header } from "./Header.js";
import { loadHistory, detectRegressions } from "../lib/history.js";
import { sparkline, trendArrow } from "../commands/trend.js";
import { shortName } from "../lib/resolve-package.js";
import type { TrendHistory } from "../lib/history.js";

interface TrendAppProps {
  projectPath: string;
  last: number;
  jsonOutput: boolean;
  isMonorepo?: boolean;
  packagePaths?: string[];
  packageNames?: Map<string, string>;
}

interface PackageTrend {
  name: string;
  path: string;
  history: TrendHistory | null;
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

function SingleTrendView({
  history,
  last,
}: {
  history: TrendHistory;
  last: number;
}) {
  const entries = history.entries.slice(-last);
  const scores = entries.map((e) => e.overallScore);
  const overall = trendArrow(scores);
  const regressions = detectRegressions(entries);

  return (
    <Box flexDirection="column">
      <Text bold>Score History</Text>
      <Text dimColor>
        {entries.length} scan{entries.length !== 1 ? "s" : ""} recorded
      </Text>

      <Box marginTop={1} marginLeft={2} flexDirection="column">
        <Box>
          <Text bold>{"Overall".padEnd(15)}</Text>
          <Text color={trendColor(overall.direction)}>
            {sparkline(scores)}
          </Text>
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
                <Text dimColor>
                  {(CATEGORY_LABELS[cat] ?? cat).padEnd(15)}
                </Text>
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
                ↓ {CATEGORY_LABELS[r.category] ?? r.category}: {r.from} →{" "}
                {r.to} (-{r.drop} pts)
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
          {new Date(
            entries[entries.length - 1].timestamp,
          ).toLocaleDateString()}
        </Text>
      </Box>
    </Box>
  );
}

export function TrendApp({
  projectPath,
  last,
  jsonOutput,
  isMonorepo,
  packagePaths,
  packageNames,
}: TrendAppProps) {
  const { exit } = useApp();
  const [history, setHistory] = useState<TrendHistory | null>(null);
  const [packageTrends, setPackageTrends] = useState<PackageTrend[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isMonorepo && packagePaths && packageNames) {
      const trends = packagePaths.map((pkgPath) => {
        const name = packageNames.get(pkgPath) ?? pkgPath;
        const h = loadHistory(pkgPath);
        return { name, path: pkgPath, history: h };
      });
      setPackageTrends(trends);
      setLoaded(true);

      if (jsonOutput) {
        const output = trends.map((t) => ({
          package: t.name,
          path: t.path,
          history: t.history,
        }));
        process.stdout.write(JSON.stringify(output, null, 2) + "\n");
      }

      setTimeout(() => exit(), 100);
    } else {
      const h = loadHistory(projectPath);
      setHistory(h);
      setLoaded(true);

      if (jsonOutput && h) {
        process.stdout.write(JSON.stringify(h, null, 2) + "\n");
      }

      setTimeout(() => exit(), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) return null;

  if (jsonOutput) return null;

  // Monorepo: per-package trend summary
  if (isMonorepo && packageTrends.length > 0) {
    const withHistory = packageTrends.filter(
      (t) => t.history && t.history.entries.length > 0,
    );

    if (withHistory.length === 0) {
      return (
        <Box flexDirection="column" padding={1}>
          <Header />
          <Text color="yellow">
            No scan history found for any package in this monorepo.
          </Text>
          <Box marginTop={1}>
            <Text dimColor>Run </Text>
            <Text color="cyan">sickbay --package &lt;name&gt;</Text>
            <Text dimColor> first to start tracking scores.</Text>
          </Box>
        </Box>
      );
    }

    return (
      <Box flexDirection="column" padding={1}>
        <Header />
        <Text bold>Monorepo Score Trends</Text>
        <Text dimColor>
          {withHistory.length} of {packageTrends.length} packages have history
        </Text>

        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          <Box>
            <Text bold>{"Package".padEnd(24)}</Text>
            <Text bold>{"Trend".padEnd(22)}</Text>
            <Text bold>{"Score".padEnd(10)}</Text>
            <Text bold>Direction</Text>
          </Box>
          <Text dimColor>{"━".repeat(64)}</Text>
          {withHistory.map((pkg) => {
            const entries = pkg.history!.entries.slice(-last);
            const scores = entries.map((e) => e.overallScore);
            const trend = trendArrow(scores);
            return (
              <Box key={pkg.path}>
                <Text color="cyan">
                  {shortName(pkg.name).padEnd(24)}
                </Text>
                <Text color={trendColor(trend.direction)}>
                  {sparkline(scores).padEnd(22)}
                </Text>
                <Text bold>
                  {String(scores[scores.length - 1]).padEnd(10)}
                </Text>
                <Text color={trendColor(trend.direction)}>
                  {trend.label}
                </Text>
              </Box>
            );
          })}
        </Box>

        {packageTrends.length > withHistory.length && (
          <Box marginTop={1} marginLeft={2}>
            <Text dimColor>
              {packageTrends.length - withHistory.length} package
              {packageTrends.length - withHistory.length !== 1 ? "s" : ""} with
              no history yet
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  // Single project: no history
  if (!history || history.entries.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Header />
        <Text color="yellow">No scan history found for this project.</Text>
        <Box marginTop={1}>
          <Text dimColor>Run </Text>
          <Text color="cyan">sickbay</Text>
          <Text dimColor> first to start tracking scores.</Text>
        </Box>
      </Box>
    );
  }

  // Single project: has history
  return (
    <Box flexDirection="column" padding={1}>
      <Header projectName={history.projectName} />
      <SingleTrendView history={history} last={last} />
    </Box>
  );
}
